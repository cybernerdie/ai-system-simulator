import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { seo } from './scripts/seo';

export default defineConfig({ plugins: [react(), seo()] });
