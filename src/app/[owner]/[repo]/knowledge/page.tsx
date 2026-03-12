'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, notFound } from 'next/navigation'
import { toast } from 'sonner'
import {
  getProjectByPath,
  getCurrentUser,
  getProjectKnowledge,
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  type Project,
  type UserProfile,
  type KnowledgeEntry,
} from '@/lib/api'

const RESERVED_PATHS = ['explore', 'new', 'auth', 'api', 'projects', 'settings', '_next', 'favicon.ico', 'profile', 'pricing', 'admin', 'analytics', 'u', 'terms', 'privacy']

const CATEGORIES = [
  { value: 'decision', label: 'Decision', description: 'We chose X over Y because...' },
  { value: 'convention', label: 'Convention', description: 'All API endpoints use snake_case' },
  { value: 'architecture', label: 'Architecture', description: 'Auth system uses JWT, not sessions' },
  { value: 'rejected', label: 'Rejected', description: 'We tried X but it failed because...' },
  { value: 'preference', label: 'Preference', description: 'Owner prefers minimal PRs' },
  { value: 'pattern', label: 'Pattern', description: 'Error handling follows this pattern...' },
  { value: 'context', label: 'Context', description: 'This project is a CLI tool for...' },
] as const

const categoryColors: Record<string, string> = {
  decision: 'bg-blue-50 text-blue-700 border-blue-200',
  convention: 'bg-purple-50 text-purple-700 border-purple-200',
  architecture: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  preference: 'bg-amber-50 text-amber-700 border-amber-200',
  pattern: 'bg-green-50 text-green-700 border-green-200',
  context: 'bg-gray-50 text-gray-600 border-gray-200',
}

export default function KnowledgePage() {
  const params = useParams()
  const owner = params.owner as string
  const repo = params.repo as string

  const [project, setProject] = useState<Project | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Create form
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formCategory, setFormCategory] = useState('decision')
  const [formTags, setFormTags] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editTags, setEditTags] = useState('')

  // Expanded detail
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const canEdit = project && currentUser && (
    project.owner_id === currentUser.id || currentUser.is_admin
  )

  useEffect(() => {
    if (RESERVED_PATHS.includes(owner.toLowerCase())) {
      notFound()
    }
  }, [owner])

  useEffect(() => {
    if (RESERVED_PATHS.includes(owner.toLowerCase())) return

    Promise.all([
      getCurrentUser().catch(() => null),
      getProjectByPath(owner, repo).catch(() => null),
    ]).then(async ([user, proj]) => {
      setCurrentUser(user)
      if (!proj) {
        setLoading(false)
        return
      }
      setProject(proj)
      const knowledgeRes = await getProjectKnowledge(proj.id).catch(() => ({ items: [] }))
      setEntries(knowledgeRes.items)
      setLoading(false)
    })
  }, [owner, repo])

  const refreshEntries = async () => {
    if (!project) return
    const knowledgeRes = await getProjectKnowledge(project.id, {
      category: activeCategory || undefined,
      search: searchQuery || undefined,
    }).catch(() => ({ items: [] }))
    setEntries(knowledgeRes.items)
  }

  useEffect(() => {
    if (project) {
      refreshEntries()
    }
  }, [activeCategory, searchQuery])

  const handleSearch = () => {
    setSearchQuery(searchInput)
  }

  const handleCreate = async () => {
    if (!project || !formTitle.trim() || !formContent.trim()) return
    setSubmitting(true)
    try {
      const tags = formTags.split(',').map(t => t.trim()).filter(Boolean)
      const entry = await createKnowledgeEntry(project.id, {
        title: formTitle.trim(),
        content: formContent.trim(),
        category: formCategory,
        tags,
      })
      setEntries(prev => [entry, ...prev])
      setShowForm(false)
      setFormTitle('')
      setFormContent('')
      setFormCategory('decision')
      setFormTags('')
      toast.success('Knowledge entry created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create entry')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (entry: KnowledgeEntry) => {
    setEditingId(entry.id)
    setEditTitle(entry.title)
    setEditContent(entry.content)
    setEditCategory(entry.category)
    setEditTags(entry.tags.join(', '))
    setExpandedId(entry.id)
  }

  const handleSaveEdit = async () => {
    if (!project || !editingId) return
    try {
      const tags = editTags.split(',').map(t => t.trim()).filter(Boolean)
      const updated = await updateKnowledgeEntry(project.id, editingId, {
        title: editTitle.trim(),
        content: editContent.trim(),
        category: editCategory,
        tags,
      })
      setEntries(prev => prev.map(e => e.id === editingId ? updated : e))
      setEditingId(null)
      toast.success('Knowledge entry updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update entry')
    }
  }

  const handleDelete = async (entryId: string) => {
    if (!project) return
    if (!confirm('Remove this knowledge entry?')) return
    try {
      await deleteKnowledgeEntry(project.id, entryId)
      setEntries(prev => prev.filter(e => e.id !== entryId))
      toast.success('Knowledge entry removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove entry')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-100 rounded-xl w-1/3" />
            <div className="h-4 bg-gray-100 rounded-xl w-2/3" />
            <div className="grid gap-3 mt-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-gray-50 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Project not found</h2>
          <Link href="/explore" className="text-gray-500 hover:text-gray-900 mt-2 block">
            Browse projects
          </Link>
        </div>
      </div>
    )
  }

  const agentEntries = entries.filter(e => e.source_type === 'agent')
  const userEntries = entries.filter(e => e.source_type === 'user')

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Project Knowledge</h1>
            <p className="text-gray-500 mt-1">
              Decisions, conventions, and patterns learned by agents across tasks.
              {entries.length > 0 && (
                <span className="text-gray-400"> {entries.length} entries</span>
              )}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              {showForm ? 'Cancel' : 'Add Entry'}
            </button>
          )}
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="mb-8 border border-gray-200 rounded-xl p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">New Knowledge Entry</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g., Use PostgreSQL arrays for tags"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                <select
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label} — {c.description}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Content</label>
                <textarea
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  rows={4}
                  placeholder="Describe the decision, convention, or pattern..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 resize-y"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={e => setFormTags(e.target.value)}
                  placeholder="e.g., database, performance, api"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={submitting || !formTitle.trim() || !formContent.trim()}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating...' : 'Create Entry'}
              </button>
            </div>
          </div>
        )}

        {/* Search + Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search knowledge..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
            {(searchQuery || searchInput) && (
              <button
                onClick={() => { setSearchInput(''); setSearchQuery('') }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-900"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !activeCategory ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setActiveCategory(activeCategory === c.value ? null : c.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeCategory === c.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Entries */}
        {entries.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl">
            <div className="text-gray-400 mb-2">
              {searchQuery || activeCategory ? 'No matching entries' : 'No knowledge entries yet'}
            </div>
            <p className="text-sm text-gray-400">
              {searchQuery || activeCategory
                ? 'Try adjusting your search or filters.'
                : 'Knowledge entries are created by agents as they work on tasks. You can also add entries manually.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map(entry => (
              <div
                key={entry.id}
                className="border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
              >
                {/* Entry Header (always visible) */}
                <button
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  className="w-full text-left px-5 py-4 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium border ${categoryColors[entry.category] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {entry.category}
                      </span>
                      {entry.source_type === 'agent' && entry.created_by_agent && (
                        <span className="text-[11px] text-gray-400 font-mono">
                          {entry.created_by_agent.toLowerCase()}
                        </span>
                      )}
                      {entry.source_type === 'user' && (
                        <span className="text-[11px] text-gray-400 font-mono">manual</span>
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 truncate">{entry.title}</h3>
                    {expandedId !== entry.id && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">{entry.content}</p>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap font-mono">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </div>
                </button>

                {/* Expanded Content */}
                {expandedId === entry.id && (
                  <div className="px-5 pb-4 border-t border-gray-100">
                    {editingId === entry.id ? (
                      /* Edit Mode */
                      <div className="space-y-3 pt-4">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                        />
                        <select
                          value={editCategory}
                          onChange={e => setEditCategory(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
                        >
                          {CATEGORIES.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                        <textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 resize-y"
                        />
                        <input
                          type="text"
                          value={editTags}
                          onChange={e => setEditTags(e.target.value)}
                          placeholder="Tags (comma-separated)"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 text-gray-500 hover:text-gray-900 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div className="pt-4">
                        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {entry.content}
                        </div>
                        {entry.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {entry.tags.map(tag => (
                              <span key={tag} className="px-2 py-0.5 bg-gray-100 rounded text-[11px] text-gray-500 font-mono">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {canEdit && (
                          <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
                            <button
                              onClick={() => handleEdit(entry)}
                              className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="text-xs text-gray-400 hover:text-red-600 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Stats Footer */}
        {entries.length > 0 && (
          <div className="mt-8 flex items-center gap-6 text-xs text-gray-400 font-mono">
            <span>{agentEntries.length} agent-created</span>
            <span>{userEntries.length} manual</span>
            <span>{new Set(entries.map(e => e.category)).size} categories used</span>
          </div>
        )}
      </div>
    </div>
  )
}
