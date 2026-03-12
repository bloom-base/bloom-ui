# Bloom API Reference

Base URL: `https://api.bloomit.ai`

Interactive docs: `https://api.bloomit.ai/docs` (Swagger UI)

All endpoints return JSON. Authentication is via HTTP-only `bloom_session` cookie. Endpoints marked **(auth)** require a valid session.

---

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| GET | `/ready` | Deep readiness (DB + Redis) |

---

## Auth

### Account

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register with email/password |
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/logout` | End session |
| POST | `/auth/verify-email` | Verify email with token |
| POST | `/auth/resend-verification` | Resend verification email **(auth)** |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password with token |

### GitHub OAuth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/github` | GitHub OAuth login/callback |
| POST | `/auth/link-github` | Link GitHub to existing account **(auth)** |
| GET | `/auth/github/me` | Get GitHub profile **(auth)** |
| GET | `/auth/github/repos` | List user's GitHub repos **(auth)** |
| POST | `/auth/github/repos` | Create a new GitHub repo **(auth)** |

### User Profile

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/users/me` | Get current user profile **(auth)** |
| GET | `/auth/users/{username}/public` | Get public user profile |
| PUT | `/auth/users/me/username` | Update username **(auth)** |
| PUT | `/auth/users/me/profile` | Update profile info **(auth)** |
| PUT | `/auth/users/me/password` | Change password **(auth)** |
| DELETE | `/auth/users/me` | Delete account **(auth)** |
| GET | `/auth/users/me/contributions` | Get contributions **(auth)** |
| GET | `/auth/users/me/dashboard` | Get dashboard data **(auth)** |
| GET | `/auth/username/available` | Check username availability |

### API Key (BYOK)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/users/me/api-key` | Get API key status **(auth)** |
| PUT | `/auth/users/me/api-key` | Set Anthropic API key **(auth)** |
| DELETE | `/auth/users/me/api-key` | Remove API key **(auth)** |

### Notifications Settings

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/auth/users/me/notifications` | Update notification preferences **(auth)** |

---

## Projects

### CRUD

| Method | Path | Description |
|--------|------|-------------|
| POST | `/projects` | Create project (Pro only) **(auth)** |
| GET | `/projects` | List user's projects **(auth)** |
| GET | `/projects/{project_id}` | Get project details |
| PATCH | `/projects/{project_id}` | Update project **(auth)** |
| DELETE | `/projects/{project_id}` | Delete project **(auth)** |
| GET | `/projects/by-path/{owner}/{repo}` | Get project by GitHub path |

### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/public` | List all public projects |
| GET | `/projects/public/activity` | Public activity feed |
| GET | `/projects/public/live` | Live updates from public projects |

### Fork

| Method | Path | Description |
|--------|------|-------------|
| POST | `/projects/{project_id}/fork` | Fork a public project (Pro only) **(auth)** |

### Members

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/{project_id}/members` | List members |
| POST | `/projects/{project_id}/members` | Invite member **(auth)** |
| DELETE | `/projects/{project_id}/members/{user_id}` | Remove member **(auth)** |

### Followers

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/{project_id}/follow` | Check follow status **(auth)** |
| POST | `/projects/{project_id}/follow` | Follow project **(auth)** |
| DELETE | `/projects/{project_id}/follow` | Unfollow project **(auth)** |

### Metadata

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/{project_id}/readme` | Get project README |
| GET | `/projects/{project_id}/contributors` | List top contributors |
| GET | `/projects/{project_id}/active-tasks` | Get active tasks |

### Task Ledger

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/{project_id}/ledger` | Get task ledger (paginated) |
| GET | `/projects/{project_id}/search` | Search within project |

### Deployment

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/{project_id}/deployment` | Get deployment status |
| GET | `/projects/{project_id}/deploy-status` | Check deploy status |
| GET | `/projects/{project_id}/deployments` | Deployment history (paginated) |
| PATCH | `/projects/{project_id}/deployed-url` | Update deployed URL **(auth)** |

### Webhook

| Method | Path | Description |
|--------|------|-------------|
| POST | `/projects/{project_id}/webhook/setup` | Configure GitHub webhook **(auth)** |

### Knowledge Base

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/{project_id}/knowledge` | List entries (paginated) |
| GET | `/projects/{project_id}/knowledge/{entry_id}` | Get entry |
| POST | `/projects/{project_id}/knowledge` | Create entry **(auth)** |
| PATCH | `/projects/{project_id}/knowledge/{entry_id}` | Update entry **(auth)** |
| DELETE | `/projects/{project_id}/knowledge/{entry_id}` | Delete entry **(auth)** |

### Evaluations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/{project_id}/evals` | Get task evaluation results |

### Secrets

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/{project_id}/secrets` | List secret names **(auth)** |
| PUT | `/projects/{project_id}/secrets/{name}` | Set/update secret **(auth)** |
| DELETE | `/projects/{project_id}/secrets/{name}` | Delete secret **(auth)** |

### Sponsorship

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/{project_id}/sponsors` | List project sponsors |
| GET | `/projects/{project_id}/sponsors/active` | Get active sponsor info **(auth)** |

---

## Conversations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/conversations/projects/{project_id}/conversations` | Create conversation **(auth)** |
| GET | `/conversations/projects/{project_id}/conversations` | List conversations (paginated) |
| GET | `/conversations/{conversation_id}` | Get conversation with messages |
| DELETE | `/conversations/{conversation_id}` | Delete conversation **(auth)** |
| POST | `/conversations/{conversation_id}/messages` | Send message **(auth)** |
| POST | `/conversations/{conversation_id}/messages/stream` | Send message (SSE streaming) **(auth)** |
| GET | `/conversations/{conversation_id}/tasks` | Get tasks from conversation |

---

## Tasks

### Status

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks/queue/status` | Queue status |
| GET | `/tasks/{task_id}` | Get task details |
| GET | `/tasks/{task_id}/status` | Get task status |

### Control

| Method | Path | Description |
|--------|------|-------------|
| POST | `/tasks/{task_id}/approve` | Approve task **(auth)** |
| POST | `/tasks/{task_id}/reject` | Reject task **(auth)** |
| POST | `/tasks/{task_id}/cancel` | Cancel task **(auth)** |
| POST | `/tasks/{task_id}/pause` | Pause task **(auth)** |
| POST | `/tasks/{task_id}/resume` | Resume task **(auth)** |
| POST | `/tasks/{task_id}/fund` | Fund task **(auth)** |
| POST | `/tasks/{task_id}/guide` | Send guidance to running task **(auth)** |

### PRs & Work

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks/{task_id}/prs` | Get all PRs for task |
| GET | `/tasks/{task_id}/prs/{pr_number}/files` | Get PR file changes with diffs |

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks/{task_id}/cost` | Real-time cost breakdown |
| GET | `/tasks/{task_id}/eval` | Quality evaluation scores |
| GET | `/tasks/{task_id}/progress` | Agent reasoning logs |
| GET | `/tasks/{task_id}/stream` | Stream task events (SSE) |

---

## Billing

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/me/billing` | Get billing info **(auth)** |
| GET | `/users/me/billing/usage` | Get usage for period **(auth)** |
| GET | `/users/me/billing/invoices` | List invoices **(auth)** |
| POST | `/users/me/billing/checkout` | Create Stripe checkout **(auth)** |

### Sponsorship Checkout

| Method | Path | Description |
|--------|------|-------------|
| POST | `/users/me/billing/sponsor` | Create sponsorship checkout **(auth)** |

---

## Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/tokens/timeseries` | Token usage time-series **(auth)** |
| GET | `/analytics/tasks/{task_id}` | Task analytics **(auth)** |
| GET | `/analytics/projects/{project_id}` | Project analytics **(auth)** |
| GET | `/analytics/platform` | Platform analytics **(auth)** |
| GET | `/analytics/models/comparison` | Model comparison **(auth)** |

---

## Memory

| Method | Path | Description |
|--------|------|-------------|
| GET | `/memory/projects/{project_id}/reasoning/task/{task_id}` | Reasoning logs for task |
| GET | `/memory/projects/{project_id}/reasoning/pr/{pr_number}` | Reasoning logs for PR |
| GET | `/memory/projects/{project_id}/reasoning/file` | Reasoning logs for file |
| GET | `/memory/projects/{project_id}/code-history` | Code change history |
| GET | `/memory/projects/{project_id}/code-context` | Full editing context |
| GET | `/memory/projects/{project_id}/pr/{pr_number}/stats` | PR statistics |
| GET | `/memory/projects/{project_id}/telemetry/tokens` | Project token usage |
| GET | `/memory/projects/{project_id}/tasks/{task_id}/telemetry/tokens` | Task token usage |

---

## Embeddings

| Method | Path | Description |
|--------|------|-------------|
| POST | `/embeddings/projects/{project_id}/embeddings/search` | Semantic search |
| GET | `/embeddings/projects/{project_id}/embeddings/stats` | Embedding stats |
| POST | `/embeddings/projects/{project_id}/embeddings/index` | Index project **(auth)** |

---

## Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications` | List notifications **(auth)** |
| GET | `/notifications/unread-count` | Unread count **(auth)** |
| POST | `/notifications/{notification_id}/read` | Mark read **(auth)** |
| POST | `/notifications/read-all` | Mark all read **(auth)** |

---

## Webhooks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks/github` | GitHub webhook handler |

---

## Common Patterns

### Pagination

Most list endpoints accept `?page=1&per_page=20` query params and return:

```json
{
  "items": [...],
  "total": 42,
  "page": 1,
  "per_page": 20,
  "pages": 3
}
```

### SSE Streaming

Streaming endpoints (`/messages/stream`, `/tasks/{id}/stream`) return Server-Sent Events:

```
event: message
data: {"type": "text", "content": "..."}

event: tool_use
data: {"type": "tool_use", "name": "read_file", "input": {...}}

event: done
data: {"type": "done"}
```

### Error Responses

```json
{
  "detail": "Error description"
}
```

Standard HTTP status codes: 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 429 (rate limited).
