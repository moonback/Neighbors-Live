import { expect, type Page } from '@playwright/test';

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:56424';

interface MailSummary {
  ID: string;
  Created: string;
}

/** Waits for the newest magic link sent to `email` after `since` and returns its URL. */
async function magicLink(email: string, since: number): Promise<string> {
  for (let i = 0; i < 40; i += 1) {
    const query = encodeURIComponent(`to:${email}`);
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${query}&limit=5`);
    const { messages } = (await res.json()) as { messages: MailSummary[] };
    const fresh = messages.find((m) => new Date(m.Created).getTime() >= since - 2000);
    if (fresh) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json()) as {
        Text: string;
      };
      const link = msg.Text.match(/https?:\/\/\S+verify\S+/)?.[0];
      if (link) return link.replace(/[)>\]]+$/, '');
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no magic link for ${email}`);
}

/** Signs in through the real magic-link flow (Mailpit). Returns once on the app. */
export async function signIn(page: Page, email: string, next = '/'): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Adresse e-mail').fill(email);
  const since = Date.now();
  await page.getByRole('button', { name: 'Recevoir le lien' }).click();
  await expect(page.getByText(`Lien envoyé à ${email}`)).toBeVisible();
  await page.goto(await magicLink(email, since));
}

/** Creates a brand-new account (sign-up = first magic link) with a pseudo. */
export async function signUp(
  page: Page,
  prefix: string,
): Promise<{ email: string; username: string }> {
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const username = `${prefix}_${suffix}`.slice(0, 20);
  const email = `${username}@e2e.test`;
  await signIn(page, email);
  await expect(page).toHaveURL(/\/bienvenue/);
  await page.getByLabel('Pseudo').fill(username);
  await page.getByRole('button', { name: 'C’est parti' }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  return { email, username };
}
