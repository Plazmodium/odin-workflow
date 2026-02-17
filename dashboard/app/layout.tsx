import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Sidebar } from '@/components/layout/sidebar';
import { RefreshProvider } from '@/lib/realtime/realtime-provider';
import { SoundNotificationProvider } from '@/lib/sound/sound-provider';
import { ThemeProvider } from '@/lib/theme/theme-provider';
import { CommandPaletteServer } from '@/components/shared/command-palette-server';
import './globals.css';

export const metadata: Metadata = {
  title: 'Odin Dashboard',
  description: 'Odin SDD Framework - System Health & Feature Monitoring',
  icons: {
    icon: '/icon.svg',
  },
};

/**
 * Inline script to prevent flash of unstyled content (FOUC).
 * Runs before React hydration to apply the correct theme class.
 * Reads from localStorage, falls back to system preference, defaults to dark.
 */
const themeScript = `
  (function() {
    try {
      var stored = localStorage.getItem('odin-theme');
      var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      document.documentElement.classList.add('dark');
    }
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <RefreshProvider>
            <SoundNotificationProvider>
              <Sidebar />
              <CommandPaletteServer />
              <main className="ml-56 min-h-screen p-6">
                {children}
              </main>
            </SoundNotificationProvider>
          </RefreshProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
