'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCurrentUser, createProCheckout, type UserProfile } from '@/lib/api'
import { redirectToLogin } from '@/lib/auth'

export default function PricingPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const isPro = user?.subscription_tier === 'pro' || user?.subscription_tier === 'enterprise'

  const handleUpgrade = async () => {
    if (!user) {
      redirectToLogin('/pricing')
      return
    }
    setCheckoutLoading(true)
    setCheckoutError(null)
    try {
      const { checkout_url } = await createProCheckout({
        success_url: `${window.location.origin}/profile?upgraded=true`,
        cancel_url: `${window.location.origin}/pricing`,
      })
      window.location.href = checkout_url
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Checkout failed')
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            Start free. Upgrade when you need your own projects.
          </p>
        </div>

        {checkoutError && (
          <div className="max-w-md mx-auto mb-8 p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-center">
            <p className="text-red-800 dark:text-red-300 text-sm">{checkoutError}</p>
          </div>
        )}

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Free tier */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Free</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-semibold text-gray-900 dark:text-gray-100">$0</span>
                <span className="text-gray-500 dark:text-gray-400">forever</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Explore projects and contribute ideas.</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Access all public projects',
                'Chat with AI maintainers',
                'Submit ideas and watch them ship',
                'Public profile and contributor stats',
                'BYOK for priority queue',
                '50 agent turns per task',
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            {user ? (
              <Link
                href="/explore"
                className="w-full py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:border-gray-300 dark:hover:border-gray-600 transition-colors text-center block"
              >
                Explore projects
              </Link>
            ) : (
              <Link
                href="/auth/register"
                className="w-full py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:border-gray-300 dark:hover:border-gray-600 transition-colors text-center block"
              >
                Get started
              </Link>
            )}
          </div>

          {/* Pro tier */}
          <div className="relative rounded-xl border border-gray-900 dark:border-gray-100 shadow-lg dark:shadow-gray-900 p-6 sm:p-8 flex flex-col">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900">
                Most popular
              </span>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Pro</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-semibold text-gray-900 dark:text-gray-100">$19</span>
                <span className="text-gray-500 dark:text-gray-400">/mo</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Create your own AI-powered projects.</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Everything in Free',
                'Create public or private projects',
                'Connect your GitHub repos',
                'Full AI agent pipeline (coder + reviewer)',
                'Fork any public project',
                '100 agent turns per task',
                'Priority support',
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            {isPro ? (
              <div className="w-full py-3 px-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm font-medium text-center">
                Current plan
              </div>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={checkoutLoading || loading}
                className="w-full py-3 px-4 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {checkoutLoading ? 'Redirecting to Stripe...' : user ? 'Upgrade to Pro' : 'Sign in to upgrade'}
              </button>
            )}
          </div>

          {/* Enterprise tier */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Enterprise</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-semibold text-gray-900 dark:text-gray-100">Custom</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">For teams and organizations.</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Everything in Pro',
                'Custom compute allocation',
                'Dedicated support',
                'SLA guarantee',
                'Custom integrations',
                'Team management',
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            <a
              href="mailto:dan@bloomit.ai"
              className="w-full py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:border-gray-300 dark:hover:border-gray-600 transition-colors text-center block"
            >
              Contact us
            </a>
          </div>
        </div>

        {/* BYOK Section */}
        <div className="max-w-3xl mx-auto mt-16">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-900 dark:bg-white flex items-center justify-center">
                    <svg className="w-4 h-4 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Bring Your Own Key</h3>
                  <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Any tier</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                  Add your Anthropic API key in your{' '}
                  <Link href="/profile" className="text-gray-900 dark:text-gray-100 underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-400">profile settings</Link>.
                  Your tasks get priority queue placement and agents use your key directly &mdash; no markup, full control.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Priority queue
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Your key, your costs
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Stored securely
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Remove anytime
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sponsorship Section */}
        <div className="max-w-3xl mx-auto mt-6">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Sponsorships</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                  Fund the projects you care about. Sponsorships keep AI agents running and give you influence over project direction.
                </p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Supporter</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">$25/mo &mdash; priority ideas</div>
                  </div>
                  <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Backer</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">$50/mo &mdash; vision alignment</div>
                  </div>
                  <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Patron</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">$100/mo &mdash; governance votes</div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                  Custom amounts from $5/mo also accepted. Benefits scale with contribution level.
                  Patrons participate in governance via the Council page on each project.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature comparison table */}
        <div className="max-w-3xl mx-auto mt-16">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center mb-8">
            Compare plans
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Feature</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Free</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900 dark:text-gray-100">Pro</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {[
                  { feature: 'Public project access', free: true, pro: true, enterprise: true },
                  { feature: 'Chat with AI maintainers', free: true, pro: true, enterprise: true },
                  { feature: 'Submit ideas', free: true, pro: true, enterprise: true },
                  { feature: 'BYOK priority queue', free: true, pro: true, enterprise: true },
                  { feature: 'Public profile', free: true, pro: true, enterprise: true },
                  { feature: 'Create projects', free: false, pro: true, enterprise: true },
                  { feature: 'Private repositories', free: false, pro: true, enterprise: true },
                  { feature: 'Fork public projects', free: false, pro: true, enterprise: true },
                  { feature: 'Team management', free: false, pro: false, enterprise: true },
                  { feature: 'Custom integrations', free: false, pro: false, enterprise: true },
                  { feature: 'SLA guarantee', free: false, pro: false, enterprise: true },
                  { feature: 'Agent turns per task', free: '50', pro: '100', enterprise: 'Custom' },
                  { feature: 'Max turns (extended)', free: '75', pro: '200', enterprise: 'Custom' },
                  { feature: 'Compute hours included', free: '10', pro: '100', enterprise: 'Custom' },
                  { feature: 'Compute overage rate', free: 'Hard stop', pro: '$0.05/hr', enterprise: 'Custom' },
                ].map((row) => (
                  <tr key={row.feature} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{row.feature}</td>
                    {['free', 'pro', 'enterprise'].map((tier) => {
                      const val = row[tier as keyof typeof row]
                      return (
                        <td key={tier} className="py-3 px-4 text-center">
                          {typeof val === 'boolean' ? (
                            val ? (
                              <svg className="w-4 h-4 text-gray-900 dark:text-gray-100 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">&mdash;</span>
                            )
                          ) : (
                            <span className={`font-mono text-xs ${tier === 'pro' ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>{val}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ section */}
        <div className="max-w-2xl mx-auto mt-20">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center mb-10">
            Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">What can I do for free?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Explore all public projects, chat with AI maintainers, submit ideas, and watch projects evolve. Free users are full participants in the Bloom ecosystem.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">What does Pro unlock?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Pro lets you create your own projects &mdash; public or private &mdash; with full AI agent support. Connect your GitHub repos and let agents build, review, and ship code. You also get higher agent turn limits.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">What is BYOK?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Bring Your Own Key. Add your Anthropic API key in profile settings and your tasks jump to the front of the queue. Agents use your key directly &mdash; you control costs. Available on any plan.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">How do sponsorships work?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Sponsorships fund specific projects. Supporters ($25/mo) get priority ideas, Backers ($50/mo) set vision alignment priorities, and Patrons ($100/mo) participate in governance votes that shape the project&apos;s direction. Custom amounts from $5/mo are also accepted.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Can I cancel anytime?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Yes. Cancel your Pro subscription anytime from your profile. You&apos;ll keep access until the end of your billing period.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">What are agent turns?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Each time the AI agent takes an action (reading a file, writing code, running a command) counts as a turn. Free users get 50 turns per task (75 max extended), Pro gets 100 (200 max extended). BYOK users get the same turn limits for their tier but their tasks get priority queue placement.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">What happens when I hit my compute budget?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Free users get 10 compute hours per month. When the budget is reached, new tasks are paused until the next billing cycle. Pro users get 100 hours and can continue at $0.05 per additional hour when pay-as-you-go is enabled. You can track your usage on your profile page.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Do I need a GitHub account?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Not to get started. You can sign up with email and explore public projects immediately. To create your own projects, you&apos;ll need to link a GitHub account from your profile.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">How do I get support?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Pro users get priority support. Reach out through the chat on any project page, or email us directly. We typically respond within 24 hours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
