import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to Bloom to contribute ideas to living open source projects.',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
