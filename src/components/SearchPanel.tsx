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
      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">origin</span>
      {result.provenance.pr_url ? (
        <a
          href={result.provenance.pr_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-violet-600 hover:text-violet-800 truncate"
          onClick={e => e.stopPropagation()}
        >
          {parts.join(' · ')}
        </a>
      ) : (
        <span className="text-xs text-gray-500 truncate">{parts.join(' · ')}</span>
      )}
    </div>
  )
}

function ResultCard({ result }: { result: SearchResult }) {
  const scorePct = Math.round(result.score * 100)

  return (
    <div className="px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-gray-100 text-gray-600 uppercase tracking-wider shrink-0">
              {TYPE_ICONS[result.result_type] || result.result_type}
            </span>
            {result.file_path && (
              <span className="text-sm font-mono text-gray-700 truncate">
                {result.file_path}
                {result.start_line != null && `:${result.start_line}`}
                {result.end_line != null && result.start_line !== result.end_line && `-${result.end_line}`}
              </span>
            )}
            {result.title && !result.file_path && (
              <span className="text-sm font-medium text-gray-800 truncate">{result.title}</span>
            )}
            {result.category && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600">
                {result.category}
              </span>
            )}
            {result.language && (
              <span className="text-[10px] text-gray-400 font-mono">{result.language}</span>
            )}
          </div>

          {/* Content */}
          <p className="text-sm text-gray-600 mt-1 line-clamp-3 whitespace-pre-wrap font-mono leading-relaxed">
            {result.content.slice(0, 300)}
          </p>

          {/* Tags */}
          {result.tags && result.tags.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {result.tags.slice(0, 5).map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
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
          <span className={`text-xs font-mono tabular-nums ${scorePct >= 70 ? 'text-green-600' : scorePct >= 40 ? 'text-gray-500' : 'text-gray-400'}`}>
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
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Search input */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search code, knowledge, conversations..."
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin shrink-0" />
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 py-2 border-b border-gray-100 flex gap-1 overflow-x-auto">
        {TYPE_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => handleFilterChange(f.key)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              activeFilter === f.key
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className={fullPage ? 'overflow-y-auto' : 'max-h-[500px] overflow-y-auto'}>
        {!searched && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            Search across this project&apos;s code, knowledge, and conversation history
          </div>
        )}

        {searched && !loading && results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            No results found for &ldquo;{query}&rdquo;
          </div>
        )}

        {results.map((result, i) => (
          <ResultCard key={`${result.result_type}-${i}`} result={result} />
        ))}

        {searched && results.length > 0 && (
          <div className="px-4 py-2 text-center text-xs text-gray-400 border-t border-gray-100">
            {total} result{total !== 1 ? 's' : ''} · hybrid lexical + semantic search
          </div>
        )}
      </div>
    </div>
  )
}
