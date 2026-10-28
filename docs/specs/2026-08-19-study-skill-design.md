# Study Skill — Design Spec

## Overview

An AI-powered learning pipeline that automates the research, synthesis, and study-guide creation process. Packaged as a Claude Code skill with a Next.js web frontend for viewing generated study guides.

## Problem

Studying a new topic currently requires manually prompting multiple AI tools, saving their output, fact-checking across sources, combining into a coherent guide, and formatting for review. This takes hours of coordination for each topic.

## Solution

A Claude Code skill (`/learn-topic`) that orchestrates the full pipeline: collects the learning goal, dispatches parallel research across Claude + Perplexity + ChatGPT, waits for all research, then combines and fact-checks into a structured study guide with an interactive web UI.

## Components

### 1. Claude Code Skill (`skill/SKILL.md`)

The orchestrator. Three phases:

**Phase 1 — Gather & Dispatch**
- Collect via AskUserQuestion: user's role/background, specific learning goal
- Create study project folder: `{working-dir}/{topic-slug}/research/`
- Dispatch a Claude agent (fork) to conduct independent research → saves to `research/claude-research.md`
- Generate Perplexity and ChatGPT prompts, tailored to the role and goal
- If API keys are set (`PERPLEXITY_API_KEY`, `OPENAI_API_KEY`): run `lib/api-clients.js` to call APIs and save results to `research/perplexity-research.md` and `research/chatgpt-research.md`
- If no API keys: print the generated prompts with instructions to copy-paste into the web UIs and save output to the research folder
- Print a status summary of what's been dispatched/generated

**Phase 2 — Wait & Combine**
- Instruct user to say "continue" when all research is in the folder
- On continue: read all `research/*.md` files
- Dispatch fact-check agents (parallel forks) to verify claims across sources
- Combine all research into a unified study guide markdown following the established structure:
  - What You'll Learn
  - Key Concepts & Definitions (priming)
  - Comprehensive Breakdown (layered sections)
  - Common Misconceptions
  - Connections & Context
  - Reinforcement Questions (4 tiers: recall, comprehension, application, challenge)
- Append a Fact-Check Notes section documenting any corrections
- Save as `{topic-slug}-study-guide.md`

**Phase 3 — Generate Web Guide**
- Run `lib/guide-to-json.js` to convert the markdown into structured JSON
- Save as `{topic-slug}.json` in the web app's `guides/` directory
- Offer next steps: "Run the web app to view", "Publish as artifact", "Quiz me interactively"

### 2. Research Pipeline (`lib/`)

Node.js scripts callable from the skill via Bash.

#### `lib/prompts.js`

Generates research prompts given role + goal. Two exports:

**`generatePerplexityPrompt(role, goal)`** — Produces a prompt optimized for Perplexity's search-augmented generation:
- Instructs to cite every factual claim with a URL
- Requests structured markdown: definitions first, then layered explanation, then examples
- Emphasizes recency and primary sources
- Tailored to the user's role level (e.g., "explain for a security professional" vs "explain for a beginner")
- Output: markdown string

**`generateChatGPTPrompt(role, goal)`** — Produces a prompt optimized for ChatGPT's reasoning mode (o1/think):
- Instructs deep reasoning: explain mechanisms, not just facts
- Challenge assumptions, note common misconceptions
- Include worked examples and analogies appropriate to the role
- Structure as layered sections matching the study guide format
- Cite sources where known, flag uncertainty explicitly
- Output: markdown string

Both prompts are designed to produce markdown with a consistent heading structure so combination is clean.

CLI: `node lib/prompts.js --role "security professional" --goal "understand K8s breakout methods" --format perplexity|chatgpt|both`

#### `lib/api-clients.js`

Optional API automation. Reads keys from environment variables.

**`callPerplexity(prompt)`** — Calls Perplexity Sonar API (`sonar-pro` model), returns markdown with citations. Saves to specified output path.

**`callChatGPT(prompt)`** — Calls OpenAI chat completions API (`o1` model or `gpt-4o` with system prompt for deep reasoning), returns markdown. Saves to specified output path.

Both handle: rate limits (retry with backoff), token limits (chunk if needed), error reporting.

CLI: `node lib/api-clients.js --prompt-file <path> --provider perplexity|openai --output <path>`

#### `lib/combine.js`

Reads all markdown files from a research directory, produces a unified study guide.

Steps:
1. Parse each file's sections (heading-based)
2. Deduplicate concepts across sources
3. Merge definitions into one table (prefer the clearest definition, note conflicts)
4. Interleave breakdown sections by topic (not by source)
5. Collect all cited sources into a unified source list
6. Structure output as the standard study guide markdown format

CLI: `node lib/combine.js --research-dir <path> --output <path> --role <role> --goal <goal>`

#### `lib/guide-to-json.js`

Converts a study guide markdown file into structured JSON for the web app.

Output schema:
```json
{
  "title": "Topic Title",
  "slug": "topic-slug",
  "role": "security professional",
  "goal": "understand K8s breakout methods",
  "createdAt": "2026-08-19",
  "sections": [
    {
      "id": "what-youll-learn",
      "title": "What You'll Learn",
      "type": "intro",
      "content": "markdown string"
    },
    {
      "id": "key-concepts",
      "title": "Key Concepts & Definitions",
      "type": "definitions",
      "definitions": [
        {"term": "...", "definition": "..."}
      ]
    },
    {
      "id": "section-slug",
      "title": "Section Title",
      "type": "breakdown",
      "content": "markdown string with mermaid blocks"
    }
  ],
  "misconceptions": ["..."],
  "quiz": [
    {
      "tier": "recall|comprehension|application|challenge",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "answer": 2,
      "explanation": "..."
    }
  ],
  "sources": ["url1", "url2"],
  "factCheckNotes": ["correction1", "correction2"]
}
```

CLI: `node lib/guide-to-json.js --input <markdown-path> --output <json-path>`

Note: This script handles the structural parsing (headings → sections, tables → definition objects, quiz extraction). The actual content generation (writing the guide, quiz questions) happens in the skill's Phase 2, not here. This is a format converter.

### 3. Web App (`web/`)

Next.js + React application. Reads study guide JSON files and renders them as interactive, paginated study guides.

#### Pages

**Home (`/`)** — Lists all available study guides as cards. Shows title, role, goal, date, section count.

**Guide Viewer (`/guide/[slug]`)** — The paginated study experience:
- Sidebar navigation with numbered sections
- Progress bar
- Content area rendering markdown with:
  - Mermaid diagrams (via `mermaid` library, rendered client-side)
  - Syntax-highlighted code blocks
  - Definition tables
  - Callout boxes
- Interactive quiz at the end (one question at a time, scoring, explanations)
- Previous/Next navigation
- Dark/light theme toggle

#### Design System

Carry forward the design from the K8s artifact:
- Barlow Semi Condensed headings, Source Sans 3 body
- Dark-first with proper light theme
- Rust-orange accent for emphasis, green for defense/positive
- Definition cards grid, callout boxes, styled tables
- Color-coded tags (attack/defense/warn)

#### Static Export

The app must be statically exportable (`next build && next export` or `output: 'export'` in next.config) so it can be:
- Run locally via `npm run dev`
- Deployed to Vercel (zero config)
- Deployed to GitHub Pages (static export)

Study guide JSON files are loaded at build time via `generateStaticParams` + file reads, or client-side from `public/guides/`.

## Repo Structure

```
study-skill/
├── skill/
│   └── SKILL.md                    # Claude Code skill definition
├── lib/
│   ├── prompts.js                  # Prompt generation for Perplexity + ChatGPT
│   ├── api-clients.js              # Optional API automation
│   ├── combine.js                  # Research combination
│   └── guide-to-json.js            # Markdown → JSON converter
├── web/
│   ├── app/
│   │   ├── layout.tsx              # Root layout, theme, fonts
│   │   ├── page.tsx                # Home: guide listing
│   │   └── guide/
│   │       └── [slug]/
│   │           └── page.tsx        # Guide viewer
│   ├── components/
│   │   ├── Sidebar.tsx             # Navigation sidebar
│   │   ├── Section.tsx             # Section renderer (markdown + mermaid)
│   │   ├── Quiz.tsx                # Interactive quiz
│   │   ├── DefinitionGrid.tsx      # Key concepts cards
│   │   ├── CodeBlock.tsx           # Syntax-highlighted code
│   │   └── ThemeToggle.tsx         # Dark/light toggle
│   ├── lib/
│   │   └── load-guides.ts         # Read guide JSON at build time
│   ├── public/
│   │   └── guides/                 # Generated JSON files go here
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── package.json
├── package.json                    # Root: workspace or scripts
├── .env.example                    # PERPLEXITY_API_KEY, OPENAI_API_KEY
└── README.md
```

## Skill Installation

The skill installs to `~/.claude/skills/learn-topic/` by symlinking or copying `skill/SKILL.md`. The SKILL.md references `lib/` scripts via the repo's absolute path (set during install) or via a `STUDY_SKILL_PATH` env var.

## Resolved Decisions

1. **Tailwind CSS** for the Next.js app, with the same design tokens (colors, fonts) from the K8s artifact defined in `tailwind.config.js`.

2. **Mermaid rendering** — Client-side via `mermaid` npm package in a React component. Diagrams authored as mermaid code blocks in the study guide markdown.

3. **Guide JSON in `public/guides/`** — Static files fetched client-side. Simplest path for static export and deployment to Vercel / GitHub Pages.

## Security Model

API keys (`PERPLEXITY_API_KEY`, `OPENAI_API_KEY`) are used **locally only** during research generation. They are:
- Read from environment variables by `lib/api-clients.js`
- Never written to any output file, study guide, or JSON
- Never referenced by the web app

The web app is a pure static site with zero API calls and zero secrets. Safe to deploy publicly.

Safeguards:
- `.env` in `.gitignore`
- `.env.example` with placeholder values only
- All API key access via `process.env` — no hardcoded values
- README documents: "API keys are used locally during research generation only. The deployed web app contains no secrets."

**Deployment flow**: Run skill locally → generates JSON guides → commit + push → GitHub Pages / Vercel serves static content.
