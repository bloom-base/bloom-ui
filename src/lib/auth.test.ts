import { buildGitHubAuthPath, buildLoginPath } from './auth'

describe('buildGitHubAuthPath', () => {
  it('returns bare auth path without redirect', () => {
    expect(buildGitHubAuthPath()).toBe('/api/auth/github')
  })

  it('includes a valid same-origin redirect path', () => {
    expect(buildGitHubAuthPath('/profile')).toBe('/api/auth/github?redirect=%2Fprofile')
  })

  it('drops unsafe redirect values', () => {
    expect(buildGitHubAuthPath('https://evil.com')).toBe('/api/auth/github')
    expect(buildGitHubAuthPath('//evil.com')).toBe('/api/auth/github')
  })
})

describe('buildLoginPath', () => {
  it('returns bare login path without returnTo', () => {
    expect(buildLoginPath()).toBe('/auth/login')
  })

  it('includes returnTo query param for valid paths', () => {
    expect(buildLoginPath('/profile')).toBe('/auth/login?returnTo=%2Fprofile')
  })

  it('drops unsafe returnTo values', () => {
    expect(buildLoginPath('https://evil.com')).toBe('/auth/login')
    expect(buildLoginPath('//evil.com')).toBe('/auth/login')
  })

  it('handles nested paths', () => {
    expect(buildLoginPath('/bloom-base/genesis/chat')).toBe(
      '/auth/login?returnTo=%2Fbloom-base%2Fgenesis%2Fchat'
    )
  })
})
