// vite.config.js — AuthCenter Panel
// Multi-página: login.html (raíz) + panel/licencias, panel/productos
import { defineConfig } from 'vite';
import { resolve } from 'path';

const dir = import.meta.dirname ?? resolve('.');

export default defineConfig({
  root: '.',
  build: {
    rollupOptions: {
      input: {
        main:      resolve(dir, 'index.html'),
        licencias: resolve(dir, 'panel/licencias.html'),
        productos: resolve(dir, 'panel/productos.html'),
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
});
