import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
}

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-semibold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-10">Last updated: February 27, 2026</p>

      <div className="prose prose-gray max-w-none [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:mt-10 [&_h2]:mb-4 [&_p]:text-gray-600 [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:text-gray-600 [&_ul]:mb-4 [&_li]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-800 [&_h3]:mt-6 [&_h3]:mb-2">
        <h2>1. Information We Collect</h2>

        <h3>Account information</h3>
        <p>
          When you create an account, we collect your email address, display name, and username. If you register via GitHub OAuth, we also receive your GitHub user ID, username, email, and avatar URL from GitHub.
        </p>

        <h3>Authentication data</h3>
        <p>
          We store hashed passwords (bcrypt) for email/password accounts. We store GitHub access tokens for users who authenticate via GitHub. These tokens are used to access GitHub on your behalf (repo operations, webhook setup).
        </p>

        <h3>API keys</h3>
        <p>
          If you use BYOK (Bring Your Own Key), we store your Anthropic API key. It is used only to execute AI agent tasks on your behalf and can be removed at any time.
        </p>

        <h3>Usage data</h3>
        <p>
          We collect information about how you use the Service: conversations with agents, ideas submitted, tasks created, and interaction patterns. This data is used to operate the platform and improve the AI agent experience.
        </p>

        <h3>Payment information</h3>
        <p>
          Payment processing is handled by Stripe. We do not store credit card numbers or full payment details. We store Stripe customer IDs and subscription status.
        </p>

        <h2>2. How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Operate and maintain the Service, including running AI agents on your behalf.</li>
          <li>Authenticate your identity and manage your account.</li>
          <li>Process payments and manage subscriptions.</li>
          <li>Send email notifications about task progress (you can opt out from your profile).</li>
          <li>Provide customer support.</li>
          <li>Improve the Service and develop new features.</li>
          <li>Enforce our Terms of Service and prevent abuse.</li>
        </ul>

        <h2>3. Information Sharing</h2>
        <p>We do not sell your personal information. We share information only in these circumstances:</p>
        <ul>
          <li><strong>Public profiles</strong>: Your username, display name, avatar, and contributions to public projects are visible at your public profile page.</li>
          <li><strong>Public projects</strong>: Ideas and conversations in public projects are visible to other authenticated users.</li>
          <li><strong>Service providers</strong>: We use third-party services (Stripe for payments, Resend for emails, Anthropic for AI, GitHub for code hosting, Fly.io for infrastructure) that process data on our behalf.</li>
          <li><strong>Legal requirements</strong>: We may disclose information if required by law or to protect our rights and safety.</li>
        </ul>

        <h2>4. Data Storage and Security</h2>
        <p>
          Your data is stored on servers operated by Fly.io with PostgreSQL databases. We use encryption in transit (TLS) and at rest. Passwords are hashed with bcrypt. Session tokens are JWTs with expiration. We implement rate limiting, audit logging, and access controls to protect your data.
        </p>

        <h2>5. Cookies</h2>
        <p>
          We use HTTP-only session cookies (<code className="text-sm bg-gray-100 px-1 rounded">bloom_session</code>) for authentication. We do not use tracking cookies or third-party analytics cookies.
        </p>

        <h2>6. Email Communications</h2>
        <p>
          We send transactional emails (account verification, password reset) and notification emails (task progress updates). You can disable notification emails from your profile settings. Transactional emails cannot be disabled as they are essential for account security.
        </p>

        <h2>7. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li><strong>Access</strong> your personal data via your profile and API.</li>
          <li><strong>Correct</strong> inaccurate data by updating your profile.</li>
          <li><strong>Delete</strong> your account and associated data.</li>
          <li><strong>Export</strong> your data by contacting us.</li>
          <li><strong>Opt out</strong> of notification emails from your profile settings.</li>
        </ul>

        <h2>8. Data Retention</h2>
        <p>
          We retain your data for as long as your account is active. After account deletion, we remove personal data within 30 days. Contributions to public open source projects (code, PRs) remain as part of the project&apos;s public git history, as is standard for open source contributions.
        </p>

        <h2>9. Children&apos;s Privacy</h2>
        <p>
          The Service is not intended for children under 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected data from a child under 13, we will delete it promptly.
        </p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. We will notify users of material changes via email or in-app notice. The &ldquo;Last updated&rdquo; date at the top reflects the most recent revision.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions about this policy? Reach us at{' '}
          <a href="mailto:privacy@bloomit.ai" className="text-gray-900 underline underline-offset-2 hover:text-gray-600">
            privacy@bloomit.ai
          </a>.
        </p>
      </div>

      <div className="mt-12 pt-8 border-t border-gray-100 text-sm text-gray-400">
        <Link href="/terms" className="hover:text-gray-600 transition-colors">
          Terms of Service &rarr;
        </Link>
      </div>
    </div>
  )
}
