'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getProjectByPath, getCurrentUser, getActiveSponsor, getProjectSponsors, createSponsorshipCheckout, setSponsorVision, deleteSponsorVision, type Project, type UserProfile, type Sponsorship } from '@/lib/api'
import { redirectToLogin } from '@/lib/auth'

// Funding stages — each stage unlocks new benefits
const STAGES = [
  {
    threshold: 0,
    label: 'Free',
    description: 'Support the project',
    benefits: ['Name in contributors list', 'Sponsor badge'],
  },
  {
    threshold: 25,
    label: 'Supporter',
    description: 'Keep the lights on',
    benefits: ['Priority idea consideration', 'Sponsor badge on project'],
  },
  {
    threshold: 50,
    label: 'Backer',
    description: 'Shape the roadmap',
    benefits: ['Influence what gets built next', 'Direct impact on priorities'],
  },
  {
    threshold: 100,
    label: 'Patron',
    description: 'Govern the project',
    benefits: ['Vote on project decisions', 'Shape the project vision'],
  },
  {
    threshold: 250,
    label: 'Champion',
    description: 'Become a co-steward',
    benefits: ['Agent Council governance', 'Custom feature requests', 'Logo on project page'],
  },
]

const MIN_AMOUNT = 5
const MAX_AMOUNT = 500
const PRESET_AMOUNTS = [10, 25, 50, 100, 250]

function getStageForAmount(amount: number) {
  let stage = STAGES[0]
  for (const s of STAGES) {
    if (amount >= s.threshold) stage = s
  }
  return stage
}

function getAllBenefitsUpTo(amount: number): string[] {
  const benefits: string[] = []
  for (const s of STAGES) {
    if (amount >= s.threshold) {
      benefits.push(...s.benefits)
    }
  }
  return benefits
}

export default function SponsorPage() {
  const params = useParams()
  const router = useRouter()
  const owner = params.owner as string
  const repo = params.repo as string

  const [project, setProject] = useState<Project | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [activeSponsor, setActiveSponsor] = useState<Sponsorship | null>(null)
  const [totalFunding, setTotalFunding] = useState(0)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const [amount, setAmount] = useState(50)
  const [customInput, setCustomInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const sliderRef = useRef<HTMLDivElement>(null)

  // Sponsor vision state
  const [visionText, setVisionText] = useState('')
  const [visionSaving, setVisionSaving] = useState(false)

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setCurrentUser(user)
        setIsLoggedIn(true)
      })
      .catch(() => {
        setCurrentUser(null)
        setIsLoggedIn(false)
      })
  }, [])

  useEffect(() => {
    getProjectByPath(owner, repo)
      .then(async (p) => {
        setProject(p)
        const [sponsor, sponsorsRes] = await Promise.all([
          getActiveSponsor(p.id).catch(() => null),
          getProjectSponsors(p.id).catch(() => ({ items: [] })),
        ])
        setActiveSponsor(sponsor)
        if (sponsor?.sponsor_vision) {
          setVisionText(sponsor.sponsor_vision)
        }
        const total = sponsorsRes.items.reduce((sum: number, s: Sponsorship) => sum + (s.monthly_amount_usd || s.tier || 0), 0)
        setTotalFunding(total)
      })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false))
  }, [owner, repo, router])

  const handleSliderMove = useCallback((clientX: number) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const raw = MIN_AMOUNT + pct * (MAX_AMOUNT - MIN_AMOUNT)
    const closest = PRESET_AMOUNTS.reduce((prev, curr) =>
      Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev
    )
    const snapped = Math.abs(closest - raw) < 15 ? closest : Math.round(raw / 5) * 5
    setAmount(Math.max(MIN_AMOUNT, Math.min(MAX_AMOUNT, snapped)))
    setCustomInput('')
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    handleSliderMove(e.clientX)
  }, [handleSliderMove])

  useEffect(() => {
    if (!isDragging) return
    const handleMove = (e: MouseEvent) => handleSliderMove(e.clientX)
    const handleUp = () => setIsDragging(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [isDragging, handleSliderMove])

  const handleCustomAmount = (value: string) => {
    setCustomInput(value)
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= MIN_AMOUNT && num <= MAX_AMOUNT) {
      setAmount(num)
    }
  }

  const handleSponsor = async () => {
    if (!project) return
    setCheckoutLoading(true)
    setCheckoutError(null)
    try {
      const { checkout_url } = await createSponsorshipCheckout({
        project_id: project.id,
        amount: amount,
        success_url: `${window.location.origin}/${owner}/${repo}?sponsored=true`,
        cancel_url: `${window.location.origin}/${owner}/${repo}/sponsor`,
      })
      window.location.href = checkout_url
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Checkout failed'
      setCheckoutError(message)
      setCheckoutLoading(false)
    }
  }

  const handleSaveVision = async () => {
    if (!project || !visionText.trim()) return
    setVisionSaving(true)
    try {
      await setSponsorVision(project.id, visionText.trim())
      toast.success('Priority focus saved')
    } catch {
      toast.error('Failed to save priority focus')
    } finally {
      setVisionSaving(false)
    }
  }

  const handleRemoveVision = async () => {
    if (!project) return
    setVisionSaving(true)
    try {
      await deleteSponsorVision(project.id)
      setVisionText('')
      setActiveSponsor(prev => prev ? { ...prev, sponsor_vision: null } : null)
      toast('Priority focus removed')
    } catch {
      toast.error('Failed to remove priority focus')
    } finally {
      setVisionSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto px-6 py-12">
          <div className="animate-pulse">
            <div className="h-8 w-64 bg-gray-100 rounded mb-4" />
            <div className="h-4 w-96 bg-gray-100 rounded mb-12" />
            <div className="h-48 bg-gray-50 rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (!project) return null

  const basePath = `/${owner}/${repo}`
  const currentStage = getStageForAmount(amount)
  const allBenefits = getAllBenefitsUpTo(amount)
  const sliderPct = ((amount - MIN_AMOUNT) / (MAX_AMOUNT - MIN_AMOUNT)) * 100
  const canSetVision = activeSponsor && activeSponsor.tier >= 50

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3">
            Fund {project.name}
          </h1>
          <p className="text-gray-500 max-w-lg mx-auto">
            Your sponsorship fuels the AI agent that builds and grows this project.
            Choose an amount that feels right.
          </p>
        </div>

        {/* Already sponsoring */}
        {activeSponsor && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-center">
            <p className="text-green-800 text-sm">
              You&apos;re currently sponsoring at <strong>${activeSponsor.monthly_amount_usd || activeSponsor.tier}/mo</strong>.
              Selecting a new amount will update your sponsorship.
            </p>
          </div>
        )}

        {/* Checkout error */}
        {checkoutError && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-center">
            <p className="text-red-800 text-sm">{checkoutError}</p>
          </div>
        )}

        {/* Sponsor vision section — visible to $50+ sponsors */}
        {canSetVision && (
          <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">Your Priority Focus</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Tell the AI agent what to prioritize. Ideas that align with your focus get higher priority.
            </p>
            <textarea
              value={visionText}
              onChange={(e) => setVisionText(e.target.value)}
              placeholder='e.g., "Focus on academic writing features" or "Prioritize mobile experience"'
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder:text-gray-400"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-400">{visionText.length}/500</span>
              <div className="flex gap-2">
                {activeSponsor.sponsor_vision && (
                  <button
                    onClick={handleRemoveVision}
                    disabled={visionSaving}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
                <button
                  onClick={handleSaveVision}
                  disabled={visionSaving || !visionText.trim()}
                  className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {visionSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main card */}
        <div className="bg-white border border-gray-200 rounded-xl p-8 mb-6">
          {/* Amount display */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-1 mb-1">
              <span className="text-5xl font-semibold text-gray-900 tabular-nums">${amount}</span>
              <span className="text-gray-400 text-lg">/mo</span>
            </div>
            <span className="text-sm font-medium text-violet-600">{currentStage.label}</span>
            <span className="text-sm text-gray-400 ml-2">&mdash; {currentStage.description}</span>
          </div>

          {/* Slider */}
          <div className="mb-6">
            <div
              ref={sliderRef}
              className="relative h-10 cursor-pointer select-none"
              onMouseDown={handleMouseDown}
            >
              {/* Track */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2 bg-gray-100 rounded-full">
                {/* Fill */}
                <div
                  className="h-full bg-violet-500 rounded-full transition-[width] duration-75"
                  style={{ width: `${sliderPct}%` }}
                />
              </div>

              {/* Stage markers */}
              {STAGES.filter(s => s.threshold > 0).map((stage) => {
                const pct = ((stage.threshold - MIN_AMOUNT) / (MAX_AMOUNT - MIN_AMOUNT)) * 100
                return (
                  <div
                    key={stage.threshold}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                    style={{ left: `${pct}%` }}
                  >
                    <div className={`w-3 h-3 rounded-full border-2 ${
                      amount >= stage.threshold
                        ? 'bg-violet-500 border-violet-500'
                        : 'bg-white border-gray-300'
                    }`} />
                  </div>
                )
              })}

              {/* Thumb */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-white border-2 border-violet-500 rounded-full shadow-sm transition-[left] duration-75"
                style={{ left: `${sliderPct}%` }}
              />
            </div>

            {/* Stage labels below slider */}
            <div className="relative h-6 mt-1">
              {STAGES.filter(s => s.threshold > 0).map((stage) => {
                const pct = ((stage.threshold - MIN_AMOUNT) / (MAX_AMOUNT - MIN_AMOUNT)) * 100
                return (
                  <button
                    key={stage.threshold}
                    className={`absolute -translate-x-1/2 text-xs transition-colors ${
                      amount >= stage.threshold ? 'text-violet-600 font-medium' : 'text-gray-400'
                    } hover:text-gray-600`}
                    style={{ left: `${pct}%` }}
                    onClick={() => { setAmount(stage.threshold); setCustomInput('') }}
                  >
                    ${stage.threshold}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Preset buttons + custom input */}
          <div className="flex items-center gap-2 mb-8">
            {PRESET_AMOUNTS.map((preset) => (
              <button
                key={preset}
                onClick={() => { setAmount(preset); setCustomInput('') }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  amount === preset && !customInput
                    ? 'bg-violet-100 text-violet-700 border border-violet-300'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                ${preset}
              </button>
            ))}
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min={MIN_AMOUNT}
                max={MAX_AMOUNT}
                placeholder="Custom"
                value={customInput}
                onChange={(e) => handleCustomAmount(e.target.value)}
                className="w-full py-2 pl-7 pr-3 rounded-md text-sm border border-gray-200 focus:border-violet-400 focus:ring-1 focus:ring-violet-400 outline-none"
              />
            </div>
          </div>

          {/* Benefits at this level */}
          <div className="mb-8">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              At ${amount}/mo you get:
            </h3>
            <ul className="space-y-2">
              {allBenefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-violet-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          {isLoggedIn ? (
            <button
              onClick={handleSponsor}
              disabled={checkoutLoading}
              className="w-full py-3 px-4 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {checkoutLoading ? 'Redirecting to Stripe...' : `Sponsor $${amount}/mo`}
            </button>
          ) : (
            <button
              onClick={() => redirectToLogin(`${basePath}/sponsor`)}
              className="w-full py-3 px-4 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors text-center block"
            >
              Sign in to sponsor
            </button>
          )}
        </div>

        {/* Project funding progress */}
        {totalFunding > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Project funding</h3>
              <span className="text-sm text-gray-500">${totalFunding}/mo total</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-400 to-violet-600 rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalFunding / 500) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>$0</span>
              <span>$500/mo goal</span>
            </div>
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Sponsorships are recurring monthly payments processed by Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  )
}
