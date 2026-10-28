---
name: learn-topic
description: Use when studying a new topic — orchestrates multi-source research across Claude, Perplexity, and ChatGPT, then combines into a fact-checked study guide with an interactive web viewer
---

# Learn Topic

Orchestrate a multi-source research pipeline to produce a comprehensive, fact-checked study guide.

## Setup

**Do this first, before any other step.** Resolve the repo path once, then
substitute the literal path into every later command — each Bash call is a
fresh shell, so an `export` here does not carry over to the next command.

```bash
if [ -z "$STUDY_SKILL_PATH" ]; then
  LINK=$(readlink ~/.claude/skills/learn-topic 2>/dev/null)
  [ -n "$LINK" ] && STUDY_SKILL_PATH=$(dirname "$LINK")
fi
echo "${STUDY_SKILL_PATH:?Set STUDY_SKILL_PATH to the study-skill repo, or reinstall the skill as a symlink}"
```

This honours `STUDY_SKILL_PATH` when it is set, and otherwise derives the
repo location from the skill's own install symlink. If it prints an error,
the skill was installed by copying rather than symlinking — set
`STUDY_SKILL_PATH` explicitly and re-run.

Below, `$STUDY_SKILL_PATH` stands for the path this step printed.

### API keys (optional)

Copy `.env.example` to `.env` in the repo root and fill in
`PERPLEXITY_API_KEY` / `OPENAI_API_KEY`. `lib/api-clients.js` loads that
file automatically; real environment variables take precedence over it.
Without keys the skill falls back to printing copy-paste prompts, which is
a fully supported path — not an error.

## Phase 1: Gather & Dispatch

Use AskUserQuestion to collect:

1. **Your role/background** — e.g., "security engineer", "CS student", "DevOps lead"
2. **What you want to learn** — specific goal, not a vague topic. e.g., "understand how DNS resolution works end-to-end so I can troubleshoot lookup failures"
3. **What you'll produce or be able to do** — the concrete end result the studying serves: a murderboard you can pass, an assessment you can run, a tool you can evaluate, a report you can write. Push for this. "Learn Kubernetes" is not a goal; "identify dangerous pod specs on sight during an assessment" is. It decides what the guide emphasises and what the Implementation section asks for.

If the user gives only a topic, ask once for the end result before dispatching research. A guide written toward a deliverable is a different guide from one written toward general understanding.

Then:

1. Create the study folder in the current working directory:
   ```
   {topic-slug}/research/
   {topic-slug}/prompts/
   ```

2. Dispatch a Claude agent (fork) to conduct independent research on the topic. The agent should:
   - Use WebSearch to find authoritative sources
   - Produce structured markdown following the study guide format (definitions, breakdown, examples)
   - Cite every factual claim with a URL
   - Save output to `{topic-slug}/research/claude-research.md`

3. Generate the Perplexity and ChatGPT prompts, writing each to its own file.
   Generate them one at a time so no splitting is needed, and strip the
   `=== ... PROMPT ===` banner line so the file holds only the prompt:

   ```bash
   node $STUDY_SKILL_PATH/lib/prompts.js --role "<role>" --goal "<goal>" --format perplexity \
     | sed '1,2d' > {topic-slug}/prompts/perplexity-prompt.md
   node $STUDY_SKILL_PATH/lib/prompts.js --role "<role>" --goal "<goal>" --format chatgpt \
     | sed '1,2d' > {topic-slug}/prompts/chatgpt-prompt.md
   ```

4. Check for API keys and attempt automation:
   ```bash
   # Save the Perplexity prompt to a temp file, then call:
   node $STUDY_SKILL_PATH/lib/api-clients.js --prompt-file /tmp/perplexity-prompt.txt --provider perplexity --output {topic-slug}/research/perplexity-research.md

   # Same for ChatGPT:
   node $STUDY_SKILL_PATH/lib/api-clients.js --prompt-file /tmp/chatgpt-prompt.txt --provider openai --output {topic-slug}/research/chatgpt-research.md
   ```

   If API calls fail (no keys or errors), fall back to copy-paste. **Make the
   prompts easy to copy** — do not leave them buried in command output:

   - Output each prompt in the chat inside its own fenced code block, so the
     user can copy it in one action. Read the file and paste its contents into
     the fence; never make the user scroll a terminal transcript to find it.
   - Name the file path alongside each block, since the same text is on disk at
     `{topic-slug}/prompts/` if they would rather open it.
   - Send the two prompts in separate messages, or clearly separated, so the
     copy targets do not run together.

   Then instruct:
   > **Perplexity prompt** — Copy and paste into Perplexity. Save the response as `{topic-slug}/research/perplexity-research.md`
   >
   > **ChatGPT prompt** — Copy and paste into ChatGPT (use thinking/reasoning mode if available). Save the response as `{topic-slug}/research/chatgpt-research.md`

   Also offer the easier path: the user can paste each response straight into
   the chat and you write the file for them.

5. Print a status summary showing what research is pending/complete.

## Phase 2: Wait & Combine

Tell the user:
> Research is being gathered. When all research files are in the `{topic-slug}/research/` folder, say **"continue"** and I'll combine everything into your study guide.

When the user says "continue":

1. Read every research file in `{topic-slug}/research/` — match `*.md`, `*.txt`,
   and extensionless files, not just `*.md`. A response pasted out of a web UI
   often lands as `.txt`, and silently skipping it produces a guide that looks
   fine while missing a whole source. List what you found and its size before
   combining, so a missing or truncated source is visible rather than assumed.
2. Dispatch parallel fact-check agents (forks) to verify key claims. Each agent checks a specific domain area, in two passes:
   - **Cross-check the sources** against each other. Disagreement is the signal for where to look hardest.
   - **Confirm against a primary source where one exists** — the spec or standard (RFC, NIST, CIS), official vendor documentation, the original advisory or research, or the code itself. Three models agreeing is not confirmation: they learned from overlapping material and can share the same misconception. Record the primary-source URL for each confirmed claim.

   Classify each key claim as **confirmed** (primary source found), **corroborated only** (sources agree, no primary source found), or **contradicted**. Correct contradicted claims in the guide; list corroborated-only claims in the fact-check notes so the reader knows which ones rest on agreement alone.
3. Combine all research into a unified study guide following this structure:

   - **What You'll Learn** — orientation paragraph, naming the end result from Phase 1
   - **Priming Pass** — the pre-study skim. Two parts: a short map of how the guide is
     structured and why it is ordered that way, then 4-6 **priming questions** the reader
     attempts *before* reading anything else. They are meant to be mostly unanswerable at
     that point — their job is to prime, not to test. Say so explicitly, so nobody reads a
     blank as failure.
   - **Key Concepts & Definitions** — merged definition table from all sources
   - **Rules & Frameworks** — the named, portable heuristics: rules, ratios, decision
     procedures, ordered checklists, mental models. The things a reader carries away and
     applies without re-reading the guide. Name each one so it can be referred to later.
   - **Comprehensive Breakdown** — layered sections organized by topic (not by source),
     using: What it is → How it works → Why it matters → Example
   - **Common Misconceptions** — deduplicated from all sources
   - **Connections & Context** — how the topic relates to adjacent areas
   - **Implementation** — how to actually apply this toward the end result the reader named.
     Concrete and doable: a lab to build, a procedure to run, an artefact to produce, a
     checklist to take into the real task. Ordered easiest-first so there is an obvious
     starting point. This is not optional garnish — applying the material is where most of
     the learning lands, so give it real weight.
   - **Reinforcement Questions** — four tiers. Recall, Comprehension and Application are
     **multiple choice** so they can be graded; Challenge stays open-response, because
     forcing an argument into four options destroys what it tests.

     Write the graded tiers in this exact shape — options indented under the question, then
     an answer line naming the correct letter, the explanation, and an arrow to the section
     to reread when it is missed:

     ```
     1. Which Linux feature partitions what a process can see?
        - a) cgroups
        - b) namespaces
        - c) capabilities
        - d) seccomp
        > **b** — Namespaces partition visibility; cgroups cap consumption. → Linux Primitives
     ```

     The section name after the arrow must match a `###` breakdown heading exactly — it is
     what the quiz offers as review material for a wrong answer, so a name that does not
     match silently loses the link.

     Distractors have to be plausible. Three obviously wrong options make a question that
     tests reading comprehension rather than knowledge; the best distractors are the
     misconceptions from the section above. Challenge questions are written as plain
     numbered lines with no options.

   Write any corrections found during verification to a **separate** file,
   `{topic-slug}/fact-check-notes.md` — not into the guide, where it would sit between the
   content and the questions.

4. Save as `{topic-slug}/{topic-slug}-study-guide.md`

5. **De-slop pass.** A guide assembled from three AI sources carries AI-writing
   tells, mostly em dashes, significance tails, and overused words. Apply the rules
   in `$STUDY_SKILL_PATH/skill/deslop.md` to the saved guide, editing it in place,
   then report what changed by category. This is an edit, not a rewrite: keep the
   facts, and **do not touch the quiz answer lines' `→ Section Title` links or the
   `###` headings they point to**, or the web converter loses the review links.

## Phase 3: Generate Web Guide

Convert the study guide to JSON for the web viewer:

```bash
node $STUDY_SKILL_PATH/lib/guide-to-json.js \
  --input "{topic-slug}/{topic-slug}-study-guide.md" \
  --output "$STUDY_SKILL_PATH/web/public/guides/{topic-slug}.json" \
  --slug "{topic-slug}" \
  --role "<role>" \
  --goal "<goal>"
```

Then offer next steps:
- "Run `cd $STUDY_SKILL_PATH/web && npm run dev` to view in the web app"
- "Want me to quiz you interactively right now?"
- "Want me to go deeper on any section?"
- "Want me to publish this as an Artifact?"

## Writing Guidelines

- **Definitions before depth.** Every term used in the breakdown must appear in Key Concepts first.
- **Capture the three things worth noting.** Comprehension notes are only ever definitions,
  named rules and frameworks, and full worked examples. The guide should hand the reader all
  three directly, so they are not left to extract them.
- **Concrete over abstract.** Every concept gets at least one real example — a full one, with
  the scenario attached, not a fragment.
- **Layer the complexity.** The guide should read correctly on a broad first pass and reward a
  second, deeper one. Each section opens with the version that survives simplification, then
  adds the nuance that a reader coming back will want.
- **Write toward the end result.** Every section should be defensible against "how does this
  help them produce the thing they said they wanted?" Cut what only survives "it's interesting".
- **Line up ASCII diagrams.** In a box diagram, every row of a box — borders, dividers and
  content — must be the same character width, or the right edge comes out ragged when it
  renders in a proportional-width page. Size the box to its longest line, then pad the rest.
  Flow and tree diagrams have no such constraint.
- **No filler.** If a sentence doesn't teach something, cut it.
- **Questions should be hard enough to be useful.** If someone can answer every question without
  reading the guide, the questions are too easy.

## Suggesting how to study it

When handing over the finished guide, mention two things that change outcomes more than the
guide's contents do:

- **Interleave.** Studying several guides in the same session beats one topic per day — it
  improves retention and holds motivation. The web app's library makes switching cheap; say so
  if they have more than one guide.
- **Study on energy, not on spare time.** An hour when they are sharp beats two when they are
  not. Worth saying once, not repeating.
