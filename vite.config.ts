import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import fs from 'fs';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(),
      /**
       * وضع التطبيق الأصلي (APK): نستثني ملفات تثبيت الـAPK من داخل الحزمة
       * (7 ميجا لا لزوم لها داخل التطبيق)، فيصغر حجم التطبيق المنزّل.
       */
      process.env.SANAD_NATIVE === 'true' && {
        name: 'sanad-native-exclude-downloads',
        closeBundle() {
          fs.rmSync(path.resolve(__dirname, 'dist/downloads/apk'), { recursive: true, force: true });
        },
      },
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
