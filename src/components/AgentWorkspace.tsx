'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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

// ── Types ───────────────────────────────────────────────────────

interface FileEntry {
  path: string
  content: string
  language: string
  action: 'read' | 'write' | 'edit'
  timestamp: number
}

type WorkspaceTab = 'activity' | 'files' | 'terminal'

// ── Helpers ─────────────────────────────────────────────────────

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go', rb: 'ruby',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    md: 'markdown', css: 'css', scss: 'scss', html: 'html',
    sql: 'sql', sh: 'bash', bash: 'bash', zsh: 'bash',
    dockerfile: 'dockerfile', makefile: 'makefile',
  }
  return map[ext] || 'plaintext'
}

function truncateMiddle(s: string, max: number): string {
  if (s.length <= max) return s
  const half = Math.floor((max - 3) / 2)
  return s.slice(0, half) + '...' + s.slice(-half)
}

// ── Main component ──────────────────────────────────────────────

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

  // UI state
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('activity')
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [terminalLines, setTerminalLines] = useState<Array<{ command: string; output: string; running: boolean }>>([])

  // Control state
  const [cancelling, setCancelling] = useState(false)
  const [pausing, setPausing] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [guidanceText, setGuidanceText] = useState('')
  const [sendingGuidance, setSendingGuidance] = useState(false)
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set())

  // Refs
  const activityRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)

  const isCurrentTaskForThisProject = queueStatus.current_task?.project_id === projectId
  const currentTaskId = isCurrentTaskForThisProject ? queueStatus.current_task?.id : (pausedTask?.id || undefined)
  const currentTask = isCurrentTaskForThisProject ? queueStatus.current_task : (pausedTask ? { id: pausedTask.id, title: pausedTask.title, project_id: pausedTask.project_id } : null)
  const isPaused = pausedTask !== null && !isCurrentTaskForThisProject

  // Auto-scroll activity log
  useEffect(() => {
    if (activityRef.current && activeTab === 'activity') {
      activityRef.current.scrollTop = activityRef.current.scrollHeight
    }
  }, [events, activeTab])

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current && activeTab === 'terminal') {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalLines, activeTab])

  // Process events into files and terminal data
  const processEvent = useCallback((event: TaskStreamEvent) => {
    // Track file operations
    if (event.type === 'tool_call' && event.input) {
      const input = event.input as Record<string, unknown>
      const tool = event.tool || ''

      if (tool === 'read_file' && input.path) {
        // Will be filled by tool_result
      }
      if (tool === 'bash' && input.command) {
        setTerminalLines(prev => [...prev, {
          command: String(input.command),
          output: '',
          running: true,
        }])
      }
    }

    if (event.type === 'tool_output' && event.tool === 'bash') {
      setTerminalLines(prev => {
        if (prev.length === 0) return prev
        const updated = [...prev]
        const last = updated[updated.length - 1]
        updated[updated.length - 1] = {
          ...last,
          output: last.output + (event.output || '') + '\n',
        }
        return updated
      })
    }

    if (event.type === 'tool_result') {
      const tool = event.tool || ''

      if (tool === 'bash') {
        setTerminalLines(prev => {
          if (prev.length === 0) return prev
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = {
            ...last,
            output: last.output || event.result || '',
            running: false,
          }
          return updated
        })
      }

      if ((tool === 'read_file' || tool === 'write_file' || tool === 'edit_file') && event.result) {
        // Extract file path from the preceding tool_call
        setEvents(prev => {
          // Find the matching tool_call
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].type === 'tool_call' && prev[i].tool === tool) {
              const input = prev[i].input as Record<string, unknown> | undefined
              if (input?.path) {
                const path = String(input.path)
                const action = tool === 'read_file' ? 'read' as const : tool === 'write_file' ? 'write' as const : 'edit' as const
                const entry: FileEntry = {
                  path,
                  content: event.result || '',
                  language: detectLanguage(path),
                  action,
                  timestamp: Date.now(),
                }
                setFiles(prevFiles => {
                  const existing = prevFiles.findIndex(f => f.path === path)
                  if (existing >= 0) {
                    const updated = [...prevFiles]
                    updated[existing] = entry
                    return updated
                  }
                  return [...prevFiles, entry]
                })
                setSelectedFile(entry)
                if (activeTab === 'activity') {
                  setActiveTab('files')
                }
              }
              break
            }
          }
          return prev
        })
      }
    }
  }, [activeTab])

  // SSE connection
  useEffect(() => {
    if (expanded && currentTaskId && !streamingRef.current) {
      streamingRef.current = true
      setStreaming(true)
      setEvents([])
      setFiles([])
      setTerminalLines([])
      setSelectedFile(null)
      setStreamError(null)
      abortRef.current = new AbortController()

      streamTaskEvents(
        currentTaskId,
        (event) => {
          setEvents(prev => [...prev, event])
          processEvent(event)
          if (event.type === 'complete' || event.type === 'stream_end') {
            streamingRef.current = false
            setStreaming(false)
          }
        },
        abortRef.current.signal,
        (error) => {
          streamingRef.current = false
          setStreamError(error.message)
          setStreaming(false)
        }
      )
    } else if (!expanded && streamingRef.current) {
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
  }, [expanded, currentTaskId, processEvent])

  // Reset on task change
  useEffect(() => {
    abortRef.current?.abort()
    streamingRef.current = false
    setEvents([])
    setFiles([])
    setTerminalLines([])
    setSelectedFile(null)
    setExpandedResults(new Set())
    setStreaming(false)
    setActiveTab('activity')
  }, [currentTaskId])

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

  // ── Event formatting ────────────────────────────────────────

  const hasToolResult = (toolName: string, fromIndex: number) => {
    for (let j = fromIndex + 1; j < events.length; j++) {
      if (events[j].type === 'tool_result' && events[j].tool === toolName) return true
    }
    return false
  }

  const formatEvent = (event: TaskStreamEvent, index: number): { icon: string; text: string; color: string; isSpinner: boolean; hidden?: boolean } => {
    switch (event.type) {
      case 'connected':
        return { icon: '', text: 'Connected', color: 'text-gray-400', isSpinner: false }
      case 'turn_start':
        return { icon: '', text: `Turn ${event.turn}/${event.max_turns}`, color: 'text-gray-400', isSpinner: false }
      case 'agent_text':
        return { icon: '', text: event.text || '', color: 'text-gray-300', isSpinner: false }
      case 'tool_call': {
        const toolName = event.tool || ''
        let args = ''
        if (event.input) {
          const input = event.input as Record<string, unknown>
          if (input.command) args = `: ${truncateMiddle(String(input.command), 80)}`
          else if (input.path) args = `: ${input.path}`
          else if (input.query) args = `: ${input.query}`
          else if (input.title) args = `: ${input.title}`
        }
        const completed = hasToolResult(toolName, index)
        return {
          icon: completed ? '\u2713' : '',
          text: `${toolName}${args}`,
          color: completed ? 'text-gray-400' : 'text-gray-300',
          isSpinner: !completed
        }
      }
      case 'tool_result':
        return { icon: '', text: '', color: '', isSpinner: false, hidden: true }
      case 'tool_output':
        return { icon: '', text: '', color: '', isSpinner: false, hidden: true }
      case 'guidance':
        return { icon: '\u2192', text: `You: ${event.message || 'guidance sent'}`, color: 'text-violet-400', isSpinner: false }
      case 'guidance_received':
        return { icon: '\u2713', text: 'Guidance received', color: 'text-violet-400', isSpinner: false }
      case 'pause_requested':
        return { icon: '\u23f8', text: 'Pause requested...', color: 'text-amber-400', isSpinner: false }
      case 'paused':
        return { icon: '\u23f8', text: 'Task paused', color: 'text-amber-400', isSpinner: false }
      case 'resumed':
        return { icon: '\u25b6', text: 'Task resumed', color: 'text-green-400', isSpinner: false }
      case 'complete':
        return { icon: '\u2713', text: event.status || 'Complete', color: 'text-green-400', isSpinner: false }
      case 'stream_end':
        return { icon: '', text: 'Done', color: 'text-gray-500', isSpinner: false }
      default:
        return { icon: '', text: '', color: 'text-gray-500', isSpinner: false }
    }
  }

  // ── No task state ───────────────────────────────────────────

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
  const turnEvents = events.filter(e => e.type === 'turn_start')
  const currentTurn = turnEvents.length > 0 ? turnEvents[turnEvents.length - 1] : null

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
            {currentTurn && !isPaused && (
              <span className="text-xs text-gray-400 font-mono">
                turn {currentTurn.turn}/{currentTurn.max_turns}
              </span>
            )}
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
            <svg className={`w-4 h-4 ${isPaused ? 'text-gray-400' : 'text-gray-500'} transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Workspace panels */}
      {expanded && (
        <div className="bg-gray-950">
          {/* Tab bar */}
          <div className="flex items-center border-b border-gray-800 px-1">
            {(['activity', 'files', 'terminal'] as WorkspaceTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs font-medium transition-colors relative ${
                  activeTab === tab
                    ? 'text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {tab === 'activity' && (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  {tab === 'files' && (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  {tab === 'terminal' && (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === 'files' && files.length > 0 && (
                    <span className="bg-gray-800 text-gray-400 text-[10px] px-1.5 py-0.5 rounded-full">{files.length}</span>
                  )}
                  {tab === 'terminal' && terminalLines.some(l => l.running) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  )}
                </span>
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-white rounded-t" />
                )}
              </button>
            ))}
          </div>

          {/* Content area */}
          <div className="h-[400px] flex">
            {/* Activity tab */}
            {activeTab === 'activity' && (
              <div className="flex-1 flex flex-col">
                <div ref={activityRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-0.5">
                  {events.length === 0 && (
                    <div className={streamError ? 'text-red-400' : 'text-gray-600'}>
                      {streamError ? `Error: ${streamError}` : streaming ? 'Connecting...' : 'No events yet'}
                    </div>
                  )}
                  {events.map((event, i) => {
                    const formatted = formatEvent(event, i)
                    if (!formatted.text || formatted.hidden) return null

                    // Collect tool output for expandable results
                    let displayText = ''
                    let isStreamingOutput = false
                    if (event.type === 'tool_call' && event.tool) {
                      let hasResult = false
                      for (let j = i + 1; j < events.length; j++) {
                        if (events[j].type === 'tool_result' && events[j].tool === event.tool) {
                          displayText = events[j].result || ''
                          hasResult = true
                          break
                        }
                      }
                      if (!hasResult) {
                        const outputs: string[] = []
                        for (let j = i + 1; j < events.length; j++) {
                          if (events[j].type === 'tool_output' && events[j].tool === event.tool) {
                            outputs.push(events[j].output || '')
                          } else if (events[j].type === 'tool_call') break
                        }
                        if (outputs.length > 0) {
                          displayText = outputs.join('\n')
                          isStreamingOutput = true
                        }
                      }
                    }
                    const hasOutput = displayText.length > 0
                    const isExpandable = event.type === 'tool_call' && (displayText.length > 80 || isStreamingOutput)
                    const isResultExpanded = expandedResults.has(i) || isStreamingOutput

                    return (
                      <div key={i}>
                        <div
                          className={`flex items-start py-0.5 ${formatted.color} ${isExpandable ? 'cursor-pointer hover:bg-gray-900/50 -mx-1 px-1 rounded' : ''}`}
                          onClick={() => {
                            if (hasOutput) {
                              setExpandedResults(prev => {
                                const next = new Set(prev)
                                if (next.has(i)) next.delete(i)
                                else next.add(i)
                                return next
                              })
                            }
                          }}
                        >
                          {formatted.isSpinner ? (
                            <span className="mr-2 inline-block w-3 shrink-0">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            </span>
                          ) : (
                            <span className="opacity-60 mr-2 w-3 shrink-0 text-center">{formatted.icon}</span>
                          )}
                          <span className="break-words min-w-0">{formatted.text}</span>
                          {hasOutput && (
                            <span className="text-gray-600 ml-2 shrink-0">
                              {isStreamingOutput ? '\u23f3' : isResultExpanded ? '\u25bc' : '\u25b6'}
                            </span>
                          )}
                        </div>
                        {hasOutput && isResultExpanded && (
                          <div className="ml-5 mt-1 mb-2 p-2 rounded-md max-h-40 overflow-auto whitespace-pre-wrap break-words bg-gray-900 text-gray-400 border border-gray-800 text-[11px]">
                            {displayText}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Files tab */}
            {activeTab === 'files' && (
              <div className="flex-1 flex">
                {/* File list sidebar */}
                <div className="w-48 border-r border-gray-800 overflow-y-auto shrink-0">
                  {files.length === 0 ? (
                    <div className="p-4 text-xs text-gray-600">No files yet</div>
                  ) : (
                    <div className="py-1">
                      {files.map((file, i) => {
                        const filename = file.path.split('/').pop() || file.path
                        const isSelected = selectedFile?.path === file.path
                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedFile(file)}
                            className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                              isSelected ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              file.action === 'write' ? 'bg-green-500' :
                              file.action === 'edit' ? 'bg-amber-500' :
                              'bg-gray-600'
                            }`} />
                            <span className="truncate font-mono">{filename}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* File content viewer */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  {selectedFile ? (
                    <>
                      <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-medium px-1.5 py-0.5 rounded ${
                            selectedFile.action === 'write' ? 'bg-green-900/50 text-green-400' :
                            selectedFile.action === 'edit' ? 'bg-amber-900/50 text-amber-400' :
                            'bg-gray-800 text-gray-400'
                          }`}>
                            {selectedFile.action}
                          </span>
                          <span className="text-xs text-gray-300 font-mono">{selectedFile.path}</span>
                        </div>
                        <span className="text-[10px] text-gray-600">{selectedFile.language}</span>
                      </div>
                      <div className="flex-1 overflow-auto p-4">
                        <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                          {selectedFile.content.split('\n').map((line, lineIdx) => (
                            <div key={lineIdx} className="flex hover:bg-gray-900/50">
                              <span className="text-gray-700 w-10 text-right pr-4 select-none shrink-0 tabular-nums">{lineIdx + 1}</span>
                              <span className="flex-1 min-w-0">{line || ' '}</span>
                            </div>
                          ))}
                        </pre>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-xs text-gray-600">
                      {files.length > 0 ? 'Select a file' : 'Files will appear as the agent reads and writes them'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Terminal tab */}
            {activeTab === 'terminal' && (
              <div className="flex-1 flex flex-col">
                <div ref={terminalRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs">
                  {terminalLines.length === 0 ? (
                    <div className="text-gray-600">Terminal output will appear when the agent runs commands</div>
                  ) : (
                    <div className="space-y-3">
                      {terminalLines.map((line, i) => (
                        <div key={i}>
                          <div className="flex items-start gap-2">
                            <span className="text-green-500 shrink-0">$</span>
                            <span className="text-gray-200 break-all">{line.command}</span>
                            {line.running && (
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse mt-1.5 shrink-0" />
                            )}
                          </div>
                          {line.output && (
                            <div className="mt-1 ml-4 text-gray-500 whitespace-pre-wrap break-words max-h-48 overflow-auto">
                              {line.output}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
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
