import { createSerwistRoute } from '@serwist/turbopack';

// Builds and serves the service worker (src/app/sw.ts) at /serwist/sw.js.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    swSrc: 'src/app/sw.ts',
    useNativeEsbuild: true,
    additionalPrecacheEntries: [{ url: '/offline', revision: '2026-10-25' }],
  },
);
