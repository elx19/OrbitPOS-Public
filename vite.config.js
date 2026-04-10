const path = require('path');
const { defineConfig } = require('vite');

module.exports = defineConfig(async () => {
  const react = (await import('@vitejs/plugin-react')).default;

  return {
    root: path.resolve(__dirname, 'frontend'),
    base: './',
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true
    },
    build: {
      outDir: path.resolve(__dirname, 'frontend', 'dist'),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }

            if (id.includes('recharts')) {
              return 'charts-vendor';
            }

            if (
              id.includes('react-router') ||
              id.includes('react-dom') ||
              id.includes('react') ||
              id.includes('scheduler')
            ) {
              return 'react-vendor';
            }
            return undefined;
          }
        }
      }
    }
  };
});
