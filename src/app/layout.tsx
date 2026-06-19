import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'MyAgenda – diario, promemoria e spese',
  description: 'Registra eventi, ricevi promemoria intelligenti e tieni traccia delle spese.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: 'MyAgenda', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#225aec',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
