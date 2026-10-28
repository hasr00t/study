# CLAUDE.md

Guidance for Claude Code (and contributors) working in this repo.

## What this is

An AI study-guide pipeline. The `/learn-topic` Claude Code skill
(`skill/SKILL.md`) researches a topic across Claude, Perplexity and ChatGPT,
fact-checks the results against primary sources, and produces a study guide. A
converter turns the guide into JSON, and a Next.js app (`web/`) renders it with a
graded quiz.

## Layout

```
skill/SKILL.md   the /learn-topic skill (three phases: gather, combine, build)
skill/deslop.md  vendored de-slop rules the Phase 2 pass applies to the guide
lib/             Node ESM scripts, each with a Vitest suite:
  prompts.js       build the Perplexity and ChatGPT research prompts
  api-clients.js   Perplexity (sonar-pro) and OpenAI (gpt-4o) calls, with retry
  guide-to-json.js study-guide markdown -> JSON for the web app
web/             Next.js 16 (App Router) + Tailwind v4, static export
  public/guides/   generated guide JSON (the app reads every *.json here)
ghost-spns/      a complete worked example (prompts, research, guide, notes)
docs/            design spec and walkthrough
```

## Conventions

- **ESM everywhere** (`"type": "module"`). Node 20.12+.
- **CLI entry guard:** lib scripts gate CLI code on
  `fileURLToPath(import.meta.url) === process.argv[1]`, so importing them never
  runs the CLI. Keep this pattern when adding scripts.
- **TDD:** there is a Vitest suite per lib module; add tests with new behaviour.
- **API keys** come from env vars or `.env` only — never commit them, never write
  them into prompts, research files, guides or JSON.
- **Guide format is a contract.** `guide-to-json.js` parses specific `##`/`###`
  headings (`What You'll Learn`, `Priming Pass`, `Key Concepts & Definitions`,
  `Rules & Frameworks`, `Comprehensive Breakdown`, `Common Misconceptions`,
  `Connections & Context`, `Implementation`, `Reinforcement Questions`). A quiz
  answer line (`> **b** — explanation → Section Title`) links to a breakdown
  heading by exact title. Changing these means changing the parser too.
- **Tailwind v4:** no `tailwind.config.js`; design tokens live in an
  `@theme inline` block in `web/app/globals.css`.
- **Next.js dynamic route:** `params` is a Promise in `app/guide/[slug]/page.tsx`.
  `generateStaticParams` emits a placeholder slug when there are no guides, so the
  static export still builds on a fresh clone.

## Commands

```bash
npm install          # workspace install (lib + web)
npm run test:lib     # Vitest
cd web && npm run dev     # local viewer at http://localhost:3000
cd web && npm run build   # static export to web/out/
```
