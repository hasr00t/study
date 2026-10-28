# Study Skill

`/learn-topic` is a Claude Code skill that turns "I need to learn X" into a
fact-checked study guide. It researches the topic with Claude, Perplexity and
ChatGPT, checks key claims against primary sources, and builds a guide you can
read and quiz yourself on in a local web app.

## What it does

1. **Intake.** Asks for your role, what you want to learn, and what you'll *produce*:
   the assessment, report or exam the studying is for.
2. **Research.** A Claude agent researches with web search. The skill writes
   tailored prompts for Perplexity and ChatGPT and calls their APIs, or hands
   you the prompts to paste if you have no API keys.
3. **Compare.** Reads every source side by side and flags any that are missing
   or cut short.
4. **Fact-check.** Parallel agents cross-check the sources, then confirm key
   claims against primary sources where possible.
5. **Build.** Merges everything by topic into a study guide following a 5-step
   learning framework (Goal, Priming, Research, Comprehension, Implementation),
   then runs a de-slop pass to strip AI-writing tells.
6. **Review.** Converts the guide for a web viewer with a graded
   multiple-choice quiz and open-response challenge questions.

## Worked example

`ghost-spns/` is a complete run of the pipeline on a real topic (a patched
Windows CVE, from a penetration tester's point of view): the three research
prompts, the raw responses from each tool, the merged study guide, and the
`fact-check-notes.md` showing what was confirmed, corrected, or left
single-sourced. Its guide ships in the viewer at `web/public/guides/`.
[`docs/walkthrough.md`](docs/walkthrough.md) narrates the same run step by step.

## Requirements

- [Claude Code](https://claude.com/claude-code)
- Node.js 20.12 or newer (22 LTS recommended)
- Optional: a [Perplexity API](https://docs.perplexity.ai) key and an
  [OpenAI API](https://platform.openai.com) key

## Installation

### 1. Clone and install dependencies

```bash
git clone https://github.com/hasr00t/study-skill.git ~/study-skill
cd ~/study-skill
npm install
```

The root `package.json` is an npm workspace, so this one `npm install` sets up
both `lib/` and the `web/` app.

### 2. Install the skill into Claude Code

Symlink the `skill/` directory into your Claude Code skills folder:

```bash
mkdir -p ~/.claude/skills
ln -s ~/study-skill/skill ~/.claude/skills/learn-topic
```

The skill finds the repo by following this symlink, so nothing else needs
setting up. If you copy `skill/` instead of linking it, set `STUDY_SKILL_PATH`
to the repo root (e.g. in `~/.zshrc`) so the skill can find `lib/`.

Restart Claude Code. `/learn-topic` should now appear in its list of skills.

### 3. (Optional) Add API keys

```bash
cp .env.example .env
```

Fill in `PERPLEXITY_API_KEY` and `OPENAI_API_KEY`. The scripts load `.env`
automatically, and exported environment variables take precedence over it.

Without keys, the skill shows each prompt in a copyable block for you to paste
into the Perplexity and ChatGPT web apps. You then paste the responses back
into Claude Code. This is a fully supported path that just takes more manual steps.

## Usage

### Generate a study guide

Open Claude Code in whichever folder you want your study notes kept, then run:

```
/learn-topic
```

1. **Answer the intake questions.** Be specific about the end result. A goal
   like "identify dangerous pod specs on sight during an assessment" gives a
   much more useful guide than "learn Kubernetes".
2. **Wait for research.** With API keys, all three sources are gathered for
   you. Without keys, paste each prompt into Perplexity and ChatGPT, then paste
   the responses back into Claude Code or save them to the `research/` folder.
3. **Say "continue"** once all research is in. The skill fact-checks, merges
   the sources and writes the guide.

You end up with a folder like this in your working directory:

```
<topic-slug>/
├── prompts/                     # the Perplexity and ChatGPT prompts
├── research/                    # raw output from each source
├── <topic-slug>-study-guide.md  # the study guide
└── fact-check-notes.md          # corrections, and claims with no primary source
```

The skill also writes the guide as JSON to `web/public/guides/<topic-slug>.json`
for the web viewer.

### Read the guide in the web app

```bash
cd ~/study-skill
npm run dev
```

Open http://localhost:3000. The left rail lists every guide and expands into
the current guide's sections. Reading progress and quiz results are saved in
your browser, so there's no account or backend.

Studying more than one guide per session (interleaving) helps retention, and
the library makes switching between guides quick.

### Convert a guide by hand

If you edit a study guide's markdown, regenerate its JSON:

```bash
node lib/guide-to-json.js \
  --input path/to/<topic-slug>-study-guide.md \
  --output web/public/guides/<topic-slug>.json \
  --slug <topic-slug> --role "<your role>" --goal "<your goal>"
```

## Deploying the web app

The web app is a static export with no server, API calls or secrets:

```bash
cd web
npm run build   # writes the site to web/out/
```

Serve `web/out/` from any static host. Only guides committed to
`web/public/guides/` are published, so check what's there before you deploy
a public site.

## Development

```bash
npm run test:lib   # lib tests (Vitest)
cd web && npm run lint
```

```
skill/SKILL.md          # the /learn-topic skill: the three-phase orchestrator
lib/prompts.js          # builds the Perplexity and ChatGPT research prompts
lib/api-clients.js      # Perplexity (sonar-pro) and OpenAI (gpt-4o) calls, with retry
lib/guide-to-json.js    # study guide markdown → JSON for the web app
web/                    # Next.js 16 + Tailwind v4 viewer
docs/specs/             # design spec
```

## Security

API keys are read from environment variables or `.env` by the local scripts
only. They are never written to prompts, research files, study guides or JSON,
and the web app never uses them. `.env` is git-ignored.
