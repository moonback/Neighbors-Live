// Fails fast at server start if the environment is incomplete or malformed.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  await import('./lib/env');
  const { serverEnv } = await import('./lib/env.server');
  serverEnv();
}
