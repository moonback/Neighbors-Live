import { expect, test, type APIRequestContext } from '@playwright/test';
import { signUp } from './helpers';

const ORIGIN = { Origin: 'http://localhost:3000' };
const BELLEVILLE = 'lat=48.8722&lng=2.3767';

const post = (r: APIRequestContext, url: string, data: unknown) =>
  r.post(url, { data, headers: ORIGIN });
const del = (r: APIRequestContext, url: string, data: unknown = {}) =>
  r.delete(url, { data, headers: ORIGIN });

async function anyActiveVideo(r: APIRequestContext): Promise<string> {
  const res = await r.get(`/api/feed?${BELLEVILLE}&radius=3000&limit=20`);
  const { items } = (await res.json()) as { items: Array<{ id: string }> };
  expect(items.length).toBeGreaterThan(0);
  return items[items.length - 1]!.id;
}

test('feed pagination: cursor pages do not overlap', async ({ request }) => {
  const first = await (await request.get(`/api/feed?${BELLEVILLE}&radius=3000&limit=5`)).json();
  expect(first.items).toHaveLength(5);
  expect(first.nextCursor).toBeTruthy();
  const second = await (
    await request.get(`/api/feed?${BELLEVILLE}&radius=3000&limit=5&cursor=${first.nextCursor}`)
  ).json();
  const ids = new Set(first.items.map((i: { id: string }) => i.id));
  expect(second.items.some((i: { id: string }) => ids.has(i.id))).toBe(false);
  // Public payload never contains exact coordinates or storage paths.
  expect(JSON.stringify(first)).not.toMatch(/location|video_path|raw_path|accuracy/);
  expect(first.items.every((i: { distanceM: number }) => i.distanceM % 100 === 0)).toBe(true);
  expect((await request.get(`/api/feed?${BELLEVILLE}&radius=5000`)).status()).toBe(422);
});

test('map: GeoJSON of fuzzed positions', async ({ request }) => {
  const res = await request.get(`/api/map?${BELLEVILLE}&radius=1000`);
  expect(res.status()).toBe(200);
  const fc = await res.json();
  expect(fc.type).toBe('FeatureCollection');
  expect(fc.features.length).toBeGreaterThan(0);
  expect(Object.keys(fc.features[0].properties).sort()).toEqual(['caption', 'category', 'id']);
});

test('csrf: mutations without a same-site Origin are refused', async ({ page }) => {
  await signUp(page, 'csrf');
  const res = await page.request.patch('/api/me/settings', { data: { defaultRadius: 300 } });
  expect(res.status()).toBe(403);
  expect((await res.json()).error).toBe('bad_origin');
  const evil = await page.request.patch('/api/me/settings', {
    data: { defaultRadius: 300 },
    headers: { Origin: 'https://evil.example' },
  });
  expect(evil.status()).toBe(403);
});

test('useful, comments (own delete only), merchant, push, appeal, admin guard, withdraw, logout', async ({
  page,
  browser,
}) => {
  await signUp(page, 'api');
  const r = page.request;
  const id = await anyActiveVideo(r);

  // Useful toggles once per user.
  const on = await (await post(r, `/api/videos/${id}/useful`, {})).json();
  expect(on.reacted).toBe(true);
  const again = await (await post(r, `/api/videos/${id}/useful`, {})).json();
  expect(again.usefulCount).toBe(on.usefulCount);
  const off = await (await del(r, `/api/videos/${id}/useful`)).json();
  expect(off).toEqual({ reacted: false, usefulCount: on.usefulCount - 1 });

  // Comments: sanitised, listed, deletable by their author only.
  const created = await post(r, `/api/videos/${id}/comments`, { body: '  Merci‮ !  ' });
  expect(created.status()).toBe(201);
  const comment = await created.json();
  expect(comment.body).toBe('Merci !');
  const list = await (await r.get(`/api/videos/${id}/comments`)).json();
  expect(list.comments.some((c: { id: string }) => c.id === comment.id)).toBe(true);
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signUp(otherPage, 'api_other');
  expect((await del(otherPage.request, `/api/comments/${comment.id}`)).status()).toBe(404);
  await other.close();
  expect((await del(r, `/api/comments/${comment.id}`)).status()).toBe(200);
  expect((await post(r, `/api/videos/${id}/comments`, { body: '' })).status()).toBe(422);

  // Merchant application: pending, once.
  expect((await post(r, '/api/merchant', { businessName: 'Café test' })).status()).toBe(201);
  expect((await post(r, '/api/merchant', { businessName: 'Café test' })).status()).toBe(409);

  // Push subscription stores a zone, not a position.
  const endpoint = `https://push.example/e2e/${Date.now()}`;
  const sub = await post(r, '/api/push/subscribe', {
    subscription: {
      endpoint,
      keys: {
        p256dh:
          'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
    },
    zone: { lat: 48.8722, lng: 2.3767 },
    radius: 1000,
  });
  expect(sub.status()).toBe(201);
  expect((await sub.json()).zoneCell).toMatch(/^88[0-9a-f]{13}$/);
  expect((await del(r, '/api/push/subscribe', { endpoint })).status()).toBe(200);

  // Appeals only for decisions about oneself; admin actions only for admins.
  expect(
    (
      await post(r, '/api/appeals', { actionId: 1, reason: 'Je conteste cette décision.' })
    ).status(),
  ).toBe(403);
  const admin = await post(r, '/api/admin', {
    type: 'ban',
    userId: '00000000-0000-4000-8000-000000000005',
    banned: true,
    note: 'test',
  });
  expect(admin.status()).toBe(403);
  const mod = await post(r, '/api/moderation', {
    type: 'decision',
    videoId: id,
    action: 'hide',
    note: '',
  });
  expect(mod.status()).toBe(403);

  // Publication validation + immediate withdrawal of one's own video.
  const bad = await post(r, '/api/videos', {
    category: 'help',
    caption: 'x',
    lat: 48.8722,
    lng: 2.3767,
    accuracy: 150,
    mimeType: 'video/webm',
    durationMs: 5000,
    sizeBytes: 1000,
  });
  expect(bad.status()).toBe(422);
  const reserved = await post(r, '/api/videos', {
    category: 'help',
    caption: 'à retirer',
    lat: 48.8722,
    lng: 2.3767,
    accuracy: 15,
    mimeType: 'video/webm',
    durationMs: 5000,
    sizeBytes: 1000,
  });
  expect(reserved.status()).toBe(201);
  const { videoId, uploadPath } = await reserved.json();
  expect(uploadPath).toMatch(new RegExp(`/${videoId}\\.webm$`));
  expect((await post(r, `/api/videos/${videoId}/uploaded`, {})).status()).toBe(409); // nothing uploaded
  expect((await del(r, `/api/videos/${videoId}`)).status()).toBe(200);
  const mine = await (await r.get('/api/me/videos')).json();
  expect(mine.videos.some((v: { id: string }) => v.id === videoId)).toBe(false);

  // Logout ends the session.
  expect((await post(r, '/api/auth/logout', {})).status()).toBe(200);
  expect((await r.get('/api/me/videos')).status()).toBe(401);
});

test('first visit goes through the 4-screen onboarding', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto('/carte');
  await expect(page).toHaveURL(/\/onboarding\?next=%2Fcarte/);
  await expect(page.getByRole('heading', { name: 'Votre quartier, en direct' })).toBeVisible();
  for (const title of [
    'Vos autorisations, expliquées avant d’être demandées',
    'Installer l’application',
    'Les règles de la communauté',
  ]) {
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
  await page.getByRole('button', { name: 'J’ai compris, c’est parti' }).click();
  await expect(page).toHaveURL(/\/carte$/);
  await page.goto('/');
  await expect(page).not.toHaveURL(/onboarding/);
  await context.close();
});
