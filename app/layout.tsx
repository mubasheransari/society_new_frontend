import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import AppShell from './components/AppShell';

export const metadata: Metadata = {
  title: 'Lucknow Co-operative Housing Society',
  description: 'Society invoice, maintenance charges, records, and NOC management',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

// Without this, mobile browsers render the page at a fixed desktop-width
// canvas (~980px) and zoom out to fit the screen, so the existing
// `@media (max-width: ...)` rules in globals.css never actually trigger.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang='en'>
      <body className='antialiased'>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
