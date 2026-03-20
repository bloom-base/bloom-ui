const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface Project {
  id: string
  name: string
  description: string
  github_repo: string
  owner_id: string
  is_public: boolean
  vision: string
  deployed_url: string | null
  deploy_status: 'pending' | 'deploying' | 'deployed' | 'failed' | null
  fly_app_name: string | null
  deploy_error: string | null
  max_parallel_tasks: number | null
  auto_improve: boolean
  github_app_connected: boolean
  created_at: string
}

export interface ActiveTasksStatus {
  active_count: number
  queued_count: number
  max_parallel_tasks: number
  has_capacity: boolean
}

export interface LedgerTask {
  id: string
  project_id: string
  title: string
  description: string
  status: 'proposed' | 'accepted' | 'in_progress' | 'paused' | 'completed' | 'incomplete' | 'rejected' | 'cancelled'
  priority: number
  proposed_by: string
  conversation_id: string | null
  github_pr_url: string | null
  current_stage: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  paused_at: string | null
  error_message: string | null
}

export interface TaskPR {
  pr_number: number
  pr_url: string
  stage_number: number
  stage_title: string | null
  done_summary: string | null
  is_final: boolean
  status: 'open' | 'merged' | 'closed'
  created_at: string | null
  merged_at: string | null
}

export interface Conversation {
  id: string
  project_id: string
  user_id: string
  outcome: 'task_created' | 'forked' | 'rejected' | 'ongoing'
  preview: string | null
  created_at: string
  messages?: Message[]
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  created_at: string
  // Tool call fields (optional)
  tool_name?: string
  tool_input?: string  // JSON string
  tool_output?: string
  task_id?: string
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || `API error: ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

// Projects
export async function getProjects(limit = 50, offset = 0): Promise<PaginatedResponse<Project>> {
  return fetchAPI<PaginatedResponse<Project>>(`/projects?limit=${limit}&offset=${offset}`)
}

export interface PublicProject {
  id: string
  name: string
  description: string
  github_repo: string
  vision: string
  is_public: boolean
  deployed_url: string | null
  deploy_status: string | null
  in_progress: number
  queued: number
  completed: number
  created_at: string
  last_activity_at: string | null
}

export async function getPublicProjects(limit = 50, offset = 0): Promise<PaginatedResponse<PublicProject>> {
  return fetchAPI<PaginatedResponse<PublicProject>>(`/projects/public?limit=${limit}&offset=${offset}`)
}

export interface ActivityEvent {
  type: 'shipped' | 'building' | 'pr_created'
  title: string
  project_name: string
  project_github_repo: string
  github_pr_url: string | null
  timestamp: string
}

export async function getPublicActivity(limit: number = 15): Promise<ActivityEvent[]> {
  return fetchAPI<ActivityEvent[]>(`/projects/public/activity?limit=${limit}`)
}

export interface LiveTask {
  id: string
  title: string
  project_name: string
  project_repo: string
  started_at: string | null
  pr_url?: string
  completed_at?: string | null
}

export interface PlatformLive {
  active_tasks: LiveTask[]
  recent_completions: LiveTask[]
  stats: {
    active: number
    completed: number
    queued: number
  }
}

export async function getPublicLive(): Promise<PlatformLive> {
  return fetchAPI<PlatformLive>('/projects/public/live')
}

export async function getProject(id: string): Promise<Project> {
  return fetchAPI<Project>(`/projects/${id}`)
}

export async function getProjectByPath(owner: string, repo: string): Promise<Project> {
  return fetchAPI<Project>(`/projects/by-path/${owner}/${repo}`)
}

export async function createProject(data: {
  name: string
  description: string
  github_repo: string
  vision: string
  is_public: boolean
}): Promise<Project> {
  return fetchAPI<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function forkProject(projectId: string, name?: string): Promise<Project> {
  return fetchAPI<Project>(`/projects/${projectId}/fork`, {
    method: 'POST',
    body: JSON.stringify({ name: name || null }),
  })
}

export async function updateProject(projectId: string, data: {
  name?: string
  description?: string
  vision?: string
  is_public?: boolean
  max_parallel_tasks?: number | null
  auto_improve?: boolean
}): Promise<Project> {
  return fetchAPI<Project>(`/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteProject(projectId: string): Promise<void> {
  await fetchAPI<void>(`/projects/${projectId}`, { method: 'DELETE' })
}

export async function getProjectLedger(projectId: string, limit = 50, offset = 0): Promise<PaginatedResponse<LedgerTask>> {
  return fetchAPI<PaginatedResponse<LedgerTask>>(`/projects/${projectId}/ledger?limit=${limit}&offset=${offset}`)
}

export async function getActiveTasksStatus(projectId: string): Promise<ActiveTasksStatus> {
  return fetchAPI<ActiveTasksStatus>(`/projects/${projectId}/active-tasks`)
}

export interface ProjectContributor {
  username: string
  display_name: string | null
  avatar_url: string | null
  ideas: number
  shipped: number
}

export async function getProjectContributors(projectId: string): Promise<ProjectContributor[]> {
  return fetchAPI<ProjectContributor[]>(`/projects/${projectId}/contributors`)
}

// Project Follow
export interface FollowStatus {
  following: boolean
  follower_count: number
}

export async function getFollowStatus(projectId: string): Promise<FollowStatus> {
  return fetchAPI<FollowStatus>(`/projects/${projectId}/follow`)
}

export async function followProject(projectId: string): Promise<FollowStatus> {
  return fetchAPI<FollowStatus>(`/projects/${projectId}/follow`, { method: 'POST' })
}

export async function unfollowProject(projectId: string): Promise<FollowStatus> {
  return fetchAPI<FollowStatus>(`/projects/${projectId}/follow`, { method: 'DELETE' })
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: 'admin' | 'member'
  github_username: string
  created_at: string
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  return fetchAPI<ProjectMember[]>(`/projects/${projectId}/members`)
}

export async function inviteProjectMember(projectId: string, githubUsername: string, role: 'admin' | 'member' = 'member'): Promise<ProjectMember> {
  return fetchAPI<ProjectMember>(`/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify({ github_username: githubUsername, role }),
  })
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  await fetchAPI<void>(`/projects/${projectId}/members/${userId}`, {
    method: 'DELETE',
  })
}


export interface DeployStatus {
  deploy_status: 'pending' | 'deploying' | 'deployed' | 'failed' | null
  deployed_url: string | null
  fly_app_name: string | null
  deploy_error: string | null
}

export async function getDeployStatus(projectId: string): Promise<DeployStatus> {
  return fetchAPI<DeployStatus>(`/projects/${projectId}/deploy-status`)
}

// Deployment history
export interface DeploymentHistoryItem {
  id: string
  commit_sha: string
  environment: string
  status: string
  fly_app_id: string | null
  public_url: string | null
  created_at: string
  deployed_at: string | null
}

export async function getDeployments(projectId: string, limit = 10, offset = 0): Promise<PaginatedResponse<DeploymentHistoryItem>> {
  return fetchAPI<PaginatedResponse<DeploymentHistoryItem>>(`/projects/${projectId}/deployments?limit=${limit}&offset=${offset}`)
}

// Conversations
export async function listConversations(projectId: string, limit = 50, offset = 0): Promise<{ items: Conversation[], total: number }> {
  return fetchAPI<{ items: Conversation[], total: number }>(`/conversations/projects/${projectId}/conversations?limit=${limit}&offset=${offset}`)
}

export async function createConversation(projectId: string): Promise<Conversation> {
  return fetchAPI<Conversation>(`/conversations/projects/${projectId}/conversations`, {
    method: 'POST',
  })
}

export async function getConversation(id: string): Promise<Conversation> {
  return fetchAPI<Conversation>(`/conversations/${id}`)
}

export async function getConversationTasks(conversationId: string): Promise<LedgerTask[]> {
  return fetchAPI<LedgerTask[]>(`/conversations/${conversationId}/tasks`)
}

export async function deleteConversation(id: string): Promise<void> {
  await fetchAPI(`/conversations/${id}`, { method: 'DELETE' })
}

export interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'event' | 'error'
  content?: string
  tool?: string
  input?: Record<string, unknown>
  output?: string  // Tool execution output
  event?: string
  task?: {
    id: string
    title: string
    description: string
    priority: number
    status: string
  }
  fork_name?: string
  reason?: string
}

function parseSSEDataFrames(chunkBuffer: string): { frames: string[]; remainder: string } {
  const normalized = chunkBuffer.replace(/\r\n/g, '\n')
  const frames: string[] = []
  let remainder = normalized

  while (true) {
    const boundary = remainder.indexOf('\n\n')
    if (boundary === -1) break

    const rawEvent = remainder.slice(0, boundary)
    remainder = remainder.slice(boundary + 2)

    const dataLines = rawEvent
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())

    if (dataLines.length > 0) {
      frames.push(dataLines.join('\n'))
    }
  }

  return { frames, remainder }
}

// Vision writing assistant

export interface VisionAssistMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function streamVisionAssist(
  projectName: string,
  messages: VisionAssistMessage[],
  onText: (text: string) => void,
  signal?: AbortSignal,
  opts?: { description?: string; repoName?: string }
): Promise<void> {
  const response = await fetch(`${API_URL}/projects/vision-assist`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_name: projectName,
      project_description: opts?.description || '',
      repo_name: opts?.repoName || '',
      messages,
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const { frames, remainder } = parseSSEDataFrames(buffer)
    buffer = remainder

    for (const data of frames) {
      if (data === '[DONE]') return
      try {
        const parsed = JSON.parse(data)
        if (parsed.type === 'text' && parsed.content) {
          onText(parsed.content)
        }
      } catch {
        // Ignore malformed frames
      }
    }
  }
}

export async function sendMessageStream(
  conversationId: string,
  content: string,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(
    `${API_URL}/conversations/${conversationId}/messages/stream`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
      signal,
    }
  )

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const { frames, remainder } = parseSSEDataFrames(buffer)
    buffer = remainder

    for (const data of frames) {
      if (data === '[DONE]') {
        return
      }
      try {
        const parsed = JSON.parse(data) as StreamEvent
        onEvent(parsed)
      } catch {
        // Ignore malformed non-JSON frames from intermediaries.
      }
    }
  }

  // Handle final unterminated frame if present.
  const tail = buffer.trim()
  if (tail.startsWith('data:')) {
    const data = tail.slice(5).trim()
    if (data && data !== '[DONE]') {
      try {
        const parsed = JSON.parse(data) as StreamEvent
        onEvent(parsed)
      } catch {
        // Ignore malformed trailing data.
      }
    }
  }
}

// Tasks

export interface TaskStreamEvent {
  type: 'connected' | 'turn' | 'turn_start' | 'thinking' | 'agent_text' | 'tool_call' | 'tool_output' | 'tool_result' | 'complete' | 'stream_end' | 'pause_requested' | 'paused' | 'resumed' | 'guidance' | 'guidance_received' | 'reviewing' | 'review_stage' | 'deploying' | 'lifecycle'
  task_id?: string
  turn?: number
  max_turns?: number
  agent_type?: string  // For stored progress (e.g., 'CODER', 'REVIEWER')
  text?: string
  tool?: string
  input?: Record<string, unknown>
  output?: string  // Real-time output from bash tool
  result?: string
  status?: string
  pr_url?: string
  message?: string
  event?: string  // For lifecycle events (e.g., 'setup_cloning', 'agent_started')
  stage?: string  // For review_stage events (e.g., 'running_tests')
  agent?: string  // 'reviewer' for reviewer text, absent for coder
  thinking?: string  // For turn records from DB replay
  tool_calls?: Array<Record<string, unknown>>  // For turn records from DB replay
  total_cost_usd?: number  // Running cost piggybacked on every event
}

export function streamTaskEvents(
  taskId: string,
  onEvent: (event: TaskStreamEvent) => void,
  signal?: AbortSignal,
  onError?: (error: Error) => void,
  onClose?: () => void,
): void {
  const url = `${API_URL}/tasks/${taskId}/stream`
  let receivedComplete = false

  fetch(url, {
    credentials: 'include',
    signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`API error: ${response.status}`)
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const { frames, remainder } = parseSSEDataFrames(buffer)
        buffer = remainder

        for (const data of frames) {
          if (!data || data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data) as TaskStreamEvent
            if (parsed.type === 'complete' || parsed.type === 'stream_end') {
              receivedComplete = true
            }
            onEvent(parsed)
          } catch {
            // Ignore malformed non-JSON frames.
          }
        }
      }

      const tail = buffer.trim()
      if (tail.startsWith('data:')) {
        const data = tail.slice(5).trim()
        if (data && data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data) as TaskStreamEvent
            if (parsed.type === 'complete' || parsed.type === 'stream_end') {
              receivedComplete = true
            }
            onEvent(parsed)
          } catch {
            // Ignore malformed trailing data.
          }
        }
      }

      // Stream ended — notify caller if we never got a completion event
      // (e.g., API restarted, connection dropped during deploy)
      if (!receivedComplete) {
        onClose?.()
      }
    })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        onError?.(error)
      }
    })
}

// User event stream — replaces all polling
export interface UserEvent {
  type: 'connected' | 'task:status_changed' | 'notification:new' | 'deploy:status_changed'
  task_id?: string
  project_id?: string
  status?: string
  title?: string
  project_name?: string
  notification_type?: string
  body?: string
  deployed_url?: string
  error?: string
}

export function streamUserEvents(
  onEvent: (event: UserEvent) => void,
  signal?: AbortSignal,
  onError?: (error: Error) => void
): void {
  const url = `${API_URL}/user/events/stream`

  fetch(url, {
    credentials: 'include',
    signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`API error: ${response.status}`)
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const { frames, remainder } = parseSSEDataFrames(buffer)
        buffer = remainder

        for (const data of frames) {
          if (!data || data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data) as UserEvent
            onEvent(parsed)
          } catch {
            // Ignore malformed frames
          }
        }
      }
    })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        onError?.(error)
      }
    })
}

export interface QueueStatus {
  queue_counts: Record<string, number>
  current_task: { id: string; title: string; project_id: string; started_at: string | null } | null
  active_tasks: { id: string; title: string; project_id: string; started_at: string | null }[]
  total_pending: number
}

export async function getQueueStatus(): Promise<QueueStatus> {
  return fetchAPI('/tasks/queue/status')
}


// GitHub (server-side proxy via backend)
export async function getGitHubRepos(): Promise<Array<{
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  html_url: string
  language: string | null
  stargazers_count: number
  updated_at: string
}>> {
  return fetchAPI('/auth/github/repos')
}

export async function getGitHubUser(): Promise<{
  id: number
  login: string
  avatar_url: string
  email: string | null
}> {
  return fetchAPI('/auth/github/me')
}

export async function createGitHubRepo(data: {
  name: string
  description?: string
  private?: boolean
  auto_init?: boolean
}): Promise<{
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  html_url: string
  language: string | null
  stargazers_count: number
  updated_at: string
}> {
  return fetchAPI('/auth/github/repos', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function cancelTask(taskId: string): Promise<{ message: string }> {
  return fetchAPI(`/tasks/${taskId}/cancel`, { method: 'POST' })
}

export async function pauseTask(taskId: string): Promise<{ message: string; status: string }> {
  return fetchAPI(`/tasks/${taskId}/pause`, { method: 'POST' })
}

export async function resumeTask(taskId: string): Promise<{ message: string; status: string }> {
  return fetchAPI(`/tasks/${taskId}/resume`, { method: 'POST' })
}

export async function sendTaskGuidance(taskId: string, message: string): Promise<{ message: string }> {
  return fetchAPI(`/tasks/${taskId}/guide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
}

export async function approveTask(taskId: string): Promise<{ message: string; status: string }> {
  return fetchAPI(`/tasks/${taskId}/approve`, { method: 'POST' })
}

export async function rejectTask(taskId: string): Promise<{ message: string; status: string }> {
  return fetchAPI(`/tasks/${taskId}/reject`, { method: 'POST' })
}

export async function getTaskProgress(taskId: string): Promise<TaskStreamEvent[]> {
  return fetchAPI(`/tasks/${taskId}/progress`)
}

export async function getTaskPRs(taskId: string): Promise<TaskPR[]> {
  return fetchAPI<TaskPR[]>(`/tasks/${taskId}/prs`)
}

export interface PRFileChange {
  filename: string
  status: string
  additions: number
  deletions: number
  patch: string
}

export async function getTaskPRFiles(taskId: string, prNumber: number): Promise<PRFileChange[]> {
  return fetchAPI<PRFileChange[]>(`/tasks/${taskId}/prs/${prNumber}/files`)
}

// User
export interface UserProfile {
  id: string
  username: string
  handle: string | null
  display_name: string | null
  bio: string | null
  github_username: string | null
  email: string | null
  avatar_url: string | null
  subscription_tier: 'free' | 'pro' | 'enterprise'
  is_admin: boolean
  has_anthropic_key: boolean
  email_verified: boolean
  has_github: boolean
  has_password: boolean
  email_notifications: boolean
}

export async function getCurrentUser(): Promise<UserProfile> {
  return fetchAPI<UserProfile>('/auth/users/me')
}

export async function updateProfile(data: { display_name?: string; bio?: string }): Promise<{ message: string }> {
  return fetchAPI<{ message: string }>('/auth/users/me/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export interface Contribution {
  id: string
  title: string
  description: string
  status: 'proposed' | 'accepted' | 'in_progress' | 'paused' | 'completed' | 'incomplete' | 'rejected' | 'cancelled'
  priority: number
  github_pr_url: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  project_name: string
  project_github_repo: string
}

export async function getMyContributions(limit = 50, offset = 0): Promise<PaginatedResponse<Contribution>> {
  return fetchAPI<PaginatedResponse<Contribution>>(`/auth/users/me/contributions?limit=${limit}&offset=${offset}`)
}

// Public profiles
export interface ProfileProject {
  id: string
  name: string
  description: string | null
  github_repo: string
}

export interface PublicProfile {
  username: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  github_username: string | null
  created_at: string
  projects: ProfileProject[]
  contributions: Contribution[]
}

export async function getPublicProfile(username: string): Promise<PublicProfile> {
  return fetchAPI<PublicProfile>(`/auth/users/${encodeURIComponent(username)}/public`)
}

// Email auth
export interface AuthResponse {
  access_token: string
  token_type: string
  user: {
    id: string
    github_id: string | null
    github_username: string | null
    username: string
    email: string | null
    avatar_url: string | null
    email_verified: boolean
    has_github: boolean
  }
}

export async function registerWithEmail(data: {
  email: string
  password: string
  display_name?: string
  username?: string
}): Promise<AuthResponse> {
  return fetchAPI<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function loginWithEmail(data: {
  email: string
  password: string
}): Promise<AuthResponse> {
  return fetchAPI<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return fetchAPI<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return fetchAPI<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  return fetchAPI<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`, {
    method: 'POST',
  })
}

export async function resendVerification(): Promise<{ message: string }> {
  return fetchAPI<{ message: string }>('/auth/resend-verification', {
    method: 'POST',
  })
}

export async function linkGitHub(accessToken: string): Promise<AuthResponse> {
  return fetchAPI<AuthResponse>('/auth/link-github', {
    method: 'POST',
    body: JSON.stringify({ access_token: accessToken }),
  })
}

export async function setPassword(password: string): Promise<{ message: string }> {
  return fetchAPI<{ message: string }>('/auth/users/me/password', {
    method: 'PUT',
    body: JSON.stringify({ password }),
  })
}

export async function checkUsernameAvailable(username: string): Promise<{
  username: string
  available: boolean
  error: string | null
}> {
  return fetchAPI(`/auth/username/available?username=${encodeURIComponent(username)}`)
}

export async function setUsername(username: string): Promise<{ message: string }> {
  return fetchAPI<{ message: string }>('/auth/users/me/username', {
    method: 'PUT',
    body: JSON.stringify({ username }),
  })
}

export async function updateNotificationSettings(emailNotifications: boolean): Promise<{ message: string }> {
  return fetchAPI<{ message: string }>('/auth/users/me/notifications', {
    method: 'PUT',
    body: JSON.stringify({ email_notifications: emailNotifications }),
  })
}

// API Key Management
export interface ApiKeyStatus {
  has_key: boolean
  key_preview: string | null
}

export async function getApiKeyStatus(): Promise<ApiKeyStatus> {
  return fetchAPI<ApiKeyStatus>('/auth/users/me/api-key')
}

export async function setApiKey(api_key: string): Promise<ApiKeyStatus> {
  return fetchAPI<ApiKeyStatus>('/auth/users/me/api-key', {
    method: 'PUT',
    body: JSON.stringify({ api_key }),
  })
}

export async function deleteApiKey(): Promise<ApiKeyStatus> {
  return fetchAPI<ApiKeyStatus>('/auth/users/me/api-key', {
    method: 'DELETE',
  })
}

export async function deleteAccount(): Promise<void> {
  await fetchAPI<void>('/auth/users/me', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation: 'DELETE' }),
  })
}

// Analytics
export interface TaskAnalytics {
  task_id: string
  title: string
  status: string
  duration_seconds: number | null
  tokens_in: number
  tokens_out: number
  total_cost_usd: number
  turns: number
  models_used: string[]
  tool_calls: Record<string, number>
  cost_by_agent: Record<string, number>
}

export interface ProjectAnalytics {
  project_id: string
  project_name: string
  tasks: {
    total: number
    completed: number
    failed: number
    success_rate: number
  }
  timing: {
    avg_duration_seconds: number | null
    p50_duration_seconds: number | null
    p95_duration_seconds: number | null
  }
  cost: {
    total_cost_usd: number
    avg_cost_per_task_usd: number
    last_task_cost_usd: number | null
  }
  agents: {
    total_turns: number
    turns_by_agent: Record<string, number>
  }
  tools: {
    top_tools: Record<string, number>
  }
  models: {
    models_used: Record<string, number>
  }
}

export interface PlatformAnalytics {
  period: {
    start: string
    end: string
    days: number
  }
  tasks: {
    total: number
    completed: number
    rejected: number
    failed: number
    in_progress: number
    success_rate: number
  }
  cost: {
    total_cost_usd: number
    avg_cost_per_task_usd: number
    cost_by_model: Record<string, number>
    cost_by_agent: Record<string, number>
  }
  timing: {
    avg_duration_seconds: number
    p50_duration_seconds: number
    p95_duration_seconds: number
  }
}

export interface ModelComparison {
  period_days: number
  models: Array<{
    model: string
    total_turns: number
    avg_tokens_per_turn: number
    cost_per_turn_usd: number
    total_cost_usd: number
  }>
  recommendation: string
}

export async function getTaskAnalytics(taskId: string): Promise<TaskAnalytics> {
  return fetchAPI<TaskAnalytics>(`/analytics/tasks/${taskId}`)
}

export async function getProjectAnalytics(projectId: string): Promise<ProjectAnalytics> {
  return fetchAPI<ProjectAnalytics>(`/analytics/projects/${projectId}`)
}

export async function getPlatformAnalytics(days: number = 30): Promise<PlatformAnalytics> {
  return fetchAPI<PlatformAnalytics>(`/analytics/platform?days=${days}`)
}

export async function getModelComparison(days: number = 30): Promise<ModelComparison> {
  return fetchAPI<ModelComparison>(`/analytics/models/comparison?days=${days}`)
}

export interface TokenTimeseriesSegment {
  id: string
  title: string
  type: 'task' | 'conversation' | 'other'
  agent: string
  tokens_in: number
  tokens_out: number
  tokens_total: number
  cost_usd: number
  pr_url: string | null
}

export interface TokenTimeseriesHour {
  hour: string
  tokens_in: number
  tokens_out: number
  tokens_total: number
  cost_usd: number
  segments: TokenTimeseriesSegment[]
}

export interface TokenTimeseries {
  period_days: number
  project_id: string | null
  hours: number
  total_tokens: number
  total_cost_usd: number
  data: TokenTimeseriesHour[]
}

export async function getTokenTimeseries(days: number = 30, projectId?: string): Promise<TokenTimeseries> {
  const params = new URLSearchParams({ days: days.toString() })
  if (projectId) params.append('project_id', projectId)
  return fetchAPI<TokenTimeseries>(`/analytics/tokens/timeseries?${params}`)
}

// Billing
export interface BillingInfo {
  tier: string
  billing_email: string | null
  compute_budget_usd: number
  current_usage_usd: number
  budget_remaining_usd: number
  over_budget: boolean
  can_provision: boolean
  budget_warning: 'approaching' | 'exceeded' | null
  budget_usage_pct: number
}

export interface PricingTier {
  name: string
  price_usd: number | null
  compute_hours: number | null
  features: string[]
}

export interface PricingInfo {
  tiers: PricingTier[]
  overage_rate_usd: number
}

export interface BillingUsage {
  cpu_hours: number
  memory_gb_hours: number
  storage_gb: number
  egress_gb: number
  total_cost_usd: number
  budget_remaining_usd: number
  overage_usd: number
}

export interface Invoice {
  id: string
  period_start: string
  period_end: string
  ai_cost_usd: number
  compute_cost_usd: number
  total_usd: number
  status: string
}

export async function getBillingInfo(): Promise<BillingInfo> {
  return fetchAPI<BillingInfo>('/users/me/billing')
}

export async function getBillingUsage(): Promise<BillingUsage> {
  return fetchAPI<BillingUsage>('/users/me/billing/usage')
}

export async function getBillingInvoices(): Promise<Invoice[]> {
  return fetchAPI<Invoice[]>('/users/me/billing/invoices')
}

export async function getPricing(): Promise<PricingInfo> {
  return fetchAPI<PricingInfo>('/users/pricing')
}

export async function createProCheckout(data: {
  success_url: string
  cancel_url: string
}): Promise<{ checkout_url: string }> {
  return fetchAPI<{ checkout_url: string }>('/users/me/billing/checkout', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function createBillingPortal(data: {
  success_url: string
  cancel_url: string
}): Promise<{ portal_url: string }> {
  return fetchAPI<{ portal_url: string }>('/users/me/billing/portal', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Sponsorships
export interface Sponsorship {
  id: string
  project_id: string
  sponsor_id: string
  sponsor_username: string
  sponsor_avatar_url: string | null
  display_name: string | null
  is_company: boolean
  tier: number
  monthly_amount_usd: number
  total_contributed_usd: number
  status: string
  is_active: boolean
  started_at: string
  sponsor_vision: string | null
}

export async function getActiveSponsor(projectId: string): Promise<Sponsorship | null> {
  return fetchAPI<Sponsorship | null>(`/users/projects/${projectId}/sponsorship`)
}

export async function getProjectSponsors(projectId: string, includeInactive?: boolean): Promise<PaginatedResponse<Sponsorship>> {
  const params = new URLSearchParams()
  if (includeInactive) params.append('include_inactive', 'true')
  const qs = params.toString()
  return fetchAPI<PaginatedResponse<Sponsorship>>(`/users/projects/${projectId}/sponsors${qs ? `?${qs}` : ''}`)
}

export async function createSponsorshipCheckout(data: {
  project_id: string
  amount: number
  success_url: string
  cancel_url: string
  display_name?: string
  is_company?: boolean
}): Promise<{ checkout_url: string }> {
  return fetchAPI<{ checkout_url: string }>('/users/sponsor/checkout', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function setSponsorVision(projectId: string, vision: string): Promise<{ ok: boolean; sponsor_vision: string }> {
  return fetchAPI<{ ok: boolean; sponsor_vision: string }>(`/users/projects/${projectId}/sponsorship/vision`, {
    method: 'PUT',
    body: JSON.stringify({ vision }),
  })
}

export async function deleteSponsorVision(projectId: string): Promise<{ ok: boolean }> {
  return fetchAPI<{ ok: boolean }>(`/users/projects/${projectId}/sponsorship/vision`, {
    method: 'DELETE',
  })
}

// Agent Council (Governance)
export interface VisionProposal {
  id: string
  project_id: string
  proposer_id: string
  proposer_username: string | null
  title: string
  description: string
  proposed_vision: string
  status: 'open' | 'passed' | 'rejected' | 'expired'
  votes_for: number
  votes_against: number
  votes_abstain: number
  total_eligible_voters: number
  debate_summary: string | null
  created_at: string
  voting_deadline: string | null
  resolved_at: string | null
}

export interface DebateEntry {
  id: string
  sponsor_id: string
  position: string
  argument: string
  turn_number: number
  created_at: string
}

export interface CouncilVote {
  id: string
  voter_id: string
  choice: string
  reasoning: string
  created_at: string
}

export async function getProjectProposals(projectId: string, status?: string): Promise<VisionProposal[]> {
  const params = status ? `?proposal_status=${status}` : ''
  return fetchAPI<VisionProposal[]>(`/users/projects/${projectId}/council/proposals${params}`)
}

export async function getProposal(projectId: string, proposalId: string): Promise<VisionProposal> {
  return fetchAPI<VisionProposal>(`/users/projects/${projectId}/council/proposals/${proposalId}`)
}

export async function createProposal(projectId: string, data: {
  title: string
  description: string
  proposed_vision: string
}): Promise<VisionProposal> {
  return fetchAPI<VisionProposal>(`/users/projects/${projectId}/council/proposals`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getDebateEntries(projectId: string, proposalId: string): Promise<DebateEntry[]> {
  return fetchAPI<DebateEntry[]>(`/users/projects/${projectId}/council/proposals/${proposalId}/debate`)
}

export async function getProposalVotes(projectId: string, proposalId: string): Promise<CouncilVote[]> {
  return fetchAPI<CouncilVote[]>(`/users/projects/${projectId}/council/proposals/${proposalId}/votes`)
}

export async function voteOnProposal(projectId: string, proposalId: string, data: {
  choice: 'for' | 'against' | 'abstain'
  reasoning: string
}): Promise<CouncilVote> {
  return fetchAPI<CouncilVote>(`/users/projects/${projectId}/council/proposals/${proposalId}/vote`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Dashboard
export interface DashboardProject {
  id: string
  name: string
  description: string
  github_repo: string
  is_public: boolean
  in_progress: number
  queued: number
  completed: number
  last_activity_at: string | null
}

export interface DashboardContribution {
  id: string
  title: string
  status: 'proposed' | 'accepted' | 'in_progress' | 'paused' | 'completed' | 'rejected' | 'cancelled'
  project_name: string
  project_github_repo: string
  github_pr_url: string | null
  created_at: string
}

export interface DashboardActivity {
  type: 'shipped' | 'building' | 'pr_created' | 'idea_proposed'
  title: string
  project_name: string
  project_github_repo: string
  github_pr_url: string | null
  timestamp: string
}

export interface DashboardData {
  projects: DashboardProject[]
  contributions: DashboardContribution[]
  activity: DashboardActivity[]
  stats: {
    total_projects: number
    total_ideas: number
    total_shipped: number
    total_in_progress: number
  }
  featured_projects: DashboardProject[]
}

export async function getDashboard(): Promise<DashboardData> {
  return fetchAPI<DashboardData>('/auth/users/me/dashboard')
}

// Admin
export interface AdminSubscriberSummary {
  free: number
  pro: number
  enterprise: number
  total: number
}

export interface AdminRevenueSummary {
  pro_subscribers: number
  pro_mrr_usd: number
  sponsorship_mrr_usd: number
  total_mrr_usd: number
  total_sponsorship_revenue_usd: number
}

export interface AdminChurnEntry {
  username: string
  churned_at: string | null
  upgraded_at: string | null
}

export interface AdminChurnSummary {
  churned_last_30_days: number
  users_with_failed_payments: number
  recent_churns: AdminChurnEntry[]
}

export interface AdminBillingEvent {
  id: string
  stripe_event_id: string
  event_type: string
  username: string | null
  summary: string
  error: string | null
  processed_at: string
}

export interface AdminDashboard {
  subscribers: AdminSubscriberSummary
  revenue: AdminRevenueSummary
  churn: AdminChurnSummary
  recent_events: AdminBillingEvent[]
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  return fetchAPI<AdminDashboard>('/admin/billing/dashboard')
}

// =============================================================================
// Admin Observability
// =============================================================================

export interface StuckTask {
  task_id: string
  title: string
  started_at: string | null
  project_name: string
  age_seconds: number | null
}

export interface QueueHealth {
  proposed: number
  accepted: number
  in_progress: number
  paused: number
  oldest_accepted_age_seconds: number | null
  oldest_in_progress_age_seconds: number | null
  stuck_tasks: StuckTask[]
}

export interface DailyThroughput {
  date: string
  completed: number
  failed: number
  retried: number
  proposed: number
  accepted: number
  cancelled: number
  rejected: number
}

export interface FailedTaskEntry {
  task_id: string
  title: string
  project_name: string
  error_message: string
  retry_count: number
  started_at: string | null
  failed_at: string | null
}

export interface ObservabilityDashboard {
  queue_health: QueueHealth
  throughput: DailyThroughput[]
  duration_stats: {
    total_completed: number
    avg_seconds: number | null
    p50_seconds: number | null
    p75_seconds: number | null
    p95_seconds: number | null
    max_seconds: number | null
    under_5min: number
    under_15min: number
    under_30min: number
    over_30min: number
  }
  agent_efficiency: {
    total_evaluated: number
    avg_quality_score: number | null
    avg_completion_score: number | null
    avg_efficiency_score: number | null
    avg_cost_score: number | null
    avg_reliability_score: number | null
    avg_turns: number | null
    avg_cost_usd: number | null
    avg_tool_error_rate: number | null
    total_cost_usd: number
  }
  recent_failures: FailedTaskEntry[]
  task_totals: {
    total: number
    completed: number
    in_progress: number
    accepted: number
    proposed: number
    paused: number
    rejected: number
    cancelled: number
    failed: number
    success_rate: number
  }
}

export async function getObservabilityDashboard(days = 30): Promise<ObservabilityDashboard> {
  return fetchAPI<ObservabilityDashboard>(`/admin/observability?days=${days}`)
}

// =============================================================================
// Unified Search
// =============================================================================

export interface SearchProvenance {
  source: string
  commit_sha: string | null
  task_id: string | null
  task_title: string | null
  pr_number: number | null
  pr_url: string | null
  conversation_id: string | null
}

export interface SearchResult {
  result_type: 'code' | 'document' | 'conversation' | 'knowledge' | 'message'
  content: string
  score: number
  provenance: SearchProvenance
  file_path?: string
  start_line?: number
  end_line?: number
  language?: string
  doc_type?: string
  title?: string
  conversation_id?: string
  outcome?: string
  topics?: string[]
  category?: string
  tags?: string[]
  knowledge_id?: string
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  query: string
}

export async function searchProject(
  projectId: string,
  query: string,
  options?: { types?: string[]; limit?: number; semantic?: boolean }
): Promise<SearchResponse> {
  return fetchAPI<SearchResponse>(`/projects/${projectId}/search`, {
    method: 'POST',
    body: JSON.stringify({
      query,
      types: options?.types,
      limit: options?.limit ?? 20,
      semantic: options?.semantic ?? true,
    }),
  })
}


// ── Knowledge Base ────────────────────────────────────────────

export interface KnowledgeEntry {
  id: string
  project_id: string
  title: string
  content: string
  category: 'decision' | 'convention' | 'architecture' | 'rejected' | 'preference' | 'pattern' | 'context'
  tags: string[]
  source_type: string
  source_id: string | null
  created_by_agent: string | null
  superseded_by: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function getProjectKnowledge(
  projectId: string,
  options?: { category?: string; search?: string; limit?: number; offset?: number }
): Promise<PaginatedResponse<KnowledgeEntry>> {
  const params = new URLSearchParams()
  if (options?.category) params.append('category', options.category)
  if (options?.search) params.append('search', options.search)
  if (options?.limit) params.append('limit', options.limit.toString())
  if (options?.offset) params.append('offset', options.offset.toString())
  const qs = params.toString()
  return fetchAPI<PaginatedResponse<KnowledgeEntry>>(`/projects/${projectId}/knowledge${qs ? `?${qs}` : ''}`)
}

export async function getKnowledgeEntry(projectId: string, entryId: string): Promise<KnowledgeEntry> {
  return fetchAPI<KnowledgeEntry>(`/projects/${projectId}/knowledge/${entryId}`)
}

export async function createKnowledgeEntry(projectId: string, data: {
  title: string
  content: string
  category: string
  tags?: string[]
}): Promise<KnowledgeEntry> {
  return fetchAPI<KnowledgeEntry>(`/projects/${projectId}/knowledge`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateKnowledgeEntry(projectId: string, entryId: string, data: {
  title?: string
  content?: string
  category?: string
  tags?: string[]
}): Promise<KnowledgeEntry> {
  return fetchAPI<KnowledgeEntry>(`/projects/${projectId}/knowledge/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteKnowledgeEntry(projectId: string, entryId: string): Promise<void> {
  await fetchAPI<void>(`/projects/${projectId}/knowledge/${entryId}`, {
    method: 'DELETE',
  })
}

// ── Eval types ────────────────────────────────────────────────

export interface TaskEval {
  quality_score: number
  completion_score: number
  efficiency_score: number
  cost_score: number
  reliability_score: number
  total_turns: number
  total_tokens: number
  total_cost_usd: number
  tool_call_count: number
  tool_error_count: number
  retry_count: number
  pr_count: number
  duration_seconds: number | null
  model_used: string | null
  computed_at: string | null
}

export interface ProjectEvalSummary {
  task_count: number
  avg_quality_score: number | null
  avg_completion: number | null
  avg_efficiency: number | null
  avg_cost: number | null
  avg_reliability: number | null
  trend: number | null
  recent_evals: Array<{
    task_id: string
    quality_score: number
    completion_score: number
    efficiency_score: number
    cost_score: number
    reliability_score: number
    total_cost_usd: number
    total_turns: number
    model_used: string | null
    computed_at: string | null
  }>
}

export async function getProjectEvals(projectId: string): Promise<ProjectEvalSummary> {
  return fetchAPI<ProjectEvalSummary>(`/projects/${projectId}/evals`)
}

// ── Notifications ─────────────────────────────────────────────

export interface NotificationItem {
  id: string
  type: 'task_started' | 'pr_created' | 'task_completed' | 'task_incomplete' | 'task_accepted' | 'task_rejected'
  title: string
  body: string
  link: string | null
  is_read: boolean
  project_id: string | null
  task_id: string | null
  created_at: string
}

export interface NotificationListResponse {
  notifications: NotificationItem[]
  total: number
  unread: number
}

export interface UnreadCountResponse {
  count: number
}

export async function getNotifications(options?: {
  limit?: number
  offset?: number
  unread_only?: boolean
}): Promise<NotificationListResponse> {
  const params = new URLSearchParams()
  if (options?.limit) params.append('limit', options.limit.toString())
  if (options?.offset) params.append('offset', options.offset.toString())
  if (options?.unread_only) params.append('unread_only', 'true')
  const qs = params.toString()
  return fetchAPI<NotificationListResponse>(`/notifications${qs ? `?${qs}` : ''}`)
}

export async function getUnreadNotificationCount(): Promise<UnreadCountResponse> {
  return fetchAPI<UnreadCountResponse>('/notifications/unread-count')
}

export async function markNotificationRead(notificationId: string): Promise<{ ok: boolean }> {
  return fetchAPI<{ ok: boolean }>(`/notifications/${notificationId}/read`, {
    method: 'POST',
  })
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  return fetchAPI<{ ok: boolean }>('/notifications/read-all', {
    method: 'POST',
  })
}

// README
export interface ReadmeResponse {
  content: string | null
}

export async function getProjectReadme(projectId: string): Promise<ReadmeResponse> {
  return fetchAPI<ReadmeResponse>(`/projects/${projectId}/readme`)
}

// Task cost
export interface TaskCost {
  task_id: string
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  per_turn: Array<{
    turn: number
    input_tokens: number
    output_tokens: number
    cost_usd: number
    model: string
  }>
}

export async function getTaskCost(taskId: string): Promise<TaskCost> {
  return fetchAPI<TaskCost>(`/tasks/${taskId}/cost`)
}

// Task eval (individual)
export interface TaskEvalResponse {
  task_id: string
  eval: {
    quality_score: number
    completion_score: number
    efficiency_score: number
    cost_score: number
    reliability_score: number
    total_turns: number
    total_tokens: number
    total_cost_usd: number
    tool_call_count: number
    tool_error_count: number
    retry_count: number
    pr_count: number
    duration_seconds: number | null
    model_used: string | null
    computed_at: string | null
  } | null
}

export async function getTaskEval(taskId: string): Promise<TaskEvalResponse> {
  return fetchAPI<TaskEvalResponse>(`/tasks/${taskId}/eval`)
}
