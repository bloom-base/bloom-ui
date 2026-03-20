'use client'

import { useState, useCallback, useRef } from 'react'
import { searchProject, type SearchResult, type SearchResponse } from '@/lib/api'

const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'code', label: 'Code' },
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'document', label: 'Docs' },
  { key: 'message', label: 'Messages' },
  { key: 'conversation', label: 'Conversations' },
] as const

const TYPE_ICONS: Record<string, string> = {
  code: '{ }',
  document: 'doc',
  conversation: 'chat',
  knowledge: 'kb',
  message: 'msg',
}

function ProvenanceBadge({ result }: { result: SearchResult }) {
  const parts: string[] = []
  if (result.provenance.task_title) parts.push(result.provenance.task_title)
  if (result.provenance.pr_number) parts.push(`PR #${result.provenance.pr_number}`)
  if (result.provenance.commit_sha) parts.push(result.provenance.commit_sha.slice(0, 7))

  if (parts.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-[10px] font-medium text-ink-tertiary uppercase tracking-wider">origin</span>
      {result.provenance.pr_url ? (
        <a
          href={result.provenance.pr_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:text-accent-hover truncate"
          onClick={e => e.stopPropagation()}
        >
          {parts.join(' · ')}
        </a>
      ) : (
        <span className="text-xs text-ink-tertiary truncate">{parts.join(' · ')}</span>
      )}
    </div>
  )
}

function ResultCard({ result }: { result: SearchResult }) {
  const scorePct = Math.round(result.score * 100)

  return (
    <div className="px-4 py-3 border-b border-line-subtle last:border-b-0 hover:bg-canvas-subtle/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-canvas-subtle text-ink-secondary uppercase tracking-wider shrink-0">
              {TYPE_ICONS[result.result_type] || result.result_type}
            </span>
            {result.file_path && (
              <span className="text-sm font-mono text-ink-secondary truncate">
                {result.file_path}
                {result.start_line != null && `:${result.start_line}`}
                {result.end_line != null && result.start_line !== result.end_line && `-${result.end_line}`}
              </span>
            )}
            {result.title && !result.file_path && (
              <span className="text-sm font-medium text-ink truncate">{result.title}</span>
            )}
            {result.category && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-subtle text-accent">
                {result.category}
              </span>
            )}
            {result.language && (
              <span className="text-[10px] text-ink-tertiary font-mono">{result.language}</span>
            )}
          </div>

          {/* Content */}
          <p className="text-sm text-ink-secondary mt-1 line-clamp-3 whitespace-pre-wrap font-mono leading-relaxed">
            {result.content.slice(0, 300)}
          </p>

          {/* Tags */}
          {result.tags && result.tags.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {result.tags.slice(0, 5).map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-canvas-subtle text-ink-tertiary">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Provenance */}
          <ProvenanceBadge result={result} />
        </div>

        {/* Score */}
        <div className="shrink-0 text-right">
          <span className={`text-xs font-mono tabular-nums ${scorePct >= 70 ? 'text-green-600' : scorePct >= 40 ? 'text-ink-secondary' : 'text-ink-tertiary'}`}>
            {scorePct}%
          </span>
        </div>
      </div>
    </div>
  )
}

export default function SearchPanel({ projectId, fullPage }: { projectId: string; fullPage?: boolean }) {
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const runSearch = useCallback(async (q: string, filter: string) => {
    if (!q.trim()) {
      setResults([])
      setTotal(0)
      setSearched(false)
      return
    }

    setLoading(true)
    setSearched(true)

    try {
      const types = filter === 'all' ? undefined : [filter]
      const response = await searchProject(projectId, q, { types, limit: 20 })
      setResults(response.results)
      setTotal(response.total)
    } catch (e) {
      console.error('Search failed:', e)
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(value, activeFilter), 300)
  }

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter)
    if (query.trim()) runSearch(query, filter)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      runSearch(query, activeFilter)
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      {/* Search input */}
      <div className="px-4 py-3 border-b border-line-subtle">
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-ink-tertiary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search code, knowledge, conversations..."
            className="flex-1 text-sm text-ink placeholder-ink-tertiary bg-transparent outline-none"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-line border-t-ink-secondary rounded-full animate-spin shrink-0" />
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 py-2 border-b border-line-subtle flex gap-1 overflow-x-auto">
        {TYPE_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => handleFilterChange(f.key)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              activeFilter === f.key
                ? 'bg-ink text-canvas'
                : 'text-ink-secondary hover:text-ink hover:bg-canvas-subtle'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className={fullPage ? 'overflow-y-auto' : 'max-h-[500px] overflow-y-auto'}>
        {!searched && (
          <div className="px-4 py-8 text-center text-sm text-ink-tertiary">
            Search across this project&apos;s code, knowledge, and conversation history
          </div>
        )}

        {searched && !loading && results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-ink-tertiary">
            No results found for &ldquo;{query}&rdquo;
          </div>
        )}

        {results.map((result, i) => (
          <ResultCard key={`${result.result_type}-${i}`} result={result} />
        ))}

        {searched && results.length > 0 && (
          <div className="px-4 py-2 text-center text-xs text-ink-tertiary border-t border-line-subtle">
            {total} result{total !== 1 ? 's' : ''} · hybrid lexical + semantic search
          </div>
        )}
      </div>
    </div>
  )
}
