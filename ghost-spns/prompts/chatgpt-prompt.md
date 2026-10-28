I am a penetration tester and I want to understand how ghost SPNs (SPNs whose hostnames no longer resolve in DNS) enable Kerberos reflection to SYSTEM over SMB (CVE-2025-58726), so I can find SPNs with unresolvable hostnames during an internal test, check whether DNS write rights and SMB signing make them exploitable, and write the finding with remediation.

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
How does this topic connect to adjacent concepts? What should I study next? What practical applications should I be aware of as a penetration tester?

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

Write at the technical level appropriate for a penetration tester. Be thorough but not padded — every paragraph should advance my understanding.
