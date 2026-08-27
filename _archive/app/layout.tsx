import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'ProjectPilot Neuro — Academic Project Management',
    template: '%s | ProjectPilot Neuro',
  },
  description:
    'The project platform built for neurodivergent university teams. Manage tasks, track team health, and structure supervisor consultations in one place.',
  keywords: ['project management', 'university', 'neurodivergent', 'ADHD', 'autism', 'student teams'],
};

// Runs before hydration so the correct theme class is present on first paint
// (avoids a flash of the wrong theme).
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('projectpilot-theme') || 'system';
    var isDark = stored === 'dark' || (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
