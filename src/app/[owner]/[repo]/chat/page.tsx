'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getProjectByPath, createConversation, getCurrentUser, sendMessageStream, approveTask, rejectTask, type Project, type StreamEvent } from '@/lib/api'
import { useAutoScroll } from '@/lib/useAutoScroll'
import { AgentMarkdown } from '@/components/Markdown'
import { redirectToLogin } from '@/lib/auth'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'task'
  content: string
  tool?: string
  toolInput?: { path?: string; query?: string; [key: string]: unknown }
  toolOutput?: string
  outputExpanded?: boolean
  task?: TaskEvent
}

interface TaskEvent {
  id: string
  title: string
  description: string
  priority: number
  status: 'proposed' | 'accepted' | 'in_progress' | 'paused' | 'completed' | 'incomplete' | 'rejected' | 'cancelled'
  expanded?: boolean
}

export default function NewChatPage() {
  const params = useParams()
  const owner = params.owner as string
  const repo = params.repo as string

  const [project, setProject] = useState<Project | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const currentAssistantIdRef = useRef<string | null>(null)
  const { messagesEndRef, scrollContainerRef, handleScroll } = useAutoScroll([messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [loading])

  useEffect(() => {
    getCurrentUser()
      .then(() => setIsLoggedIn(true))
      .catch(() => setIsLoggedIn(false))

    getProjectByPath(owner, repo)
      .then(setProject)
      .catch((err) => {
        console.error(err)
        if (err.message.includes('401')) {
          redirectToLogin(`/${owner}/${repo}/chat`)
        }
      })
      .finally(() => setLoading(false))
  }, [owner, repo])

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
    if (inputRef.current) inputRef.current.style.height = 'auto'

    const initialAssistantId = (Date.now() + 1).toString()
    currentAssistantIdRef.current = initialAssistantId
    setMessages((prev) => [...prev, { id: initialAssistantId, role: 'assistant', content: '' }])

    abortControllerRef.current = new AbortController()

    try {
      let convId = conversationId
      if (!convId) {
        if (!project) {
          throw new Error('Project not loaded')
        }
        const conversation = await createConversation(project.id)
        convId = conversation.id
        setConversationId(convId)
      }

      await sendMessageStream(
        convId!,
        userMessage.content,
        (event: StreamEvent) => {
          if (event.type === 'tool_call' && event.tool) {
            const toolId = Date.now().toString()
            const newAssistantId = (Date.now() + 1).toString()
            const currentId = currentAssistantIdRef.current

            setMessages((prev) => {
              const filtered = prev.filter((msg) =>
                !(msg.id === currentId && msg.content === '')
              )
              return [
                ...filtered,
                {
                  id: toolId,
                  role: 'tool' as const,
                  content: '',
                  tool: event.tool,
                  toolInput: (event.input || {}) as Message['toolInput'],
                },
                {
                  id: newAssistantId,
                  role: 'assistant' as const,
                  content: '',
                },
              ]
            })
            currentAssistantIdRef.current = newAssistantId
          } else if ((event.type === 'text' || event.type === 'error') && event.content) {
            const currentId = currentAssistantIdRef.current
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === currentId
                  ? { ...msg, content: msg.content + event.content }
                  : msg
              )
            )
          } else if (event.type === 'tool_result' && event.tool && event.output !== undefined) {
            setMessages((prev) => {
              const toolIndex = [...prev].reverse().findIndex(
                (msg) => msg.role === 'tool' && msg.tool === event.tool
              )
              if (toolIndex === -1) return prev

              const actualIndex = prev.length - 1 - toolIndex
              return prev.map((msg, i) =>
                i === actualIndex
                  ? { ...msg, toolOutput: event.output }
                  : msg
              )
            })
          } else if (event.type === 'event' && event.event === 'task_created' && event.task) {
            const task = event.task as TaskEvent
            setMessages((prev) => [
              ...prev,
              {
                id: `task-${task.id}`,
                role: 'task' as const,
                content: '',
                task: task,
              }
            ])
          }
        },
        abortControllerRef.current.signal
      )

      window.history.replaceState({}, '', `/${owner}/${repo}/chat/${convId}`)
    } catch (error) {
      const currentId = currentAssistantIdRef.current
      if (error instanceof Error && error.name === 'AbortError') {
        setMessages((prev) => {
          const lastAssistant = [...prev].reverse().find((m) => m.role === 'assistant')
          if (lastAssistant?.content) {
            return prev.map((msg) =>
              msg.id === lastAssistant.id
                ? { ...msg, content: msg.content + ' (stopped)' }
                : msg
            )
          }
          return prev
        })
      } else if (error instanceof Error && error.message.includes('401')) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentId
              ? { ...msg, content: 'Please sign in to contribute ideas. Redirecting...' }
              : msg
          )
        )
        setTimeout(() => {
          redirectToLogin(`/${owner}/${repo}/chat`)
        }, 1500)
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Something went wrong'
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentId
              ? { ...msg, content: `Error: ${errorMessage}. Please try again.` }
              : msg
          )
        )
      }
    } finally {
      abortControllerRef.current = null
      currentAssistantIdRef.current = null
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const autoResize = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-900 font-medium mb-1">Project not found</p>
        <p className="text-gray-500 text-sm mb-6">This project doesn&apos;t exist or you don&apos;t have access.</p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2"
          >
            Retry
          </button>
          <Link href="/explore" className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2">
            Browse projects
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b border-gray-100 px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <Link
            href={`/${owner}/${repo}`}
            className="p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <span className="font-medium text-gray-900">{project.name}</span>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500">chat</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto" ref={scrollContainerRef} onScroll={handleScroll}>
        <div className="max-w-2xl mx-auto px-6 py-6">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                What would you like to build?
              </h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto leading-relaxed">
                Describe a feature, improvement, or fix. The agent will evaluate it
                against the project vision and queue it for implementation.
              </p>
              {project.vision && (
                <div className="mt-8 p-4 rounded-xl bg-gray-50 border border-gray-100 text-left max-w-md mx-auto">
                  <p className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Vision</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{project.vision}</p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {messages.map((message, index) => (
              <div key={message.id}>
                {/* User message */}
                {message.role === 'user' && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gray-900 text-white">
                      {message.content}
                    </div>
                  </div>
                )}

                {/* Tool call */}
                {message.role === 'tool' && (
                  <div className="flex justify-start">
                    <div className="rounded-xl bg-gray-50 border border-gray-100 text-gray-600 text-sm font-mono overflow-hidden max-w-[90%]">
                      <div
                        className={`px-3 py-2 flex items-center gap-2 ${message.toolOutput ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                        onClick={() => {
                          if (message.toolOutput) {
                            setMessages(prev => prev.map(m =>
                              m.id === message.id
                                ? { ...m, outputExpanded: !m.outputExpanded }
                                : m
                            ))
                          }
                        }}
                      >
                        {message.toolOutput ? (
                          <span className="text-gray-300 transition-transform duration-200 text-xs" style={{ transform: message.outputExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>{'\u25b6'}</span>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
                        )}
                        <span className="text-gray-600">{message.tool}</span>
                        {message.toolInput?.path && (
                          <span className="text-gray-400 truncate">
                            ({message.toolInput.path})
                          </span>
                        )}
                        {message.toolInput?.query && (
                          <span className="text-gray-400 truncate">
                            ({message.toolInput.query})
                          </span>
                        )}
                      </div>
                      {message.toolOutput && message.outputExpanded && (
                        <div className="border-t border-gray-100 px-3 py-2 bg-white max-h-64 overflow-auto">
                          <pre className="text-xs text-gray-500 whitespace-pre-wrap break-words">
                            {message.toolOutput}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Assistant message */}
                {message.role === 'assistant' && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-white border border-gray-200 text-gray-900">
                      {message.content ? (
                        <AgentMarkdown content={message.content} />
                      ) : (
                        index === messages.length - 1 && sending ? (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                          </span>
                        ) : null
                      )}
                    </div>
                  </div>
                )}

                {/* Task card */}
                {message.role === 'task' && message.task && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-xl overflow-hidden border border-gray-200 bg-white">
                      <div className="px-4 py-2.5 flex items-center gap-2 bg-gray-50 border-b border-gray-100">
                        {message.task.status === 'proposed' ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-gray-900 animate-pulse" />
                            <span className="text-sm font-medium text-gray-900">Task Proposed</span>
                          </>
                        ) : message.task.status === 'rejected' ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-gray-300" />
                            <span className="text-sm font-medium text-gray-500">Task Rejected</span>
                          </>
                        ) : message.task.status === 'cancelled' ? (
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
                        <h4 className="font-medium text-gray-900">{message.task.title}</h4>
                        <div
                          className="cursor-pointer group"
                          onClick={() => {
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === message.id && m.task
                                  ? { ...m, task: { ...m.task, expanded: !m.task.expanded } }
                                  : m
                              )
                            )
                          }}
                        >
                          <p className={`text-sm text-gray-500 mt-1 whitespace-pre-wrap leading-relaxed ${message.task.expanded ? '' : 'line-clamp-2'}`}>
                            {message.task.description}
                          </p>
                          {!message.task.expanded && message.task.description.length > 100 && (
                            <span className="text-xs text-gray-400 group-hover:text-gray-600">show more</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                            P{message.task.priority}
                          </span>
                          <span className="text-xs text-gray-400">
                            {message.task.status}
                          </span>
                        </div>
                        {message.task.status === 'proposed' ? (
                          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                            <button
                              onClick={async () => {
                                try {
                                  await approveTask(message.task!.id)
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === message.id && m.task
                                        ? { ...m, task: { ...m.task, status: 'accepted' as const } }
                                        : m
                                    )
                                  )
                                } catch (err) {
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
                                  await rejectTask(message.task!.id)
                                  setMessages((prev) =>
                                    prev.map((m) =>
                                      m.id === message.id && m.task
                                        ? { ...m, task: { ...m.task, status: 'rejected' as const } }
                                        : m
                                    )
                                  )
                                } catch (err) {
                                  console.error('Failed to reject task:', err)
                                }
                              }}
                              className="flex-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (message.task.status !== 'rejected' && message.task.status !== 'cancelled') && (
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
                )}
              </div>
            ))}
          </div>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-6 py-4 bg-white">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                autoResize()
              }}
              onKeyDown={handleKeyDown}
              placeholder={messages.some(m => m.role === 'task') ? "Refine the task or share another idea..." : "Share an idea..."}
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
            Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  )
}
