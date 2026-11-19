import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { seo } from './scripts/seo';

export default defineConfig({
  plugins: [react(), seo()],
  build: {
    rollupOptions: {
      output: {
        // libraries change far less often than the app, so they get their own long-lived cache entry
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('@xyflow') || id.includes('d3-')) return 'flow';
          if (id.includes('lucide-react')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
});
