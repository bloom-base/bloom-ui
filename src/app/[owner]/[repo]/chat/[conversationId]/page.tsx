'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { getProjectByPath, getConversation, getConversationTasks, sendMessageStream, approveTask, rejectTask, getCurrentUser, type Project, type StreamEvent, type LedgerTask, type Conversation, type UserProfile } from '@/lib/api'
import { useAutoScroll } from '@/lib/useAutoScroll'
import { AgentMarkdown } from '@/components/Markdown'
import { redirectToLogin } from '@/lib/auth'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_name?: string
  tool_input?: string
  tool_output?: string
  task_id?: string
  outputExpanded?: boolean
}

interface TaskEvent {
  id: string
  title: string
  description: string
  priority: number
  status: 'proposed' | 'accepted' | 'in_progress' | 'paused' | 'completed' | 'incomplete' | 'rejected' | 'cancelled'
  expanded?: boolean
}

export default function ConversationPage() {
  const params = useParams()
  const owner = params.owner as string
  const repo = params.repo as string
  const conversationId = params.conversationId as string

  const [project, setProject] = useState<Project | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [createdTasks, setCreatedTasks] = useState<TaskEvent[]>([])

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { messagesEndRef, scrollContainerRef, handleScroll } = useAutoScroll([messages])

  useEffect(() => {
    Promise.all([
      getProjectByPath(owner, repo),
      getConversation(conversationId),
      getConversationTasks(conversationId),
      getCurrentUser().catch(() => null),
    ])
      .then(([p, c, tasks, user]) => {
        setProject(p)
        setConversation(c)
        setCurrentUser(user)
        setMessages(
          c.messages?.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant' | 'tool',
            content: m.content,
            tool_name: m.tool_name,
            tool_input: m.tool_input,
            tool_output: m.tool_output,
            task_id: m.task_id,
          })) || []
        )
        // Load tasks that were created in this conversation
        setCreatedTasks(
          tasks.map((t: LedgerTask) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            priority: t.priority,
            status: t.status,
          }))
        )
      })
      .catch((err) => {
        console.error(err)
        if (err.message.includes('401')) {
          redirectToLogin(`/${owner}/${repo}/chat/${conversationId}`)
        }
      })
      .finally(() => setLoading(false))
  }, [owner, repo, conversationId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || sending) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSending(true)

    const assistantId = (Date.now() + 1).toString()
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    // Create abort controller for this request
    abortControllerRef.current = new AbortController()

    try {
      await sendMessageStream(
        conversationId,
        userMessage.content,
        (event: StreamEvent) => {
          if ((event.type === 'text' || event.type === 'error') && event.content) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, content: msg.content + event.content } : msg
              )
            )
          } else if (event.type === 'tool_call' && event.tool) {
            // Add tool call message to show it's happening
            const toolId = `tool-${Date.now()}`
            setMessages((prev) => [...prev, {
              id: toolId,
              role: 'tool' as const,
              content: '',
              tool_name: event.tool,
              tool_input: event.input ? JSON.stringify(event.input) : undefined,
            }])
          } else if (event.type === 'tool_result' && event.tool) {
            // Update the tool message with its output
            setMessages((prev) => {
              // Find the last tool message with this tool name that doesn't have output yet
              const lastToolIdx = prev.findLastIndex(
                (m) => m.role === 'tool' && m.tool_name === event.tool && !m.tool_output
              )
              if (lastToolIdx >= 0) {
                return prev.map((msg, idx) =>
                  idx === lastToolIdx ? { ...msg, tool_output: event.output } : msg
                )
              }
              return prev
            })
          } else if (event.type === 'event' && event.event === 'task_created' && event.task) {
            // Update the most recent tool message with the task_id
            const taskId = event.task.id
            setMessages((prev) => {
              const lastCreateTaskIdx = prev.findLastIndex(
                (m) => m.role === 'tool' && m.tool_name === 'create_task' && !m.task_id
              )
              if (lastCreateTaskIdx >= 0) {
                return prev.map((msg, idx) =>
                  idx === lastCreateTaskIdx ? { ...msg, task_id: taskId } : msg
                )
              }
              return prev
            })
            setCreatedTasks((prev) => [...prev, event.task as TaskEvent])
          }
        },
        abortControllerRef.current.signal
      )
    } catch (error) {
      // Don't show error for user-initiated abort
      if (error instanceof Error && error.name === 'AbortError') {
        // User stopped the stream - append "(stopped)" to message
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId && msg.content
              ? { ...msg, content: msg.content + ' (stopped)' }
              : msg
          )
        )
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: 'Something went wrong. Please try again.' }
              : msg
          )
        )
      }
    } finally {
      abortControllerRef.current = null
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-900 font-medium mb-1">Conversation not found</p>
        <p className="text-gray-500 text-sm mb-6">This conversation doesn&apos;t exist or you don&apos;t have access.</p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2"
          >
            Retry
          </button>
          <Link href={`/${owner}/${repo}/chat`} className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2">
            Start new conversation
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header - single line */}
      <div className="border-b border-gray-100 px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <Link
            href={`/${owner}/${repo}`}
            className="p-1.5 -ml-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="font-medium text-gray-900">{project.name}</h1>
          <span className="text-gray-300">·</span>
          <span className="text-sm text-gray-500">Continue conversation</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto" ref={scrollContainerRef} onScroll={handleScroll}>
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id}>
                {/* User message */}
                {message.role === 'user' && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gray-900 text-white whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </div>
                )}

                {/* Tool call with collapsible output */}
                {message.role === 'tool' && (
                  <div className="flex justify-start">
                    <div className="rounded-xl bg-gray-50 border border-gray-100 text-gray-600 text-sm font-mono overflow-hidden max-w-[90%]">
                      {/* Tool header - always visible */}
                      <div
                        className={`px-3 py-2 flex items-center gap-2 ${message.tool_output ? 'cursor-pointer hover:bg-gray-200' : ''}`}
                        onClick={() => {
                          if (message.tool_output) {
                            setMessages(prev => prev.map(m =>
                              m.id === message.id
                                ? { ...m, outputExpanded: !m.outputExpanded }
                                : m
                            ))
                          }
                        }}
                      >
                        {message.tool_output ? (
                          <span className="text-gray-400 transition-transform duration-200" style={{ transform: message.outputExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                        ) : (
                          <span className="text-gray-400">⚡</span>
                        )}
                        <span className="text-gray-700">{message.tool_name}</span>
                        {message.tool_input && (() => {
                          try {
                            const input = JSON.parse(message.tool_input)
                            if (input.path) return <span className="text-gray-500 truncate">({input.path})</span>
                            if (input.query) return <span className="text-gray-500 truncate">({input.query})</span>
                            if (input.title) return <span className="text-gray-500 truncate">({input.title})</span>
                          } catch { /* ignore */ }
                          return null
                        })()}
                        {message.tool_output && !message.outputExpanded && (
                          <span className="text-gray-400 text-xs ml-auto">click to expand</span>
                        )}
                      </div>
                      {/* Collapsible output */}
                      {message.tool_output && message.outputExpanded && (
                        <div className="border-t border-gray-100 px-3 py-2 bg-white max-h-64 overflow-auto">
                          <pre className="text-xs text-gray-500 whitespace-pre-wrap break-words">
                            {message.tool_output}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Task card - shown when tool message has task_id */}
                {message.role === 'tool' && message.task_id && (() => {
                  const task = createdTasks.find(t => t.id === message.task_id)
                  if (!task) return null
                  return (
                    <div className="flex justify-start mt-2">
                      <div className="max-w-[85%] rounded-xl overflow-hidden border border-gray-200 bg-white">
                        <div className="px-4 py-2.5 flex items-center gap-2 bg-gray-50 border-b border-gray-100">
                          {task.status === 'proposed' ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-gray-900 animate-pulse" />
                              <span className="text-sm font-medium text-gray-900">Task Proposed</span>
                            </>
                          ) : task.status === 'rejected' ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-gray-300" />
                              <span className="text-sm font-medium text-gray-500">Task Rejected</span>
                            </>
                          ) : task.status === 'cancelled' ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-gray-300" />
                              <span className="text-sm font-medium text-gray-500">Task Cancelled</span>
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                              <span className="text-sm font-medium text-gray-900">Task Queued</span>
                            </>
                          )}
                        </div>
                        <div className="px-4 py-3">
                          <h4 className="font-medium text-gray-900">{task.title}</h4>
                          <div
                            className="cursor-pointer group"
                            onClick={() => {
                              setCreatedTasks((prev) =>
                                prev.map((t) =>
                                  t.id === task.id ? { ...t, expanded: !t.expanded } : t
                                )
                              )
                            }}
                          >
                            <p className={`text-sm text-gray-500 mt-1 whitespace-pre-wrap leading-relaxed ${task.expanded ? '' : 'line-clamp-2'}`}>
                              {task.description}
                            </p>
                            {!task.expanded && task.description.length > 100 && (
                              <span className="text-xs text-gray-400 group-hover:text-gray-600">show more</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                              P{task.priority}
                            </span>
                            <span className="text-xs text-gray-400">
                              {task.status}
                            </span>
                          </div>
                          {task.status === 'proposed' ? (
                            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                              <button
                                onClick={async () => {
                                  try {
                                    await approveTask(task.id)
                                    setCreatedTasks((prev) =>
                                      prev.map((t) =>
                                        t.id === task.id ? { ...t, status: 'accepted' as const } : t
                                      )
                                    )
                                    toast.success('Task approved and queued')
                                  } catch (err) {
                                    toast.error('Failed to approve task')
                                    console.error('Failed to approve task:', err)
                                  }
                                }}
                                className="flex-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    await rejectTask(task.id)
                                    setCreatedTasks((prev) =>
                                      prev.map((t) =>
                                        t.id === task.id ? { ...t, status: 'rejected' as const } : t
                                      )
                                    )
                                    toast('Task rejected')
                                  } catch (err) {
                                    toast.error('Failed to reject task')
                                    console.error('Failed to reject task:', err)
                                  }
                                }}
                                className="flex-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (task.status !== 'rejected' && task.status !== 'cancelled') && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <Link
                                href={`/${owner}/${repo}`}
                                className="flex items-center justify-center gap-2 w-full px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                              >
                                View progress
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Assistant text message */}
                {message.role === 'assistant' && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-white border border-gray-200 text-gray-900">
                      {message.content ? (
                        <AgentMarkdown content={message.content} />
                      ) : (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input - only show if user owns the conversation */}
      {currentUser && conversation && currentUser.id === conversation.user_id ? (
        <div className="border-t border-gray-100 px-6 py-4 bg-white">
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
            <div className="flex gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={createdTasks.length > 0 ? "Refine the task or propose another idea..." : "Continue the conversation..."}
                rows={1}
                className="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:border-gray-400 transition-colors"
              />
              {sending ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="px-5 py-3 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="px-5 py-3 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </form>
        </div>
      ) : (
        <div className="border-t border-gray-100 px-6 py-3 bg-gray-50">
          <p className="text-sm text-gray-500 text-center">
            You can view this conversation but only the owner can continue it.
          </p>
        </div>
      )}
    </div>
  )
}
