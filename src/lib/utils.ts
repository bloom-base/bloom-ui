/**
 * Shared utilities for the Bloom frontend.
 */

/**
 * Validate password strength. Returns error message or null if valid.
 */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.'
  return null
}

/**
 * Check if a password meets all strength requirements.
 */
export function isPasswordStrong(password: string): boolean {
  return validatePassword(password) === null
}

/**
 * Truncate a string in the middle, preserving start and end.
 */
export function truncateMiddle(s: string, max: number): string {
  if (s.length <= max) return s
  const half = Math.floor((max - 3) / 2)
  return s.slice(0, half) + '...' + s.slice(-half)
}

/**
 * Clean up raw tool names for display.
 * e.g. mcp__bloom__create_pr → "Create PR", read_file → "Read"
 */
export function formatToolName(raw: string): string {
  // Strip MCP namespace prefix
  let name = raw.replace(/^mcp__[\w-]+__/, '')

  const aliases: Record<string, string> = {
    create_pr: 'Create PR',
    request_review: 'Request Review',
    report_issue: 'Report Issue',
    ask_maintainer: 'Ask Maintainer',
    task_complete: 'Task Complete',
    get_pr_comments: 'PR Comments',
    reply_to_comment: 'Reply to Comment',
    get_knowledge: 'Get Knowledge',
    save_knowledge: 'Save Knowledge',
    get_code_context: 'Code Context',
    search_project: 'Search Project',
    get_active_work: 'Active Work',
    approve_and_merge: 'Approve & Merge',
    request_changes: 'Request Changes',
  }

  if (aliases[name]) return aliases[name]

  // Generic: snake_case → Title Case
  return name
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Format all tool input parameters for display.
 * Shows every parameter as key=value, truncating long values.
 */
export function formatToolArgs(input: Record<string, unknown> | undefined): string {
  if (!input) return ''
  const parts: string[] = []
  for (const [key, val] of Object.entries(input)) {
    if (val === undefined || val === null || val === '') continue
    const str = typeof val === 'string' ? val : JSON.stringify(val)
    parts.push(`${key}=${truncateMiddle(str, 60)}`)
  }
  return parts.join(', ')
}

/**
 * Convert an ISO date string to a human-readable relative time.
 *
 * Examples: "just now", "5m ago", "3h ago", "2d ago", "1w ago", "3mo ago", "1y ago"
 */
export function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(months / 12)
  return `${years}y ago`
}
