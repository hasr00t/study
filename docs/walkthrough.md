# Walkthrough: `/learn-topic` end to end

A worked example of the whole pipeline, from running the skill to publishing
the result. The running example is a real topic: **ghost SPNs and Kerberos
reflection to SYSTEM over SMB (CVE-2025-58726)**, researched from a penetration
tester's point of view.

> **Presenting this live?** Generate the guide *before* the talk. A full run
> takes a while — the Perplexity and ChatGPT steps are manual unless you have
> API keys — so demo the finished artefacts, not a live run. Jump to
> [Presenter notes](#presenter-notes) for what to have ready on screen.

---

## The six steps

1. **Intake** — asks your role, what you want to learn, and what you'll *produce*.
2. **Research** — a Claude agent researches with web search; the skill writes
   tailored prompts for Perplexity and ChatGPT and calls their APIs, or hands you
   the prompts to paste.
3. **Compare** — reads every source side by side and flags any that are missing
   or cut short.
4. **Fact-check** — parallel agents cross-check the sources, then confirm key
   claims against primary sources where possible.
5. **Build** — merges everything by topic into a study guide following the
   5-step learning framework (Goal, Priming, Research, Comprehension, Implementation).
6. **Review** — converts the guide for a web viewer with a graded quiz.

---

## Phase 1 — Intake and dispatch

Run the skill in whatever folder you want your study notes kept:

```
/learn-topic
```

The skill asks three questions. The third is the one that matters most: it wants
the concrete end result, not a topic. Here's what we answered:

| Question | Answer |
|----------|--------|
| **Your role** | penetration tester |
| **What you want to learn** | how ghost SPNs enable Kerberos reflection to SYSTEM over SMB |
| **What you'll produce** | find SPNs with unresolvable hostnames on an internal test, check whether DNS write rights and SMB signing make them exploitable, and write the finding with remediation |

The skill then creates the working folder and generates one research prompt per
tool:

```
ghost-spns/
├── prompts/
│   ├── claude-prompt.md
│   ├── perplexity-prompt.md
│   └── chatgpt-prompt.md
└── research/            # the responses land here
```

The three prompts are **tailored to each tool's strengths** — this is the part
worth showing an audience. Perplexity is pushed to cite sources and search
practitioner write-ups. ChatGPT is pushed to reason through mechanisms. Claude
is dispatched as an agent that actually runs web searches and reads primary
sources itself.

### The Claude prompt (run as an agent)

The skill forks a Claude agent to research the topic directly. The prompt tells
it to read primary sources, cite every claim, and flag anything it could only
find in secondary coverage.

````markdown
I am a penetration tester and I want to understand how ghost SPNs (SPNs whose hostnames no longer resolve in DNS) enable Kerberos reflection to SYSTEM over SMB (CVE-2025-58726), so I can find SPNs with unresolvable hostnames during an internal test, check whether DNS write rights and SMB signing make them exploitable, and write the finding with remediation.

Research this independently with web search and produce a structured markdown research brief.

## Research rules
- Use WebSearch and WebFetch to find authoritative sources. Read the primary sources themselves, not just news coverage of them: the Semperis research write-up, Microsoft's advisory for CVE-2025-58726, Microsoft's Kerberos/SMB documentation, and any tooling or PoC the researchers published.
- **Cite every factual claim with a URL.** If you cannot find a source for something, say so; never invent one.
- Note the name collision: "Ghost SPN" is also used by Trellix for a stealthy Kerberoasting technique (temporarily adding an SPN to an account). Mention it only to distinguish it from this attack; do not merge the two.
- Flag anything you could only find in secondary coverage (news sites, vendor blogs repeating each other) as **secondary-only**.
- Be precise about versions and patch status: which Windows versions are affected, what the patch changes, and what it does not fix.

## Output structure
1. **Key Definitions:** a table of every term needed (SPN, ghost SPN, Kerberos reflection, NTLM vs Kerberos relay, AP-REQ, SMB signing, ADIDNS, authenticated-users DNS record creation, coercion, etc.).
2. **Comprehensive Breakdown:** layered sections organised by topic, each as What it is → How it works → Why it matters to a pentester → a full worked example. Cover at least: how SPNs map to hostnames and why they go stale; why Kerberos reflection was thought fixed and how ghost SPNs get around that; the full attack chain step by step; preconditions (DNS write rights, SMB signing state, coercion primitive); patch status.
3. **Finding and testing it on an engagement:** how to enumerate SPNs and find ones whose hostnames don't resolve; how to check ADIDNS write permissions; how to check SMB signing; which tools do each step (name them, with commands where documented); what "exploitable" vs "theoretical" looks like.
4. **Remediation and detection:** patch, SMB signing, DNS permission hardening, cleaning stale SPNs, and detection opportunities, each written so a client's AD team could act on it.
5. **Rules & Frameworks:** named, portable heuristics a tester carries into the job.
6. **Common Misconceptions:** 3-5, each with why it's believed and the sourced correction.
7. **Connections & What to Study Next.**
8. **Questions:** Recall, Comprehension and Application with four plausible options and the correct answer marked; Challenge open-ended.
9. **Sources:** every URL cited.

Write at a penetration tester's technical level. No filler.
````

### The Perplexity prompt (paste into Perplexity)

Save the response as `ghost-spns/research/perplexity-research.md`.

````markdown
You are a research assistant. I am a penetration tester, and I want to understand how ghost SPNs (SPNs whose hostnames no longer resolve in DNS) enable Kerberos reflection to SYSTEM over SMB (CVE-2025-58726), so I can find SPNs with unresolvable hostnames during an internal test, check whether DNS write rights and SMB signing make them exploitable, and write the finding with remediation.

Produce a comprehensive research brief in markdown format. Follow these rules strictly:

## Research Requirements
- **Cite every factual claim** with a URL in parentheses or as a markdown link
- Prefer primary sources: official documentation, vendor advisories, peer-reviewed research, authoritative references
- Prefer recent sources (last 2 years) unless older sources are canonical
- If a claim is widely known but hard to cite, say "(widely documented)" rather than fabricating a source

## Output Structure

### Key Definitions
A markdown table of every essential term and concept. Define each clearly and concisely.

| Term | Definition |
|------|-----------|
| ...  | ...       |

### Comprehensive Overview
Cover the topic in layered sections. For each major area:
- **What it is** — plain-language explanation
- **How it works** — mechanics, steps, or process
- **Why it matters** — practical relevance to my work as a penetration tester
- **A full example** — a complete worked scenario, not a fragment

### Important Details
Go deeper on the areas most relevant to my goal. Include specific versions, commands, configurations, or examples where they add clarity.

### Learning Path
How have people who already know this actually learned it? Search discussion sites,
practitioner write-ups and course reviews, not just documentation. Cover:
- Which specific resources (courses, books, labs, talks) practitioners recommend, and which
  are widely considered a waste of time
- The order people say to learn it in, and the prerequisite that trips them up
- Hands-on options — labs, exercises, deliberately vulnerable environments
- What people say they wish they had learned first

### Rules & Frameworks
Name the portable heuristics: rules of thumb, ratios, decision procedures, ordered checklists
and mental models. Give each one its name, so it can be referred to later.

### Common Misconceptions
3-5 things people get wrong about this, each as: the misconception, why it is widely believed,
and the correction with a source. Prioritise the ones that would actually change a decision.

### Applying It
What should I build, run or produce to turn this from something I have read into something I
can do? Give concrete options ordered easiest-first, and say what each one would prove I
understood. Name real tools and environments where they exist.

### Connections & What to Study Next
How this relates to adjacent areas, what it is commonly confused with, and the highest-leverage
things to learn after it — in order.

### Questions That Test Real Understanding
Four levels, marked Recall, Comprehension, Application, Challenge. For the first three give
**four multiple-choice options** and mark the correct one, with a one-line explanation. Make
the wrong options plausible — draw them from the misconceptions above. Leave Challenge open.

### Sources
List all cited URLs at the end.

Write at the technical level of a penetration tester. Do not pad with filler.
````

### The ChatGPT prompt (paste into ChatGPT, reasoning mode)

Save the response as `ghost-spns/research/chatgpt-research.md`.

````markdown
I am a penetration tester and I want to understand how ghost SPNs (SPNs whose hostnames no longer resolve in DNS) enable Kerberos reflection to SYSTEM over SMB (CVE-2025-58726), so I can find SPNs with unresolvable hostnames during an internal test, check whether DNS write rights and SMB signing make them exploitable, and write the finding with remediation.

Please provide a deep, comprehensive analysis using your reasoning capabilities. Take your time to think through this thoroughly.

## What I Need

### 1. Key Concepts & Definitions
A table of every term I need to understand before diving in.

### 2. Deep Explanatory Breakdown
For each major area: What it is → How it actually works → Why it works that way → a concrete
example. Explain the reasoning, not just the facts. Where something is commonly misunderstood,
say so and explain why.

### 3. Common Misconceptions
3-5 things people get wrong: the misconception, why people believe it, the correct understanding.

### 4. Rules & Frameworks
The named, portable heuristics — rules, decision procedures, checklists, mental models — I'd
carry into a real task without re-reading anything. Name each one.

### 5. Applying It
What should I build, run or produce to turn this into something I can do? Concrete options,
easiest-first, and what each would prove I understood.

### 6. Connections
How this connects to adjacent concepts, what to study next, and practical applications.

### 7. Questions That Test Real Understanding
Four levels, marked Recall, Comprehension, Application, Challenge. For the first three give four
options each and mark the correct one with a one-line explanation; draw wrong options from the
misconceptions. Leave Challenge open; prefer reasoning over recall there.

### 8. What I Should Be Able to Answer Before I Start
4-6 priming questions worth attempting *before* studying. They should be mostly unanswerable
cold — that is the point.

### 9. Sources & Confidence
Cite sources where you're confident. Where your knowledge may be outdated or uncertain, flag it
explicitly so I can verify.

Write at the technical level of a penetration tester. Every paragraph should advance understanding.
````

> The prompts in your repo at `ghost-spns/prompts/` are the full, unabridged
> versions. The Perplexity and ChatGPT prompts above are trimmed slightly for
> slide-readability; the shape is identical.

---

## Phase 2 — Compare, fact-check, combine

Once the three responses are in `ghost-spns/research/`, tell the skill
**"continue"**. It then:

1. **Reads every research file** — `.md`, `.txt`, and extensionless files — and
   lists each one with its size, so a missing or truncated source is visible
   rather than silently dropped.
2. **Dispatches parallel fact-check agents.** Each one covers a domain area and
   works in two passes: cross-check the sources against each other (disagreement
   shows where to look hardest), then confirm key claims against a **primary
   source** where one exists. Each claim ends up labelled *confirmed*,
   *corroborated only*, or *contradicted*.
3. **Merges everything by topic** — not by source — into one guide. Definitions
   are combined into a single table; misconceptions are deduplicated.

Corrections and any claims that rest only on the sources agreeing are written to
a separate `ghost-spns/fact-check-notes.md`, so they don't sit between the
content and the quiz.

> **Why "primary sources" matters for this topic.** Ghost SPNs are new and
> thinly documented, and "Ghost SPN" is also the name of an unrelated Trellix
> Kerberoasting technique. Three models can repeat the same confusion, so three
> models agreeing is not confirmation — only checking the Semperis write-up and
> Microsoft's advisory is. This is exactly the case the fact-check step is built
> for, which makes it a good demo of *why* that step exists.

The finished guide is saved as `ghost-spns/ghost-spns-study-guide.md`.

---

## Phase 3 — Build the web guide

Convert the guide to JSON for the viewer:

```bash
node lib/guide-to-json.js \
  --input ghost-spns/ghost-spns-study-guide.md \
  --output web/public/guides/ghost-spns.json \
  --slug ghost-spns \
  --role "penetration tester" \
  --goal "find and report exploitable ghost SPNs on an internal test"
```

Then read it in the app:

```bash
npm run dev     # from the repo root
```

Open <http://localhost:3000>. The left rail lists every guide and expands into
the current guide's sections. The quiz grades the multiple-choice tiers and
flags what you got wrong for review; progress is saved per-reader in the browser.

---

## Publishing to GitHub

The web app is a static export — no server, no secrets:

```bash
cd web
npm run build   # writes the static site to web/out/
```

Serve `web/out/` from any static host (GitHub Pages, Vercel, Netlify). Only the
guides committed to `web/public/guides/` are published, so check what's in there
before you point it at a public URL.

---

## Presenter notes

- **Pre-generate the guide.** Don't run the pipeline live; it's slow and the
  manual paste steps stall a talk. Have the finished guide open in the web app
  and the three prompt files open in an editor.
- **The prompts are the "aha".** The clearest single thing to show is the three
  prompts side by side: same topic, three different shapes, each matched to the
  tool. That's the skill's core idea in one screen.
- **Tell the fact-check story honestly.** The strongest line for a security
  audience is that "three AIs agreed" is a weak claim, and the skill upgrades it
  by confirming against primary sources where they exist — and flags what it
  couldn't confirm. If a run turns up a contradiction or a source it couldn't
  reach, that's not a failure to hide; it's the feature working.
- **Have a backup topic.** Newer, thinly-documented topics can come back with
  conflicting or incomplete research. If you want a smooth three-source demo,
  SCCM (via SpecterOps' Misconfiguration Manager) or ADCS have strong primary
  sources and are hard to get wrong.
