import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'New Project',
  description: 'Create a new AI-powered project on Bloom. Connect your GitHub repo and let agents build it.',
}

export default function NewProjectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
