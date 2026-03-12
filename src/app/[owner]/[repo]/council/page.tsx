'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getProjectByPath, getCurrentUser, getProjectProposals, getProjectSponsors, createProposal, getDebateEntries, getProposalVotes, type Project, type UserProfile, type VisionProposal, type Sponsorship, type DebateEntry, type CouncilVote } from '@/lib/api'

export default function CouncilPage() {
  const params = useParams()
  const router = useRouter()
  const owner = params.owner as string
  const repo = params.repo as string

  const [project, setProject] = useState<Project | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [proposals, setProposals] = useState<VisionProposal[]>([])
  const [sponsors, setSponsors] = useState<Sponsorship[]>([])
  const [loading, setLoading] = useState(true)
  const [isGovernor, setIsGovernor] = useState(false)

  // New proposal form
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formVision, setFormVision] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Expanded proposal details
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [debateEntries, setDebateEntries] = useState<DebateEntry[]>([])
  const [votes, setVotes] = useState<CouncilVote[]>([])

  useEffect(() => {
    Promise.all([
      getCurrentUser().catch(() => null),
      getProjectByPath(owner, repo).catch(() => null),
    ]).then(async ([user, proj]) => {
      setCurrentUser(user)
      if (!proj) {
        router.push('/')
        return
      }
      setProject(proj)

      const [allProposals, sponsorsRes] = await Promise.all([
        getProjectProposals(proj.id).catch(() => []),
        getProjectSponsors(proj.id).catch(() => ({ items: [] })),
      ])
      setProposals(allProposals)
      const allSponsors = sponsorsRes.items
      setSponsors(allSponsors)

      // Check if current user is a $100 Patron
      if (user) {
        const isPatron = allSponsors.some(
          (s: Sponsorship) => s.sponsor_id === user.id && s.tier >= 100 && s.is_active
        )
        setIsGovernor(isPatron)
      }

      setLoading(false)
    })
  }, [owner, repo, router])

  const handleSubmitProposal = async () => {
    if (!project || !formTitle.trim() || !formVision.trim()) return
    setSubmitting(true)
    setFormError(null)
    try {
      const newProposal = await createProposal(project.id, {
        title: formTitle.trim(),
        description: formDescription.trim(),
        proposed_vision: formVision.trim(),
      })
      setProposals(prev => [newProposal, ...prev])
      setShowForm(false)
      setFormTitle('')
      setFormDescription('')
      setFormVision('')
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create proposal')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleExpand = async (proposalId: string) => {
    if (expandedId === proposalId) {
      setExpandedId(null)
      return
    }
    setExpandedId(proposalId)
    if (project) {
      const [entries, voteList] = await Promise.all([
        getDebateEntries(project.id, proposalId).catch(() => []),
        getProposalVotes(project.id, proposalId).catch(() => []),
      ])
      setDebateEntries(entries)
      setVotes(voteList)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-gray-100 rounded mb-4" />
            <div className="h-4 w-96 bg-gray-100 rounded mb-12" />
            <div className="space-y-4">
              <div className="h-32 bg-gray-50 rounded-xl" />
              <div className="h-32 bg-gray-50 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!project) return null

  const basePath = `/${owner}/${repo}`
  const hasOpenProposal = proposals.some(p => p.status === 'open')

  const statusBadge = (status: string) => {
    const config: Record<string, { label: string; cls: string }> = {
      open: { label: 'Open', cls: 'bg-blue-50 text-blue-700' },
      passed: { label: 'Passed', cls: 'bg-green-50 text-green-700' },
      rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700' },
      expired: { label: 'Expired', cls: 'bg-gray-100 text-gray-500' },
    }
    const c = config[status] || config.expired
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.cls}`}>{c.label}</span>
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3">
            Governance Council
          </h1>
          <p className="text-gray-500">
            Patron sponsors propose and vote on vision changes. AI agents debate on behalf of their sponsors.
          </p>
        </div>

        {/* Current vision */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Current Vision</h3>
          <p className="text-gray-900">{project.vision || 'No vision defined yet.'}</p>
        </div>

        {/* Eligible voters */}
        {sponsors.filter(s => s.tier >= 100 && s.is_active).length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Council Members</h3>
            <div className="flex gap-3 flex-wrap">
              {sponsors
                .filter(s => s.tier >= 100 && s.is_active)
                .map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-1.5">
                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-500">
                      {(s.display_name || s.sponsor_username)?.[0]?.toUpperCase() || '?'}
                    </div>
                    {s.display_name || s.sponsor_username}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* New proposal button */}
        {isGovernor && !hasOpenProposal && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="mb-8 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            New Proposal
          </button>
        )}

        {/* New proposal form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
            <h3 className="text-sm font-medium text-gray-900 mb-4">New Vision Proposal</h3>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-red-800 text-sm">{formError}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Refocus on enterprise features"
                  maxLength={200}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Why this change?</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Explain why the vision should change..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-gray-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Proposed New Vision</label>
                <textarea
                  value={formVision}
                  onChange={(e) => setFormVision(e.target.value)}
                  placeholder="The new vision text..."
                  rows={3}
                  maxLength={2000}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-gray-300"
                />
                <span className="text-xs text-gray-400 mt-1 block">{formVision.length}/2000</span>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitProposal}
                  disabled={submitting || !formTitle.trim() || !formVision.trim()}
                  className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Proposal'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Proposals list */}
        <div className="space-y-4">
          {proposals.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No proposals yet. Patron sponsors can propose vision changes.
            </div>
          ) : (
            proposals.map(proposal => (
              <div key={proposal.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleExpand(proposal.id)}
                  className="w-full text-left p-5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {statusBadge(proposal.status)}
                        <span className="text-sm font-medium text-gray-900">{proposal.title}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        by {proposal.proposer_username || 'Unknown'} &middot; {new Date(proposal.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="text-green-600">{proposal.votes_for} for</span>
                      <span className="text-red-500">{proposal.votes_against} against</span>
                      {proposal.votes_abstain > 0 && <span>{proposal.votes_abstain} abstain</span>}
                    </div>
                  </div>
                </button>

                {expandedId === proposal.id && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50">
                    {/* Proposed vision */}
                    <div className="mb-4">
                      <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Proposed Vision</h4>
                      <p className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-gray-200">
                        {proposal.proposed_vision}
                      </p>
                    </div>

                    {/* Description */}
                    {proposal.description && (
                      <div className="mb-4">
                        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Rationale</h4>
                        <p className="text-sm text-gray-600">{proposal.description}</p>
                      </div>
                    )}

                    {/* Debate entries */}
                    {debateEntries.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">AI Debate</h4>
                        <div className="space-y-3">
                          {debateEntries.map(entry => (
                            <div key={entry.id} className={`rounded-lg p-3 text-sm ${
                              entry.position === 'for'
                                ? 'bg-green-50 border border-green-200'
                                : 'bg-red-50 border border-red-200'
                            }`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-medium uppercase ${
                                  entry.position === 'for' ? 'text-green-700' : 'text-red-700'
                                }`}>
                                  {entry.position}
                                </span>
                              </div>
                              <p className="text-gray-700">{entry.argument}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Votes */}
                    {votes.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Votes</h4>
                        <div className="space-y-2">
                          {votes.map(vote => (
                            <div key={vote.id} className="flex items-start gap-2 text-sm">
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                vote.choice === 'for' ? 'bg-green-100 text-green-700' :
                                vote.choice === 'against' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                {vote.choice}
                              </span>
                              <span className="text-gray-600">{vote.reasoning}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {proposal.status === 'passed' && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                        This proposal passed. The project vision has been updated.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
