import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/profile', '/auth/', '/new'],
      },
    ],
    sitemap: 'https://bloomit.ai/sitemap.xml',
  }
}
