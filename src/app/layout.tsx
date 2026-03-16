import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { ThemeProvider } from '@/contexts/ThemeContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Bloom — Open source that builds itself',
    template: '%s | Bloom',
  },
  description: 'Contribute ideas to living projects. AI agents turn them into code, PRs, and shipped features.',
  metadataBase: new URL('https://bloomit.ai'),
  openGraph: {
    title: 'Bloom — Open source that builds itself',
    description: 'Contribute ideas to living projects. AI agents turn them into code, PRs, and shipped features.',
    siteName: 'Bloom',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bloom — Open source that builds itself',
    description: 'Contribute ideas to living projects. AI agents turn them into code, PRs, and shipped features.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors`}>
        <ThemeProvider>
          <Toaster position="bottom-right" richColors closeButton />
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  )
}
