import type { ReactNode } from 'react';
import type { Metadata } from 'next';
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

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang='en'>
      <body className='antialiased'>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
