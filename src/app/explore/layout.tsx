import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Explore Projects',
  description: 'Browse living open source projects on Bloom. Contribute ideas and watch AI agents build them.',
  openGraph: {
    title: 'Explore Projects | Bloom',
    description: 'Browse living open source projects on Bloom. Contribute ideas and watch AI agents build them.',
  },
}

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
