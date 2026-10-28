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
Go deeper on the areas most relevant to my goal: "understand how ghost SPNs (SPNs whose hostnames no longer resolve in DNS) enable Kerberos reflection to SYSTEM over SMB (CVE-2025-58726), so I can find SPNs with unresolvable hostnames during an internal test, check whether DNS write rights and SMB signing make them exploitable, and write the finding with remediation". Include specific versions, commands, configurations, or examples where they add clarity.

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

Write at the technical level of a penetration tester. Use precision appropriate to that audience. Do not pad with filler — every sentence should teach something.


