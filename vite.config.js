// Plain comment: Vite configuration for CampusCode multi-page build and clean url routing
import fs from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

// Plain comment: Custom plugin to handle clean URLs and fallback routing in dev and preview servers
function cleanUrlsRoutingPlugin() {
  const handler = (req, res, next) => {
    const rawUrl = req.url || '/';
    const pathPart = rawUrl.split('?')[0];
    const queryPart = rawUrl.includes('?') ? '?' + rawUrl.split('?')[1] : '';

    if (pathPart === '/login' || pathPart === '/login/') {
      req.url = '/login.html' + queryPart;
    } else if (pathPart === '/register' || pathPart === '/register/') {
      req.url = '/register.html' + queryPart;
    } else if (pathPart === '/dashboard' || pathPart === '/dashboard/') {
      req.url = '/dashboard.html' + queryPart;
    } else if (
      pathPart !== '/' &&
      !pathPart.includes('.') &&
      !pathPart.startsWith('/@') &&
      !pathPart.startsWith('/src') &&
      !pathPart.startsWith('/assets') &&
      !pathPart.startsWith('/node_modules')
    ) {
      req.url = '/index.html' + queryPart;
    }
    next();
  };

  return {
    name: 'clean-urls-routing-plugin',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        login: resolve(rootDir, 'login.html'),
        register: resolve(rootDir, 'register.html'),
        dashboard: resolve(rootDir, 'dashboard.html'),
      },
    },
  },
  plugins: [
    cleanUrlsRoutingPlugin(),
    {
      name: 'prune-raw-frames-from-dist',
      closeBundle() {
        const rawDistDir = resolve(rootDir, 'dist/assets/campuscode frames');
        if (fs.existsSync(rawDistDir)) {
          fs.rmSync(rawDistDir, { recursive: true, force: true });
        }
      },
    },
  ],
});
