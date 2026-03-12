import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Manage your Bloom account, projects, API keys, and billing.',
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
