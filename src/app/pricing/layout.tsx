import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Free to explore. $19/mo to create your own AI-powered projects. Simple, transparent pricing.',
  openGraph: {
    title: 'Pricing | Bloom',
    description: 'Free to explore. $19/mo to create your own AI-powered projects. Simple, transparent pricing.',
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
