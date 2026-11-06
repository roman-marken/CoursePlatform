import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { demoApi } from './demo/api.ts';

export default defineConfig({
  plugins: [react(), demoApi()],
  server: {
    port: 5178,
    strictPort: true,
    // Парольні хеші не повинні бути доступні як статичні файли dev-сервера.
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.data/**'] },
  },
  preview: { port: 4178, strictPort: true },
});
