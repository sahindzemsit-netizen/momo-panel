import type {Metadata, Viewport} from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { AppStateProvider } from '@/lib/context';
import ClientLayout from '@/components/ClientLayout';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'Momo Fleet | Fleet Dashboard',
  description: 'Rental car fleet management dashboard',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1e293b',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${outfit.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="font-sans antialiased bg-[#FDFCF0]" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(event) {
                if (event.message === 'Script error.') {
                  // Suppress generic cross-origin script errors that provide no info
                  event.preventDefault();
                  return;
                }
              });
            `,
          }}
        />
        <AppStateProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </AppStateProvider>
      </body>
    </html>
  );
}
