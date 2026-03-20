'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  streamTaskEvents,
  cancelTask,
  pauseTask,
  resumeTask,
  sendTaskGuidance,
  type TaskStreamEvent,
  type LedgerTask,
  type QueueStatus,
  type Sponsorship,
} from '@/lib/api'
import { formatToolName, formatToolArgs, truncateMiddle } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────

/**
 * Expand a turn record (from DB replay) into granular events that the
 * existing groupEvents/rendering logic expects. Live streaming still sends
 * granular events directly — this bridges the two formats.
 */
function expandTurnRecord(turn: Record<string, unknown>): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = []
  const turnNum = turn.turn as number

  // turn_start
  events.push({ type: 'turn_start', turn: turnNum, agent: turn.agent })

  // thinking
  if (turn.thinking) {
    events.push({ type: 'thinking', turn: turnNum, text: turn.thinking, agent: turn.agent })
  }

  // agent_text
  if (turn.text) {
    events.push({ type: 'agent_text', turn: turnNum, text: turn.text, agent: turn.agent })
  }

  // tool_calls and their results
  const toolCalls = (turn.tool_calls as Array<Record<string, unknown>>) || []
  for (const tc of toolCalls) {
    events.push({
      type: 'tool_call',
      turn: turnNum,
      tool: tc.name,
      input: tc.input,
      agent: turn.agent,
    })
    events.push({
      type: 'tool_result',
      turn: turnNum,
      tool: tc.name,
      result: tc.result,
      agent: turn.agent,
    })
  }

  return events
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

// ── Types ────────────────────────────────────────────────────

interface ToolCallInfo {
  tool: string
  input: Record<string, unknown>
  completed: boolean
  result: string | null
  output: string | null
  startedAt: number  // Date.now() when this tool_call event arrived
}

interface StatusEvent {
  type: string
  text: string
  color: string
  children?: StatusEvent[]
}

interface TurnGroup {
  text: string | null
  thinking: string | null
  agent: 'coder' | 'reviewer'  // which agent produced this turn's text
  tools: ToolCallInfo[]
  status: StatusEvent[]
}

// ── Helpers ──────────────────────────────────────────────────

export function groupEvents(events: TaskStreamEvent[]): TurnGroup[] {
  const groups: TurnGroup[] = []
  let current: TurnGroup = { text: null, thinking: null, agent: 'coder', tools: [], status: [] }
  // Track which tool_result/tool_output indices have been claimed by a tool_call
  const claimedResults = new Set<number>()

  const pushCurrent = () => {
    if (current.text || current.thinking || current.tools.length > 0 || current.status.length > 0) {
      groups.push(current)
    }
  }

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]
    switch (ev.type) {
      case 'turn_start':
        pushCurrent()
        current = { text: null, thinking: null, agent: ev.agent as 'coder' | 'reviewer', tools: [], status: [] }
        break
      case 'thinking': {
        const thinkAgent = ev.agent as 'coder' | 'reviewer'
        if (thinkAgent !== current.agent && (current.text || current.tools.length > 0)) {
          pushCurrent()
          current = { text: null, thinking: null, agent: thinkAgent, tools: [], status: [] }
        }
        current.agent = thinkAgent
        current.thinking = (current.thinking || '') + (ev.text || '')
        break
      }
      case 'agent_text': {
        const textAgent = ev.agent as 'coder' | 'reviewer'
        // Agent switch — start a new group
        if (textAgent !== current.agent && (current.text || current.tools.length > 0)) {
          pushCurrent()
          current = { text: null, thinking: null, agent: textAgent, tools: [], status: [] }
        }
        current.agent = textAgent
        current.text = (current.text || '') + (ev.text || '')
        break
      }
      case 'tool_call': {
        const toolName = ev.tool || ''
        const evAgent = ev.agent as 'coder' | 'reviewer'

        // Agent switch — start a new group
        if (evAgent !== current.agent && (current.text || current.tools.length > 0)) {
          pushCurrent()
          current = { text: null, thinking: null, agent: evAgent, tools: [], status: [] }
        } else if (evAgent !== current.agent) {
          current.agent = evAgent
        }

        // TaskStop resolves the pending TaskOutput — don't render as its own line
        if (toolName === 'TaskStop') {
          const pending = current.tools.find(t => t.tool === 'TaskOutput' && !t.completed)
          if (pending) pending.completed = true
          break
        }

        let result: string | null = null
        let output: string | null = null
        let completed = false
        for (let j = i + 1; j < events.length; j++) {
          if (events[j].type === 'tool_result' && events[j].tool === toolName && !claimedResults.has(j)) {
            result = events[j].result || null
            completed = true
            claimedResults.add(j)
            break
          }
          if (events[j].type === 'tool_output' && events[j].tool === toolName && !claimedResults.has(j)) {
            output = (output || '') + (events[j].output || '')
            claimedResults.add(j)
          }
        }

        // TaskOutput is also resolved by a subsequent TaskStop tool_call
        if (toolName === 'TaskOutput' && !completed) {
          for (let j = i + 1; j < events.length; j++) {
            if (events[j].type === 'tool_call' && events[j].tool === 'TaskStop') {
              completed = true
              claimedResults.add(j)
              break
            }
          }
        }

        current.tools.push({
          tool: toolName,
          input: (ev.input as Record<string, unknown>) || {},
          completed,
          result,
          output,
          startedAt: Date.now(),
        })
        break
      }
      case 'guidance':
        current.status.push({ type: 'guidance', text: `You: ${ev.message || 'guidance sent'}`, color: 'text-blue-400' })
        break
      case 'guidance_received':
        current.status.push({ type: 'guidance_received', text: 'Guidance received', color: 'text-blue-400' })
        break
      case 'pause_requested':
        current.status.push({ type: 'pause_requested', text: 'Pause requested...', color: 'text-amber-400' })
        break
      case 'paused':
        current.status.push({ type: 'paused', text: 'Task paused', color: 'text-amber-400' })
        break
      case 'resumed':
        current.status.push({ type: 'resumed', text: 'Task resumed', color: 'text-green-400' })
        break
      case 'reviewing':
        current.status.push({
          type: 'review_parent',
          text: 'Waiting for Code Review',
          color: 'text-blue-400',
          children: [],
        })
        break
      case 'review_stage': {
        const stage = ev.stage
        const parent = current.status.find(s => s.type === 'review_parent')
        if (stage === 'running_tests' && parent?.children) {
          parent.children.push({ type: 'running_tests', text: 'Running tests', color: 'text-blue-400' })
        } else if (stage === 'code_review' && parent?.children) {
          // Tests done → mark solid, reviewing code starts
          const tests = parent.children.find(c => c.type === 'running_tests')
          if (tests) tests.type = 'running_tests_done'
          parent.children.push({ type: 'reviewing_code', text: 'Reviewing code', color: 'text-blue-400' })
        }
        break
      }
      case 'deploying': {
        const parent = current.status.find(s => s.type === 'review_parent')
        if (parent) {
          parent.type = 'review_done'
          if (parent.children) {
            for (const child of parent.children) {
              if (child.type === 'running_tests') child.type = 'running_tests_done'
              if (child.type === 'reviewing_code') child.type = 'reviewing_code_done'
            }
          }
        }
        current.status.push({ type: 'deploying', text: 'Deploying', color: 'text-blue-400' })
        break
      }
      case 'complete': {
        // Mark deploying as done
        const dep = current.status.find(s => s.type === 'deploying')
        if (dep) dep.type = 'deploying_done'
        pushCurrent()
        groups.push({
          text: null,
          thinking: null,
          agent: 'coder',
          tools: [],
          status: [{ type: 'complete', text: ev.status || 'Complete', color: 'text-green-400' }],
        })
        current = { text: null, thinking: null, agent: 'coder', tools: [], status: [] }
        break
      }
      // connected, tool_result, tool_output, stream_end — handled elsewhere or absorbed by tool_call processing
    }
  }

  pushCurrent()
  return groups
}

export function getToolSummary(tool: string, input: Record<string, unknown>): string {
  const name = formatToolName(tool)
  const filePath = (input.file_path || input.path) as string | undefined
  const shortPath = filePath ? filePath.replace(/^\//, '') : null

  switch (tool) {
    case 'Edit':
    case 'edit_file':
      return shortPath ? `${name} ${shortPath}` : name
    case 'Write':
    case 'write_file':
      return shortPath ? `${name} ${shortPath}` : name
    case 'Read':
    case 'read_file':
      return shortPath ? `${name} ${shortPath}` : name
    case 'Bash':
    case 'bash': {
      if (input.run_in_background) {
        const desc = input.description as string | undefined
        return desc ? `Background: ${desc}` : 'Running background task'
      }
      const desc = input.description as string | undefined
      if (desc) return desc
      const cmd = input.command as string | undefined
      return cmd ? truncateMiddle(cmd.split('\n')[0], 80) : name
    }
    case 'TaskOutput':
      return 'Waiting for background task'
    case 'TodoWrite':
      return 'Updated tasks'
    case 'Grep':
    case 'search_code': {
      const pattern = input.pattern as string | undefined
      return pattern ? `${name} "${truncateMiddle(pattern, 40)}"` : name
    }
    case 'Glob': {
      const globPattern = input.pattern as string | undefined
      return globPattern ? `${name} ${truncateMiddle(globPattern, 40)}` : name
    }
    case 'Agent': {
      const desc = input.description as string | undefined
      return desc ? `Spawn sub-agent: ${desc}` : 'Spawn sub-agent'
    }
    default: {
      const args = formatToolArgs(input)
      return args ? `${name}: ${args}` : name
    }
  }
}

function isEditTool(tool: string): boolean {
  return tool === 'Edit' || tool === 'edit_file'
}

function isWriteTool(tool: string): boolean {
  return tool === 'Write' || tool === 'write_file'
}

// ── Subcomponents ────────────────────────────────────────────

/**
 * Simple LCS-based line diff that interleaves removed/added lines at the
 * right positions instead of dumping all reds then all greens.
 */
export function diffLines(oldLines: string[], newLines: string[]): { type: 'same' | 'del' | 'add'; text: string }[] {
  const m = oldLines.length
  const n = newLines.length

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrack to produce diff
  const result: { type: 'same' | 'del' | 'add'; text: string }[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: 'same', text: oldLines[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'add', text: newLines[j - 1] })
      j--
    } else {
      result.push({ type: 'del', text: oldLines[i - 1] })
      i--
    }
  }
  result.reverse()
  return result
}

function EditDiff({ oldStr, newStr }: { oldStr: string; newStr: string }) {
  const lines = diffLines(oldStr.split('\n'), newStr.split('\n'))
  return (
    <div className="mt-1 rounded-md overflow-hidden border border-gray-800 text-[11px] font-mono max-h-48 overflow-y-auto">
      {lines.map((line, i) => {
        if (line.type === 'del') {
          return (
            <div key={i} className="px-2 bg-red-950/30 text-red-400/80">
              <span className="select-none text-red-600/50 mr-1">-</span>{line.text}
            </div>
          )
        }
        if (line.type === 'add') {
          return (
            <div key={i} className="px-2 bg-green-950/30 text-green-400/80">
              <span className="select-none text-green-600/50 mr-1">+</span>{line.text}
            </div>
          )
        }
        return (
          <div key={i} className="px-2 text-gray-600">
            <span className="select-none text-gray-700 mr-1">&nbsp;</span>{line.text}
          </div>
        )
      })}
    </div>
  )
}

function WritePreview({ content }: { content: string }) {
  const allLines = content.split('\n')
  const lines = allLines.slice(0, 20)
  const truncated = allLines.length > 20
  return (
    <div className="mt-1 rounded-md overflow-hidden border border-gray-800 text-[11px] font-mono max-h-48 overflow-y-auto">
      {lines.map((line, i) => (
        <div key={i} className="px-2 bg-green-950/20 text-green-400/70">
          <span className="select-none text-green-600/50 mr-1">+</span>{line}
        </div>
      ))}
      {truncated && (
        <div className="px-2 py-1 text-gray-600 text-[10px]">
          ...{allLines.length - 20} more lines
        </div>
      )}
    </div>
  )
}

function ToolCallRow({
  tc,
  expanded,
  onToggle,
  isRunning,
  now,
  agent,
}: {
  tc: ToolCallInfo
  expanded: boolean
  onToggle: () => void
  isRunning: boolean
  now: number
  agent: 'coder' | 'reviewer'
}) {
  const summary = getToolSummary(tc.tool, tc.input)
  const isEdit = isEditTool(tc.tool)
  const isWrite = isWriteTool(tc.tool)
  const elapsedMs = now - tc.startedAt
  const showDuration = isRunning && elapsedMs >= 1000

  // Determine what to show when expanded
  const hasEditDiff = isEdit && !!tc.input.old_string && !!tc.input.new_string
  const hasWriteContent = isWrite && !!tc.input.content
  const rawOutput = tc.result || tc.output || ''
  const hasRawOutput = rawOutput.length > 0
  const hideOutput = ['Read', 'read_file', 'Glob', 'TodoWrite', 'Agent'].includes(tc.tool)
  const isExpandable = hasEditDiff || hasWriteContent || (hasRawOutput && !hideOutput)

  const dotColor = agent === 'reviewer' ? 'bg-blue-400' : 'bg-green-400'

  return (
    <div className="ml-3">
      <div
        className={`flex items-start py-0.5 ${isExpandable ? 'cursor-pointer hover:bg-gray-900/50 -mx-1 px-1 rounded' : ''}`}
        onClick={() => { if (isExpandable) onToggle() }}
      >
        <span className="mr-2 inline-block w-3 shrink-0">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor} ${isRunning ? 'animate-pulse' : ''}`} />
        </span>
        <span className="break-words min-w-0 text-gray-300">
          {summary}
        </span>
        {showDuration && (
          <span className="text-gray-600 ml-2 shrink-0 tabular-nums">
            {formatElapsed(Math.floor(elapsedMs / 1000))}
          </span>
        )}
        {isExpandable && (
          <span className="text-gray-600 ml-2 shrink-0">
            {expanded ? '\u25bc' : '\u25b6'}
          </span>
        )}
      </div>

      {expanded && hasEditDiff && (
        <div className="ml-5">
          <EditDiff
            oldStr={tc.input.old_string as string}
            newStr={tc.input.new_string as string}
          />
        </div>
      )}

      {expanded && hasWriteContent && (
        <div className="ml-5">
          <WritePreview content={tc.input.content as string} />
        </div>
      )}

      {expanded && !hasEditDiff && !hasWriteContent && hasRawOutput && (
        <div className="ml-5 mt-1 mb-2 p-2 rounded-md max-h-40 overflow-auto whitespace-pre-wrap break-words bg-gray-900 text-gray-400 border border-gray-800 text-[11px]">
          {tc.result || tc.output}
        </div>
      )}
    </div>
  )
}

const stepLabels: Record<string, string> = {
  setup_started: 'Setting up workspace...',
  setup_cloning: 'Cloning repository...',
  setup_cloned: 'Repository cloned',
  setup_deps: 'Installing dependencies...',
  setup_deps_done: 'Dependencies installed',
  runtime_created: 'Creating runtime...',
  agent_started: 'Starting agent...',
  agent_thinking: 'Agent is thinking...',
}

// ── Main component ──────────────────────────────────────────

export default function AgentWorkspace({
  queueStatus,
  projectId,
  projectQueuedCount,
  pausedTask,
  activeSponsor,
  onTaskStateChanged,
}: {
  queueStatus: QueueStatus
  projectId?: string
  projectQueuedCount: number
  pausedTask: LedgerTask | null
  activeSponsor: Sponsorship | null
  onTaskStateChanged: () => void
}) {
  // Stream state
  const [events, setEvents] = useState<TaskStreamEvent[]>([])
  const [streaming, setStreaming] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const streamingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const lastTaskIdRef = useRef<string | null>(null)

  // UI state
  const [expanded, setExpanded] = useState(false)
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())

  // Control state
  const [cancelling, setCancelling] = useState(false)
  const [pausing, setPausing] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [guidanceText, setGuidanceText] = useState('')
  const [sendingGuidance, setSendingGuidance] = useState(false)

  // Track when the stream says the task is done
  const [streamEnded, setStreamEnded] = useState(false)

  // Lifecycle init steps (before turns start)
  const [initSteps, setInitSteps] = useState<Array<{event: string, message: string, done: boolean}>>([])

  // Running clock for tool durations
  const [now, setNow] = useState(Date.now())

  // Refs
  const activityRef = useRef<HTMLDivElement>(null)

  // Find active task for this project — check active_tasks first (supports concurrent tasks),
  // fall back to current_task for backwards compatibility
  const activeTaskForProject = queueStatus.active_tasks?.find(t => t.project_id === projectId) || null
  const isCurrentTaskForThisProject = activeTaskForProject !== null || queueStatus.current_task?.project_id === projectId
  const currentTaskId = activeTaskForProject?.id || (isCurrentTaskForThisProject ? queueStatus.current_task?.id : undefined) || (pausedTask?.id || undefined)
  const currentTask = activeTaskForProject || (queueStatus.current_task?.project_id === projectId ? queueStatus.current_task : null) || (pausedTask ? { id: pausedTask.id, title: pausedTask.title, project_id: pausedTask.project_id, started_at: pausedTask.started_at } : null)
  const isPaused = pausedTask !== null && !isCurrentTaskForThisProject

  // Auto-scroll activity log only if user is near the bottom
  const isNearBottomRef = useRef(true)
  useEffect(() => {
    if (activityRef.current && isNearBottomRef.current) {
      activityRef.current.scrollTop = activityRef.current.scrollHeight
    }
  }, [events])

  const handleActivityScroll = () => {
    const el = activityRef.current
    if (!el) return
    // "Near bottom" = within 40px of the bottom edge
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  // 1-second clock tick for running time and tool durations
  useEffect(() => {
    if (!streaming) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [streaming])

  // Group events into turns
  const turnGroups = useMemo(() => groupEvents(events), [events])

  // Single SSE effect
  useEffect(() => {
    if (currentTaskId !== lastTaskIdRef.current) {
      abortRef.current?.abort()
      streamingRef.current = false
      setEvents([])
      setExpandedTools(new Set())
      setStreaming(false)
      setStreamError(null)
      setStreamEnded(false)
      setInitSteps([])
      lastTaskIdRef.current = currentTaskId || null
    }

    if (expanded && currentTaskId && !streamingRef.current) {
      console.log('[AgentWorkspace] starting SSE stream:', currentTaskId)
      streamingRef.current = true
      setStreaming(true)
      setStreamError(null)
      abortRef.current = new AbortController()

      streamTaskEvents(
        currentTaskId,
        (event) => {
          if (event.type === 'connected') {
            console.log('[AgentWorkspace] SSE connected:', currentTaskId)
          } else if (event.type === 'complete' || event.type === 'stream_end') {
            console.log('[AgentWorkspace] received', event.type, '— closing workspace:', event)
            streamingRef.current = false
            setStreaming(false)
            setStreamEnded(true)
            onTaskStateChanged()
          }

          // Handle lifecycle events — track init steps separately
          if (event.type === 'lifecycle') {
            const eventName = event.event || 'unknown'
            setInitSteps(prev => {
              // Dedup by event name (SSE replay can resend lifecycle events)
              if (prev.some(s => s.event === eventName)) return prev
              const updated = prev.map(s => ({ ...s, done: true }))
              const message = event.message || stepLabels[eventName] || eventName
              updated.push({ event: eventName, message, done: false })
              return updated
            })
            return
          }

          // Expand turn records (from DB replay) into granular events
          if (event.type === 'turn') {
            const expanded = expandTurnRecord(event as unknown as Record<string, unknown>)
            setEvents(prev => [...prev, ...(expanded as unknown as TaskStreamEvent[])])
            return
          }

          setEvents(prev => [...prev, event])
        },
        abortRef.current.signal,
        (error) => {
          console.error('[AgentWorkspace] stream error:', error.message)
          streamingRef.current = false
          setStreamError(error.message)
          setStreaming(false)
        },
        () => {
          console.warn('[AgentWorkspace] stream ended without complete event — refetching status')
          streamingRef.current = false
          setStreaming(false)
          onTaskStateChanged()
        },
      )
    }

    if (!expanded && streamingRef.current) {
      abortRef.current?.abort()
      streamingRef.current = false
      setStreaming(false)
    }

    return () => {
      if (!expanded) {
        abortRef.current?.abort()
        streamingRef.current = false
      }
    }
  }, [expanded, currentTaskId, onTaskStateChanged])

  // ── Controls ────────────────────────────────────────────────

  const handleCancel = async () => {
    if (!currentTaskId || cancelling) return
    if (!confirm('Cancel this task?')) return
    setCancelling(true)
    try {
      await cancelTask(currentTaskId)
      abortRef.current?.abort()
      setStreaming(false)
      onTaskStateChanged()
      toast('Task cancelled')
    } catch (e) {
      toast.error('Failed to cancel task')
      console.error('Failed to cancel:', e)
    } finally {
      setCancelling(false)
    }
  }

  const handlePause = async () => {
    if (!currentTaskId || pausing || isPaused) return
    setPausing(true)
    try {
      await pauseTask(currentTaskId)
      toast('Task paused')
    } catch (e) {
      toast.error('Failed to pause task')
      console.error('Failed to pause:', e)
    } finally {
      setPausing(false)
    }
  }

  const handleResume = async () => {
    if (!currentTaskId || resuming) return
    setResuming(true)
    try {
      await resumeTask(currentTaskId)
      onTaskStateChanged()
      toast.success('Task resumed')
    } catch (e) {
      toast.error('Failed to resume task')
      console.error('Failed to resume:', e)
    } finally {
      setResuming(false)
    }
  }

  const handleSendGuidance = async () => {
    if (!currentTaskId || !guidanceText.trim() || sendingGuidance) return
    setSendingGuidance(true)
    try {
      await sendTaskGuidance(currentTaskId, guidanceText.trim())
      setGuidanceText('')
      toast.success('Guidance sent')
    } catch (e) {
      toast.error('Failed to send guidance')
      console.error('Failed to send guidance:', e)
    } finally {
      setSendingGuidance(false)
    }
  }

  const toggleToolExpanded = (key: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── No task state ───────────────────────────────────────────

  if (streamEnded) {
    console.log('[AgentWorkspace] render: returning null (streamEnded=true)')
    return null
  }
  if (!currentTask && projectQueuedCount === 0) return null

  if (!currentTask) {
    return (
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 mb-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-gray-400" />
          <span className="text-sm text-gray-600">
            {projectQueuedCount} idea{projectQueuedCount !== 1 ? 's' : ''} waiting
          </span>
        </div>
      </div>
    )
  }

  const isSponsored = activeSponsor !== null

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className={`rounded-xl border ${isPaused ? 'border-amber-200' : 'border-gray-800'} mb-10 overflow-hidden`}>
      {/* Header bar */}
      <div
        className={`px-4 py-3 cursor-pointer select-none ${isPaused ? 'bg-amber-50/50' : 'bg-gray-900'} transition-colors`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-green-400 animate-pulse'}`} />
            <span className={`text-sm font-medium ${isPaused ? 'text-amber-700' : 'text-white'}`}>
              {isPaused ? 'Paused' : 'Agent Workspace'}
            </span>
            <span className={`text-xs ${isPaused ? 'text-amber-600' : 'text-gray-400'} truncate max-w-xs`}>
              {currentTask?.title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isPaused && isSponsored && activeSponsor?.sponsor_avatar_url && (
              <span className="text-xs text-gray-500">
                funded by {activeSponsor.display_name || `@${activeSponsor.sponsor_username}`}
              </span>
            )}
            {isPaused ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleResume() }}
                  disabled={resuming}
                  className="px-2.5 py-1 text-xs rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {resuming ? '...' : 'Resume'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCancel() }}
                  disabled={cancelling}
                  className="px-2.5 py-1 text-xs rounded-md border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 disabled:opacity-50 transition-colors"
                >
                  {cancelling ? '...' : 'Cancel'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handlePause() }}
                  disabled={pausing}
                  className="px-2.5 py-1 text-xs rounded-md border border-gray-600 text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-50 transition-colors"
                >
                  {pausing ? '...' : 'Pause'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCancel() }}
                  disabled={cancelling}
                  className="px-2.5 py-1 text-xs rounded-md border border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300 disabled:opacity-50 transition-colors"
                >
                  {cancelling ? '...' : 'Cancel'}
                </button>
              </>
            )}
            <svg
              className={`w-4 h-4 ${isPaused ? 'text-gray-400' : 'text-gray-500'} transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              onMouseEnter={() => setExpanded(true)}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Activity panel */}
      {expanded && (
        <div className="bg-gray-950">
          <div className="h-[400px] flex flex-col">
            <div ref={activityRef} onScroll={handleActivityScroll} className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-3">
              {turnGroups.length === 0 && (
                <div className="flex items-start gap-2 text-sm px-3 py-2">
                  {initSteps.length > 0 ? (
                    <div className="space-y-1">
                      {initSteps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                            step.done ? 'bg-blue-400' : 'bg-blue-400 animate-pulse'
                          }`} />
                          <span className={step.done ? 'text-gray-500' : 'text-blue-400'}>
                            {step.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : streaming ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      <span className="text-blue-400">Initializing agent workspace...</span>
                    </div>
                  ) : streamError ? (
                    <div className="text-red-400">Error: {streamError}</div>
                  ) : null}
                </div>
              )}
              {turnGroups.map((group, gi) => (
                <div key={gi}>
                  {/* Thinking */}
                  {group.thinking && (
                    <div className="text-gray-500 text-xs leading-relaxed mb-1 italic border-l border-gray-700 pl-2">
                      {group.thinking}
                    </div>
                  )}

                  {/* Agent message */}
                  {group.text && (
                    <div className="text-gray-300 text-xs leading-relaxed mb-1">
                      <span className={group.agent === 'reviewer' ? 'text-blue-400 font-medium' : 'text-green-400 font-medium'}>
                        {group.agent === 'reviewer' ? 'Reviewer: ' : 'Coder: '}
                      </span>
                      {group.text}
                    </div>
                  )}

                  {/* Tool calls */}
                  {group.tools.map((tc, ti) => {
                    const key = `${gi}-${ti}`
                    return (
                      <ToolCallRow
                        key={key}
                        tc={tc}
                        expanded={expandedTools.has(key)}
                        onToggle={() => toggleToolExpanded(key)}
                        isRunning={streaming && !tc.completed}
                        now={now}
                        agent={group.agent}
                      />
                    )
                  })}

                  {/* Status events */}
                  {group.status.map((s, si) => {
                    const isActive = s.type === 'review_parent' || s.type === 'deploying'
                    const isDone = s.type === 'review_done' || s.type === 'deploying_done'
                    return (
                      <div key={`s-${gi}-${si}`}>
                        <div className={`flex items-center py-0.5 ${s.color}`}>
                          {isActive ? (
                            <span className="mr-2 inline-block w-3 shrink-0">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                            </span>
                          ) : isDone || s.type === 'complete' ? (
                            <span className="mr-2 inline-block w-3 shrink-0">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />
                            </span>
                          ) : s.type === 'guidance' ? (
                            <span className="opacity-60 mr-2 w-3 shrink-0 text-center">{'\u2192'}</span>
                          ) : s.type === 'paused' || s.type === 'pause_requested' ? (
                            <span className="opacity-60 mr-2 w-3 shrink-0 text-center">{'\u23f8'}</span>
                          ) : s.type === 'resumed' ? (
                            <span className="opacity-60 mr-2 w-3 shrink-0 text-center">{'\u25b6'}</span>
                          ) : (
                            <span className="mr-2 inline-block w-3 shrink-0">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />
                            </span>
                          )}
                          <span>{s.text}</span>
                        </div>
                        {s.children?.map((child, ci) => {
                          const childActive = child.type === 'reviewing_code' || child.type === 'running_tests'
                          return (
                            <div key={`c-${gi}-${si}-${ci}`} className={`flex items-center py-0.5 ml-5 ${child.color}`}>
                              {childActive ? (
                                <span className="mr-2 inline-block w-3 shrink-0">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                </span>
                              ) : (
                                <span className="mr-2 inline-block w-3 shrink-0">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />
                                </span>
                              )}
                              <span>{child.text}</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Guidance input */}
          {!isPaused && (
            <div className="px-4 pb-3 pt-2 border-t border-gray-800">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={guidanceText}
                  onChange={(e) => setGuidanceText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendGuidance() } }}
                  placeholder="Guide the agent..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-500 font-mono"
                  disabled={sendingGuidance}
                />
                <button
                  onClick={handleSendGuidance}
                  disabled={!guidanceText.trim() || sendingGuidance}
                  className="px-3 py-1.5 rounded-lg bg-white text-gray-900 text-xs font-medium hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {sendingGuidance ? '...' : 'Send'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
