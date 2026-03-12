import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Platform analytics — task performance, token usage, and cost breakdown.',
  robots: { index: false, follow: false },
}

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
