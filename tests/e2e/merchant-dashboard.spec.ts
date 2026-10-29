import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

// Seeded approved merchant; its offers are inserted after the stats migration but dated in the
// past, so they predate `merchant_stats_since` and must read "not available", never 0.
const MERCHANT = 'boulangerie@neighbors.test';
const SEEDED_OFFER = '10000000-0000-4000-8000-000000000037';

test('approved merchant sees only measured numbers', async ({ page }) => {
  await signIn(page, MERCHANT, '/commerce');
  await expect(page.getByRole('heading', { name: 'Vos offres' })).toBeVisible();

  const offers = page.getByTestId('merchant-offer');
  await expect(offers.first()).toBeVisible();
  await expect(
    offers
      .filter({ hasText: '-20 % sur les viennoiseries' })
      .getByText(/Statistiques non disponibles/),
  ).toBeVisible();
  await expect(page.getByText(/Les achats en boutique ne sont pas visibles/)).toBeVisible();

  // No derived percentage anywhere in the measured figures.
  for (const text of await page.locator('dl, [data-testid="merchant-offer"] ul').allInnerTexts()) {
    expect(text).not.toMatch(/%/);
  }
});

test('statistics events are accepted without leaking anything', async ({ request }) => {
  const res = await request.post(`/api/videos/${SEEDED_OFFER}/events`, {
    data: { kind: 'offer_click' },
    headers: { origin: 'http://localhost:3000' },
  });
  expect(res.status()).toBe(204);
  expect(await res.text()).toBe('');
});

test('approved merchant edits contact details but not the name', async ({ page }) => {
  await signIn(page, MERCHANT, '/commerce');
  await expect(page.getByRole('heading', { name: 'Fiche du commerce' })).toBeVisible();
  await expect(page.getByLabel('Nom du commerce')).toHaveCount(0);

  const phone = `01 ${Date.now().toString().slice(-8, -6)} 00 00 00`;
  await page.getByLabel('Téléphone').fill(phone);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Fiche mise à jour.')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Téléphone')).toHaveValue(phone);
});
