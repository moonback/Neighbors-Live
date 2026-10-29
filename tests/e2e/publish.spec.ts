import { expect, test } from '@playwright/test';
import { signUp } from './helpers';

test('records a video with the camera, publishes it, and the worker makes it active', async ({
  page,
}) => {
  await signUp(page, 'pub');
  await page.setViewportSize({ width: 375, height: 500 });
  await page.goto('/filmer');

  // Explanation before any system prompt, then the camera (Chromium fake device).
  await expect(page.getByRole('dialog', { name: 'Filmer ce qui se passe' })).toBeVisible();
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await expect(page.getByText('30 secondes maximum')).toBeVisible();
  await expect(page.locator('input[type=file]')).toHaveCount(0); // no gallery import

  await page.getByRole('button', { name: 'Démarrer l’enregistrement' }).click();
  await expect(page.getByText(/s restantes/)).toBeVisible();
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'Arrêter l’enregistrement' }).click();

  // Preview, retake once, record again.
  await expect(page.getByRole('button', { name: 'Refaire' })).toBeVisible();
  await page.getByRole('button', { name: 'Refaire' }).click();
  await page.getByRole('button', { name: 'Démarrer l’enregistrement' }).click();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Arrêter l’enregistrement' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();

  await page.getByText('Bon plan', { exact: true }).click();
  await page.getByLabel('Légende').fill('Test e2e : cagettes de pommes gratuites');
  await expect(page.getByRole('button', { name: 'Publier ici' })).toBeInViewport();
  await page.getByRole('button', { name: 'Publier ici' }).click();
  await expect(page.getByText(/Vidéo envoyée/)).toBeVisible({ timeout: 60_000 });

  // Status goes processing → active once the worker has blurred and transcoded it.
  await page.getByRole('link', { name: 'Suivre le statut' }).click();
  const own = page.getByTestId('own-video').first();
  await expect(own).toHaveAttribute('data-status', /processing|active/);
  await expect(own).toHaveAttribute('data-status', 'active', { timeout: 90_000 });
});

test('refuses to publish with an imprecise position', async ({ page, context }) => {
  await signUp(page, 'gps');
  await context.setGeolocation({ latitude: 48.8722, longitude: 2.3767, accuracy: 550 });
  await page.goto('/filmer');
  await page.getByRole('button', { name: 'Activer la caméra' }).click();
  await page.getByRole('button', { name: 'Démarrer l’enregistrement' }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Arrêter l’enregistrement' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Publier ici' }).click();
  await expect(page.getByText(/Position trop imprécise \(± 550 m/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réessayer la localisation' })).toBeVisible();
});
