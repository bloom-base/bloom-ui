import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Profile',
  description: 'User profile on Bloom — projects, contributions, and activity.',
}

export default function PublicProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
