'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface ProjectNavProps {
  owner: string
  repo: string
  isOwner?: boolean
}

const TABS = [
  { key: 'overview', label: 'Overview', path: '' },
  { key: 'chat', label: 'Chat', path: '/chat' },
  { key: 'search', label: 'Search', path: '/search' },
  { key: 'knowledge', label: 'Knowledge', path: '/knowledge' },
  { key: 'analytics', label: 'Analytics', path: '/analytics' },
  { key: 'sponsor', label: 'Sponsor', path: '/sponsor' },
  { key: 'council', label: 'Governance', path: '/council' },
] as const

export default function ProjectNav({ owner, repo, isOwner }: ProjectNavProps) {
  const pathname = usePathname()
  const basePath = `/${owner}/${repo}`

  const allTabs = isOwner
    ? [...TABS, { key: 'settings', label: 'Settings', path: '/settings' } as const]
    : TABS

  const isActive = (tabPath: string) => {
    const fullPath = `${basePath}${tabPath}`
    if (tabPath === '') {
      return pathname === basePath || pathname === `${basePath}/`
    }
    return pathname === fullPath || pathname.startsWith(`${fullPath}/`)
  }

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 mb-8">
      <div className="flex gap-1 overflow-x-auto -mb-px">
        {allTabs.map(tab => (
          <Link
            key={tab.key}
            href={`${basePath}${tab.path}`}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
              isActive(tab.path)
                ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
