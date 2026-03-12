import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Your project activity notifications — task updates, PR events, and shipped features.',
}

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
