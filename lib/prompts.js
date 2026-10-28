import { fileURLToPath } from 'url';

export function generatePerplexityPrompt(role, goal) {
  return `You are a research assistant. I am a ${role}, and I want to ${goal}.

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
- **Why it matters** — practical relevance to my work as a ${role}
- **A full example** — a complete worked scenario, not a fragment

### Important Details
Go deeper on the areas most relevant to my goal: "${goal}". Include specific versions, commands, configurations, or examples where they add clarity.

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
and mental models that a practitioner carries around and applies without looking anything up.
Give each one its name, so it can be referred to later.

### Common Misconceptions
3-5 things people get wrong about this, each as: the misconception, why it is widely believed,
and the correction with a source. Prioritise the ones that would actually change a decision —
especially anything vendors or popular write-ups state incorrectly.

### Applying It
What should I build, run or produce to turn this from something I have read into something I
can do? Give concrete options ordered easiest-first — labs, exercises, procedures, artefacts —
and say what each one would prove I understood. Name real tools and environments where they
exist.

### Connections & What to Study Next
How this relates to adjacent areas, what it is commonly confused with, and the highest-leverage
things to learn after it — in order.

### Questions That Test Real Understanding
Questions that separate someone who understands this from someone who has only read about it.
Cover four levels, and mark which is which:
- **Recall** — definitions and key facts
- **Comprehension** — explain the mechanism in your own words
- **Application** — a realistic scenario requiring a judgement
- **Challenge** — combining several concepts, or a case where the usual answer is wrong

For Recall, Comprehension and Application give **four multiple-choice options** and mark the
correct one, with a one-line explanation of why it is right. Make the wrong options
plausible — draw them from the misconceptions above, not from obviously false statements.
Leave Challenge questions open-ended with no options.

### Sources
List all cited URLs at the end.

Write at the technical level of a ${role}. Use precision appropriate to that audience. Do not pad with filler — every sentence should teach something.`;
}

export function generateChatGPTPrompt(role, goal) {
  return `I am a ${role} and I want to ${goal}.

Please provide a deep, comprehensive analysis using your reasoning capabilities. Take your time to think through this thoroughly.

## What I Need

### 1. Key Concepts & Definitions
Start with a table of every term I need to understand before diving in:

| Term | Definition |
|------|-----------|
| ...  | ...       |

### 2. Deep Explanatory Breakdown
For each major area of this topic, explain:
- **What it is** — plain-language, then precise
- **How it actually works** — the underlying mechanism, not just the surface description
- **Why it works that way** — the design decisions, constraints, or physics behind it
- **A concrete example** — a real scenario showing the concept in action

Don't just state facts — explain the reasoning. If something is commonly misunderstood, say so and explain why the misconception exists.

### 3. Common Misconceptions
List 3-5 things people frequently get wrong about this topic. For each one, explain:
- The misconception
- Why people believe it
- The correct understanding

### 4. Rules & Frameworks
What are the named, portable heuristics here — rules, ratios, decision procedures, ordered
checklists, mental models? The things I would carry into a real task without re-reading
anything. Name each one.

### 5. Applying It
What should I actually build, run or produce to turn this from something I have read into
something I can do? Give concrete options ordered easiest-first, and say what each one would
prove I understood.

### 6. Connections
How does this topic connect to adjacent concepts? What should I study next? What practical applications should I be aware of as a ${role}?

### 7. Questions That Test Real Understanding
Questions that separate someone who understands this from someone who has only read about it.
Four levels, marked:
- **Recall** — definitions and key facts
- **Comprehension** — explain the mechanism in your own words
- **Application** — a realistic scenario requiring a judgement
- **Challenge** — combining several concepts, or a case where the usual answer is wrong

For the first three levels, give **four options** each and mark the correct one with a
one-line explanation. The wrong options should be things someone could genuinely believe —
use the misconceptions from section 3. Leave Challenge open-ended. For the Challenge tier, prefer questions where reasoning matters more than
recall — that is where your reasoning is most useful to me.

### 8. What I Should Be Able to Answer Before I Start
4-6 questions worth attempting *before* studying, to prime the material. They should be mostly
unanswerable cold — that is the point. Pick the ones whose answers organise everything else.

### 9. Sources & Confidence
For claims you're confident about, cite sources if you know them. For areas where your knowledge may be outdated or uncertain, flag that explicitly so I can verify.

Write at the technical level appropriate for a ${role}. Be thorough but not padded — every paragraph should advance my understanding.`;
}

// CLI interface
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i += 2) {
    flags[args[i].replace('--', '')] = args[i + 1];
  }

  const { role, goal, format } = flags;
  if (!role || !goal) {
    console.error('Usage: node lib/prompts.js --role <role> --goal <goal> --format perplexity|chatgpt|both');
    process.exit(1);
  }

  if (format && !['perplexity', 'chatgpt', 'both'].includes(format)) {
    console.error(`Invalid format: "${format}". Use: perplexity, chatgpt, or both`);
    process.exit(1);
  }

  if (format === 'perplexity' || format === 'both') {
    console.log('=== PERPLEXITY PROMPT ===\n');
    console.log(generatePerplexityPrompt(role, goal));
    console.log('\n');
  }
  if (format === 'chatgpt' || format === 'both') {
    console.log('=== CHATGPT PROMPT ===\n');
    console.log(generateChatGPTPrompt(role, goal));
  }
  if (!format) {
    console.log('=== PERPLEXITY PROMPT ===\n');
    console.log(generatePerplexityPrompt(role, goal));
    console.log('\n=== CHATGPT PROMPT ===\n');
    console.log(generateChatGPTPrompt(role, goal));
  }
}
