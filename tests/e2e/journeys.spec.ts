import { expect, test, type Browser } from '@playwright/test';
import { signIn, signUp } from './helpers';

const BELLEVILLE = 'lat=48.8722&lng=2.3767';

test('sign-up and sign-in with e-mail + password, unique pseudo', async ({ page, browser }) => {
  const { username, email, password } = await signUp(page, 'signup');
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: `@${username}` })).toBeVisible();
  await expect(page.getByText('Réputation')).toBeVisible();

  const other = await browser.newContext();
  const p = await other.newPage();
  // The pseudo is unique.
  await p.goto('/login?mode=signup');
  await p.getByLabel('Adresse e-mail').fill(`dup_${Date.now()}@e2e.test`);
  await p.getByLabel('Pseudo').fill(username);
  await p.getByLabel('Mot de passe', { exact: true }).fill('autre-mdp-2026');
  await p.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(p.getByText('Ce pseudo est déjà pris.')).toBeVisible();
  // Weak passwords are refused before any request.
  await p.getByLabel('Pseudo').fill(`x${Date.now().toString(36)}`.slice(0, 20));
  await p.getByLabel('Mot de passe', { exact: true }).fill('court');
  await p.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(p.getByText('8 caractères minimum.')).toBeVisible();
  // Wrong password, then the right one.
  await p.goto('/login');
  await p.getByLabel('Adresse e-mail').fill(email);
  await p.getByLabel('Mot de passe', { exact: true }).fill('mauvais-mdp-1');
  await p.getByRole('button', { name: 'Se connecter' }).click();
  await expect(p.getByText('Adresse e-mail ou mot de passe incorrect.')).toBeVisible();
  await signIn(p, email, '/me', password);
  await expect(p.getByRole('heading', { name: `@${username}` })).toBeVisible();
  await other.close();
});

test('feed: plays the visible video muted, preloads only the next one', async ({ page }) => {
  await page.route('**/api/feed?**', async (route) => {
    const response = await route.fetch();
    const payload = (await response.json()) as {
      items?: Array<{ caption: string }>;
    };
    if (payload.items?.[0]) {
      payload.items[0].caption = 'Information importante pour le quartier. '.repeat(5).trim();
    }
    await route.fulfill({ response, body: JSON.stringify(payload) });
  });
  await page.goto(`/?${BELLEVILLE}`);
  const first = page.getByTestId('feed-item').first();
  await expect(first).toBeVisible();
  await expect
    .poll(() => first.locator('video').evaluate((v: HTMLVideoElement) => !v.paused && v.muted))
    .toBe(true);
  const sources = await page.locator('video[src]').count();
  expect(sources).toBeLessThanOrEqual(2);
  await first.getByRole('button', { name: 'Activer le son' }).click();
  await expect(first.locator('video')).toHaveJSProperty('muted', false);
  const expandCaption = first.getByRole('button', { name: 'Lire la suite' });
  await expect(expandCaption).toBeVisible();
  await expect(expandCaption).toHaveAttribute('aria-expanded', 'false');
  await expandCaption.click();
  await expect(first.getByRole('button', { name: 'Réduire' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await first.getByRole('button', { name: 'Réduire' }).click();
  // Filters and radius
  await page.getByRole('button', { name: 'Alerte', exact: true }).click();
  await expect(page.getByTestId('feed-item').first()).toContainText('Alerte');
});

test('merchant introduction is public and application remains behind authentication', async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto('/commerces');
  await expect(
    page.getByRole('heading', { name: 'Faites découvrir votre commerce aux voisins.' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Simple et local' })).toBeVisible();
  await expect(page.getByText(/aucun résultat commercial n’est garanti/i)).toBeVisible();
  await page
    .context()
    .addCookies([{ name: 'nl-onboarded', value: '1', url: 'http://localhost:3000' }]);
  await page.getByRole('link', { name: 'Présenter mon commerce' }).first().click();
  await expect(page).toHaveURL(/\/login\?next=\/commerce$/);
  await context.close();
});

async function reportAs(browser: Browser, videoId: string, prefix: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signUp(page, prefix);
  const res = await page.request.post(`/api/videos/${videoId}/report`, {
    data: { reason: 'recognizable_person', details: 'visage' },
    headers: { Origin: 'http://localhost:3000' },
  });
  expect(res.status()).toBe(201);
  await context.close();
}

test('report until hidden, then a zone moderator removes it with a note', async ({
  page,
  browser,
}) => {
  // Pick a resident's video in central Belleville (moderated by the demo moderator).
  const feed = await page.request.get(`/api/feed?${BELLEVILLE}&radius=1000&limit=20`);
  const { items } = (await feed.json()) as {
    items: Array<{ id: string; author: { username: string } }>;
  };
  const target = items.find(
    (i) => !i.author.username.startsWith('modo') && !i.author.username.startsWith('pub_'),
  );
  expect(target, 'a demo video near Belleville').toBeTruthy();
  const id = target!.id;

  // First report through the UI…
  await signUp(page, 'rep_ui');
  await page.goto(`/?video=${id}&${BELLEVILLE}`);
  const card = page.locator(`[data-video-id="${id}"]`);
  await card.getByRole('button', { name: 'Signaler' }).click();
  const dialog = page.getByRole('dialog', { name: 'Signaler cette vidéo' });
  await dialog.getByLabel('Une personne est reconnaissable').check();
  await dialog.getByRole('button', { name: 'Envoyer le signalement' }).click();
  await expect(dialog.getByText(/transmis aux modérateurs/)).toBeVisible();

  // …still visible after one report; hidden after 3 distinct accounts.
  expect((await page.request.get(`/api/videos/${id}/media`)).status()).toBe(200);
  await reportAs(browser, id, 'rep_two');
  await reportAs(browser, id, 'rep_three');
  await expect
    .poll(async () => (await page.request.get(`/api/videos/${id}/media`)).status())
    .toBe(404);

  // The demo moderator of Belleville sees it in the zone queue and removes it.
  const modContext = await browser.newContext();
  const mod = await modContext.newPage();
  await signIn(mod, 'modo.belleville@neighbors.test', `/moderation?video=${id}`);
  await mod.goto(`/moderation?video=${id}`);
  const item = mod.locator(`[data-testid="queue-item"][data-video-id="${id}"]`);
  await expect(item).toBeVisible();
  await expect(item).toContainText('Masquée automatiquement');
  await expect(item.getByRole('button', { name: 'Supprimer' })).toBeDisabled(); // note required
  await item
    .getByLabel('Note (obligatoire pour une suppression)')
    .fill('Visage reconnaissable au premier plan');
  await item.getByRole('button', { name: 'Supprimer' }).click();
  await expect(mod.getByText('Décision enregistrée.')).toBeVisible();
  await expect(item).toHaveCount(0);
  await modContext.close();
});

test('data export and account deletion', async ({ page }) => {
  const { username } = await signUp(page, 'del');
  await page.goto('/parametres');

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Exporter mes données (JSON)' }).click();
  const file = await (await download).path();
  const { readFile } = await import('node:fs/promises');
  const exported = JSON.parse(await readFile(file, 'utf8')) as { profile: { username: string } };
  expect(exported.profile.username).toBe(username);

  const button = page.getByRole('button', { name: 'Supprimer définitivement' });
  await expect(button).toBeDisabled();
  await page.getByLabel(`Tapez votre pseudo « ${username} » pour confirmer`).fill(username);
  await button.click();
  await expect(page).toHaveURL(/deleted=1/);
  await expect(page.getByText('Votre compte a été supprimé')).toBeVisible();
  expect((await page.request.get('/api/me/videos')).status()).toBe(401);
  expect((await page.request.get(`/u/${username}`)).status()).toBe(404);
});
