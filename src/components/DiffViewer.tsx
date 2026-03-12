'use client'

import { useState } from 'react'
import type { PRFileChange } from '@/lib/api'

function parsePatch(patch: string): { type: 'add' | 'del' | 'hunk' | 'ctx'; text: string }[] {
  if (!patch) return []
  return patch.split('\n').map(line => {
    if (line.startsWith('@@')) return { type: 'hunk' as const, text: line }
    if (line.startsWith('+')) return { type: 'add' as const, text: line }
    if (line.startsWith('-')) return { type: 'del' as const, text: line }
    return { type: 'ctx' as const, text: line }
  })
}

const lineColors = {
  add: 'bg-green-50 text-green-900',
  del: 'bg-red-50 text-red-900',
  hunk: 'bg-blue-50 text-blue-700',
  ctx: '',
}

function FileStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    added: 'bg-green-50 text-green-700',
    modified: 'bg-yellow-50 text-yellow-700',
    removed: 'bg-red-50 text-red-700',
    renamed: 'bg-blue-50 text-blue-700',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

function FileDiff({ file }: { file: PRFileChange }) {
  const [collapsed, setCollapsed] = useState(false)
  const lines = parsePatch(file.patch)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        className="flex items-center gap-2 w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-gray-400 text-xs">{collapsed ? '\u25b6' : '\u25bc'}</span>
        <span className="text-xs font-mono text-gray-900 truncate flex-1">{file.filename}</span>
        <FileStatusBadge status={file.status} />
        <span className="text-[10px] font-mono text-green-600">+{file.additions}</span>
        <span className="text-[10px] font-mono text-red-600">-{file.deletions}</span>
      </button>
      {!collapsed && lines.length > 0 && (
        <div className="overflow-x-auto">
          <pre className="text-[11px] leading-[18px] font-mono">
            {lines.map((line, i) => (
              <div key={i} className={`px-3 ${lineColors[line.type]}`}>
                {line.text}
              </div>
            ))}
          </pre>
        </div>
      )}
      {!collapsed && lines.length === 0 && (
        <div className="px-3 py-2 text-xs text-gray-400">Binary file or no diff available</div>
      )}
    </div>
  )
}

export default function DiffViewer({
  files,
  loading,
  onClose,
}: {
  files: PRFileChange[]
  loading: boolean
  onClose: () => void
}) {
  const totalAdd = files.reduce((s, f) => s + f.additions, 0)
  const totalDel = files.reduce((s, f) => s + f.deletions, 0)

  return (
    <div className="mt-2 border border-gray-200 rounded-xl bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-700">Changes</span>
          {!loading && (
            <>
              <span className="text-[10px] font-mono text-gray-500">{files.length} files</span>
              <span className="text-[10px] font-mono text-green-600">+{totalAdd}</span>
              <span className="text-[10px] font-mono text-red-600">-{totalDel}</span>
            </>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="text-gray-400 hover:text-gray-600 text-xs"
          aria-label="Close diff viewer"
        >
          Close
        </button>
      </div>
      <div className="max-h-[500px] overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs text-gray-400">Loading diff...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-4">No file changes</div>
        ) : (
          files.map(file => <FileDiff key={file.filename} file={file} />)
        )}
      </div>
    </div>
  )
}
