import type { Metadata } from 'next'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>
}): Promise<Metadata> {
  const { owner, repo } = await params

  try {
    const res = await fetch(`${API_URL}/projects/by-path/${owner}/${repo}`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    if (!res.ok) {
      return { title: `${owner}/${repo}` }
    }

    const project = await res.json()

    return {
      title: project.name,
      description: project.description || `${project.name} on Bloom — open source that builds itself`,
      openGraph: {
        title: `${project.name} | Bloom`,
        description: project.description || `Contribute ideas to ${project.name}. AI agents turn them into code.`,
        siteName: 'Bloom',
        type: 'website',
      },
      twitter: {
        card: 'summary',
        title: `${project.name} | Bloom`,
        description: project.description || `Contribute ideas to ${project.name}. AI agents turn them into code.`,
      },
    }
  } catch {
    return { title: `${owner}/${repo}` }
  }
}

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
