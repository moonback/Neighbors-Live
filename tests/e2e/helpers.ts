import { expect, type Page } from '@playwright/test';

/** Password of every seeded demo account (see packages/shared/scripts/gen-seed.mjs). */
export const DEMO_PASSWORD = 'voisins2026';
/** Password used for accounts created by the tests (local test database only). */
const TEST_PASSWORD = 'e2e-test-1234';

/** Signs in with e-mail + password through the login form. */
export async function signIn(
  page: Page,
  email: string,
  next = '/',
  password = DEMO_PASSWORD,
): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Creates a brand-new account (e-mail, pseudo, password) through the sign-up form. */
export async function signUp(
  page: Page,
  prefix: string,
): Promise<{ email: string; username: string; password: string }> {
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const username = `${prefix}_${suffix}`.slice(0, 20);
  const email = `${username}@e2e.test`;
  await page.goto('/login?mode=signup');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Pseudo').fill(username);
  await page.getByLabel('Mot de passe', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  return { email, username, password: TEST_PASSWORD };
}
