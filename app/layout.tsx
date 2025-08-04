import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "sonner";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  title: 'University Housing Administrator Tracker',
  description: 'Search for university housing administrators, track outreach, and manage communication status.',
  keywords: ['university', 'housing', 'administrators', 'contact', 'search'],
  authors: [{ name: 'Luyuan Zhu' }],
  openGraph: {
    title: 'University Housing Administrator Tracker',
    description: 'Search for university housing administrators, track outreach, and manage communication status.',
    url: 'https://university-housing-administrator-tr.vercel.app',
    siteName: 'University Housing Administrator Search',
    images: [
      {
        url: 'https://university-housing-administrator-tr.vercel.app/og-image.png',
        height: 630,
        alt: 'University Housing Administrator Search',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Header />
          {children}
          <Footer />
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
