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
  title: 'Momo Fleet',
  description: 'Rental car fleet management dashboard with reservations, cashflow, damages tracking with interactive car skeleton blueprint, violations, and fleet analytics',
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
              (function() {
                window.addEventListener('error', function(event) {
                  if (event.message === 'Script error.') {
                    event.preventDefault();
                    return;
                  }
                });

                // Desktop PC cleanup: ensure any legacy service workers and caches are unregistered
                try {
                  if (typeof window !== 'undefined') {
                    var isDesktop = window.innerWidth >= 768 && !(/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
                    if (isDesktop && 'serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(function(regs) {
                        if (regs && regs.length > 0) {
                          for (var i = 0; i < regs.length; i++) {
                            regs[i].unregister();
                          }
                          if ('caches' in window) {
                            caches.keys().then(function(keys) {
                              keys.forEach(function(k) { caches.delete(k); });
                            });
                          }
                        }
                      });
                    }
                  }
                } catch(e) {}

                // Automated Mobile PWA Cache Invalidation
                var MOMO_BUILD_VER = 'momo-v2026-11-09-direct-firestore-v8';
                try {
                  if (typeof window !== 'undefined' && 'caches' in window) {
                    var currentVer = localStorage.getItem('momo_build_ver');
                    if (currentVer !== MOMO_BUILD_VER) {
                      caches.keys().then(function(names) {
                        return Promise.all(names.map(function(name) { return caches.delete(name); }));
                      }).then(function() {
                        localStorage.setItem('momo_build_ver', MOMO_BUILD_VER);
                        if ('serviceWorker' in navigator) {
                          navigator.serviceWorker.getRegistrations().then(function(regs) {
                            for (var i = 0; i < regs.length; i++) {
                              regs[i].update();
                              if (regs[i].waiting) {
                                regs[i].waiting.postMessage({ type: 'SKIP_WAITING' });
                              }
                            }
                          });
                        }
                        if (currentVer) {
                          window.location.reload();
                        }
                      });
                    }
                  }
                } catch(e) {}
              })();
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
