import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const isDev = process.env.NODE_ENV === 'development';
  const disableHmr = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Disable Vite HMR in production or when explicitly requested to prevent WebSocket connection errors in production
      hmr: isDev && !disableHmr ? {} : false,
      host: isDev ? '0.0.0.0' : false,
      // Disable file watching when HMR is disabled to save server CPU resources
      watch: disableHmr ? null : {},
    },
    build: {
      sourcemap: false,
      minify: 'esbuild' as const,
    },
  };
});
