import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    base: '/donate/',
    build: {
        outDir: 'dist',
        emptyOutDir: true
    },
    server: {
        port: 8082,
        proxy: {
            '/api': 'http://localhost:3000',
            '/webhooks': 'http://localhost:3000'
        }
    }
});
