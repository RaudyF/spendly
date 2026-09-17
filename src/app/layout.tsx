import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from "@/components/providers";

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
});

const bagnard = localFont({
  src: '../../public/fonts/BagnardSans.otf',
  variable: '--font-bagnard',
  display: 'swap',
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: 'SaldoClaro - Tu dinero, sin dudas',
  description: 'Controla tus quincenas. Conoce exactamente cuánto dinero tienes libre y organiza tus obligaciones.',
  keywords: ['budget', 'finance', 'expense tracker', 'money management', 'quincenas', 'republica dominicana'],
  authors: [{ name: 'SaldoClaro' }],
  openGraph: {
    title: 'SaldoClaro - Tu dinero, sin dudas',
    description: 'Controla tus quincenas. Conoce exactamente cuánto dinero tienes libre y organiza tus obligaciones.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0c0b' },
  ],
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${montserrat.variable} ${bagnard.variable}`}>
      <body className="min-h-screen antialiased font-sans">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
