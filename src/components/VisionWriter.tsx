'use client'

import { useEffect, useRef, useState } from 'react'
import { streamVisionAssist, type VisionAssistMessage } from '@/lib/api'

interface VisionWriterProps {
  projectName: string
  description?: string
  repoName?: string
  onUseVision: (vision: string) => void
  onClose: () => void
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function extractVisionTag(text: string): string | null {
  const match = text.match(/<vision>([\s\S]*?)<\/vision>/)
  return match ? match[1].trim() : null
}

function stripVisionTags(text: string): string {
  return text.replace(/<\/?vision>/g, '')
}

export default function VisionWriter({
  projectName,
  description,
  repoName,
  onUseVision,
  onClose,
}: VisionWriterProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [latestVision, setLatestVision] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return

    const userMsg: ChatMessage = { role: 'user', content: text.trim() }
    const allMessages: ChatMessage[] = [...messages, userMsg]

    setMessages(allMessages)
    setInput('')
    setStreaming(true)

    // Add empty assistant message for streaming into
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    abortRef.current = new AbortController()

    try {
      const apiMessages: VisionAssistMessage[] = allMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      let fullResponse = ''
      await streamVisionAssist(
        projectName,
        apiMessages,
        (text) => {
          fullResponse += text
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              role: 'assistant',
              content: fullResponse,
            }
            return updated
          })
        },
        abortRef.current.signal,
        { description, repoName }
      )

      // Check for vision tag in completed response
      const extracted = extractVisionTag(fullResponse)
      if (extracted) {
        setLatestVision(extracted)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'Something went wrong. Try again?',
          }
          return updated
        })
      }
    } finally {
      setStreaming(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-lg overflow-hidden flex flex-col" style={{ height: '420px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-900">Vision assistant</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500">
              Free-flow your thoughts and I&apos;ll help you refine them into a vision.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {msg.role === 'assistant' ? (
                <AssistantMessage content={msg.content} />
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
              {msg.role === 'assistant' && !msg.content && streaming && i === messages.length - 1 && (
                <span className="inline-block w-1.5 h-4 bg-gray-400 rounded-full animate-pulse ml-0.5" />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Vision suggestion banner */}
      {latestVision && (
        <div className="mx-4 mb-2 p-3 rounded-lg bg-violet-50 border border-violet-200">
          <p className="text-xs font-medium text-violet-700 mb-1.5">Suggested vision</p>
          <p className="text-sm text-violet-900 leading-relaxed mb-2">{latestVision}</p>
          <button
            onClick={() => onUseVision(latestVision)}
            className="px-3 py-1.5 rounded-md bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors"
          >
            Use this vision
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-100 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={messages.length === 0 ? `What do you want ${projectName} to be?` : 'Say more...'}
            rows={1}
            disabled={streaming}
            className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:border-gray-300 disabled:opacity-50"
            style={{ maxHeight: '80px' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="p-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}

/** Renders assistant text, highlighting <vision> blocks */
function AssistantMessage({ content }: { content: string }) {
  // If there's a vision tag, render it with special styling inline
  if (content.includes('<vision>')) {
    const parts = content.split(/<\/?vision>/)
    // parts: [before, visionContent, after]
    return (
      <span className="whitespace-pre-wrap">
        {parts[0]}
        {parts[1] && (
          <span className="block my-1.5 py-1.5 px-2.5 rounded-md bg-violet-100/80 text-violet-900 border-l-2 border-violet-400">
            {parts[1]}
          </span>
        )}
        {parts[2]}
      </span>
    )
  }

  return <span className="whitespace-pre-wrap">{content}</span>
}
