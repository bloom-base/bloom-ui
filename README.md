# Bloom UI

The frontend for [Bloom](https://bloomit.ai) — an open source platform where software grows on its own and humans water it with ideas.

**Live at**: [dev.bloomit.ai](https://dev.bloomit.ai)

## What is this?

This is the public UI for Bloom. It's a Next.js app that talks to the Bloom API. The community can contribute UI improvements, new components, and design ideas — and Bloom's own AI agents will review and ship them.

This repo is itself a project on Bloom. Meta.

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Inter** (body) + **Geist Mono** (code)

## Design Philosophy

Light. Clean. Fast. Reference: OpenAI, GitHub, Linear, Vercel.

1. White backgrounds, grayscale palette, content breathes
2. Typography hierarchy through size/weight, not color
3. 90% grayscale, 10% accent — color only for status/interaction
4. Under 200ms transitions, skeleton loading
5. Developer native — no hand-holding
6. One clear action per view

## Getting Started

```bash
npm install
cp .env.example .env
npm run dev
```

The app connects to `https://api.bloomit.ai` by default. For local backend development, change `NEXT_PUBLIC_API_URL` to `http://localhost:8000`.

## Scripts

```bash
npm run dev          # Dev server (localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run type-check   # TypeScript check
npm run test:run     # Run tests
```

## Structure

```
src/
├── app/                    # Pages (App Router)
│   ├── page.tsx           # Homepage
│   ├── explore/           # Public project showcase
│   ├── [owner]/[repo]/    # Project detail, chat, analytics, knowledge
│   ├── pricing/           # Pricing page
│   ├── auth/              # Login, register, password reset
│   └── api/auth/          # OAuth callback routes
├── components/            # Reusable components
│   ├── AgentWorkspace     # Live agent task execution
│   ├── Dashboard          # Project overview
│   ├── DiffViewer         # Code diff display
│   ├── ProjectCard        # Project listing card
│   ├── Nav / Footer       # Layout
│   └── ...
└── lib/                   # Utilities
    ├── api.ts             # API client (all endpoints)
    ├── auth.ts            # Auth helpers
    └── utils.ts           # Shared utilities
```

## API Reference

See [docs/api-reference.md](docs/api-reference.md) for the full Bloom API reference that this UI consumes.

## Contributing

This is a Bloom project — you can contribute by:

1. **Chat with the agent** at [bloomit.ai](https://bloomit.ai) to suggest UI improvements
2. **Open a PR** with code changes directly
3. **File issues** for bugs or feature requests

Bloom's AI agents will review PRs and provide feedback.

## License

MIT
