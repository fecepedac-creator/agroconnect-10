import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          const moduleId = id.replaceAll('\\', '/');
          if (moduleId.includes('/@firebase/firestore/')) return 'vendor-firebase-firestore';
          if (moduleId.includes('/@firebase/auth/')) return 'vendor-firebase-auth';
          if (moduleId.includes('/@firebase/functions/')) return 'vendor-firebase-functions';
          if (moduleId.includes('/firebase/')) return 'vendor-firebase-entry';
          if (moduleId.includes('/@firebase/')) return 'vendor-firebase-core';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('lucide')) return 'vendor-icons';
        },
      },
    },
  },
});
