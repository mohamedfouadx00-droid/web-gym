import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({ plugins: [react(), VitePWA({
            registerType: 'autoUpdate',
            manifest: { name: 'GYM', short_name: 'GYM', description: 'مساعد يومي عربي ينظم الأكل والمياه والجيم والكرياتين والنوم', theme_color: '#0b1020', background_color: '#0b1020', display: 'standalone', lang: 'ar', dir: 'rtl', start_url: '/',
                icons: [{ src: '/pwa-192.svg', sizes: '192x192', type: 'image/svg+xml' }, { src: '/pwa-512.svg', sizes: '512x512', type: 'image/svg+xml' }] }
        })] });
