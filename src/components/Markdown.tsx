'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface AgentMarkdownProps {
  content: string
  /** Use dark theme (for /projects/ routes with dark bg) */
  dark?: boolean
}

export function AgentMarkdown({ content, dark = false }: AgentMarkdownProps) {
  const textColor = dark ? 'text-zinc-100' : 'text-gray-900'
  const mutedColor = dark ? 'text-zinc-400' : 'text-gray-500'
  const codeBg = dark ? 'bg-zinc-900' : 'bg-gray-100'
  const codeBorder = dark ? 'border-zinc-700' : 'border-gray-200'
  const linkColor = dark ? 'text-emerald-400 hover:text-emerald-300' : 'text-violet-600 hover:text-violet-500'

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className={`${textColor} mb-2 last:mb-0`}>{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className={`list-disc list-inside ${textColor} mb-2 space-y-1`}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className={`list-decimal list-inside ${textColor} mb-2 space-y-1`}>{children}</ol>
        ),
        li: ({ children }) => (
          <li>{children}</li>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes('language-')
          if (isBlock) {
            return (
              <code className={`block ${codeBg} rounded px-3 py-2 text-sm font-mono overflow-x-auto border ${codeBorder}`}>
                {children}
              </code>
            )
          }
          return (
            <code className={`${codeBg} rounded px-1.5 py-0.5 text-sm font-mono`}>
              {children}
            </code>
          )
        },
        pre: ({ children }) => (
          <pre className="mb-2 last:mb-0">{children}</pre>
        ),
        a: ({ href, children }) => (
          <a href={href} className={`underline ${linkColor}`} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        h1: ({ children }) => (
          <h1 className={`text-lg font-semibold ${textColor} mb-2`}>{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className={`text-base font-semibold ${textColor} mb-2`}>{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className={`text-sm font-semibold ${textColor} mb-1`}>{children}</h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className={`border-l-2 ${codeBorder} pl-3 ${mutedColor} italic mb-2`}>
            {children}
          </blockquote>
        ),
        hr: () => (
          <hr className={`${codeBorder} my-3`} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
