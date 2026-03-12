import type { MetadataRoute } from 'next'

const BASE_URL = 'https://bloomit.ai'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/explore`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]

  // Fetch public projects for dynamic pages
  let projectPages: MetadataRoute.Sitemap = []
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const res = await fetch(`${API_URL}/projects/public`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    })
    if (res.ok) {
      const projects = await res.json()
      projectPages = projects.map((project: { github_repo: string; created_at: string }) => ({
        url: `${BASE_URL}/${project.github_repo}`,
        lastModified: new Date(project.created_at),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      }))
    }
  } catch {
    // Sitemap generation should never fail
  }

  return [...staticPages, ...projectPages]
}
