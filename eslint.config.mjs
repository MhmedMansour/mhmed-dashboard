import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  {
    rules: {
      // Thumbnails/previews are user-uploaded bytes served by our own API routes
      // (/api/files/[id]/preview, /api/haram-documents/[id]/preview). They are
      // dynamic, need credentials, and are cached by the service worker, so
      // next/image's optimizer cannot be used here. next.config.ts already sets
      // `images.unoptimized = true` for the whole app.
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
