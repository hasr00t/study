# De-slop rules

Reference for the de-slop pass in `SKILL.md` Phase 2. Apply these rules to the
finished study guide so it reads as if a careful human wrote it. Keep the
meaning, the facts, and the voice. Add nothing.

> Vendored from the standalone `deslop` skill (MIT, © Ashley K.) so this pipeline
> is self-contained. The original is a general-purpose prose cleaner; this copy is
> trimmed to what the guide needs and adds the guide-specific preservation rules.

## How to run it

1. **Structure and tone pass.** Read the whole guide. Fix every item under
   "Punctuation and structure" and "Tone and substance". Work sentence by
   sentence. When a sentence wants an em dash, split it or repunctuate; when a
   clause editorializes about what a fact means, end the sentence at the fact.
2. **Watchlist pass.** Go word by word against the watchlist. Replace each genuine
   hit with the plain alternative or cut it. Keep a word that is genuinely right in
   context; the list targets overuse, not the word.
3. **Edit in place**, preserving structure, formatting, and length intent. This is
   an edit, not a rewrite from scratch.
4. **Report what changed**, grouped by category (for example: "removed 56 em
   dashes, cut 2 significance tails, replaced 1 'leverage'"). If it was already
   clean, say so rather than inventing changes.

## Punctuation and structure

- **No em dashes.** Use a period, comma, semicolon, or colon, or split the
  sentence in two.
- **No parenthetical example lists** padded for rhythm ("various methods such as A,
  B, or C"). Work informative examples into the sentence or cut them. Technical
  enumerations that carry real information (tool names, CVE IDs) may stay.
- **No rule-of-three lists** where two items, or one, would do.
- **No sentence-final "as well."** Use "also", or omit it.
- **No stacked hedging.** "potentially could possibly allow" becomes "allows".

## Tone and substance

- **No overdramatization.** No "catastrophic", "devastating", "game-changing".
  The facts carry the weight.
- **No filler.** Cut "it is worth noting that", "as mentioned above", "needless to
  say". Don't restate the topic inside its own explanation.
- **No inflated importance.** Cut "plays a crucial role", "underscores its
  importance", "represents a shift", "serves as a testament to", "sets the stage
  for".
- **No trailing significance clauses.** Don't bolt a participial clause onto a
  sentence to editorialize ("highlighting...", "underscoring...", "ensuring...",
  "reflecting a broader..."). End at the fact.
- **No promotional tone.** No "boasts", "vibrant", "robust", "seamless",
  "cutting-edge", "nestled", "in the heart of". Where something is genuinely good,
  say what is specifically true.
- **No vague authority.** No "experts agree", "studies show", "best practice
  dictates" with no source named. Name the source or state the point directly. No
  "Future Outlook" or "In conclusion" flourish.

## Overused-word watchlist

Rewrite each genuine hit: additionally (sentence-start) → "also" or lead with the
fact; align/resonate with → matches, follows; boasts → has; bolster → strengthen;
crucial/pivotal/vital → important or cut; delve → examine, dig into; emphasize/
highlight/underscore (as significance verbs) → state it plainly; enhance →
improve; ever-evolving → changing or cut; foster/cultivate → support, build;
furthermore/moreover → also, and; garner → gain, earn; intricate → complex;
journey (figurative) → cut or name the process; key (adjective) → main or cut;
landscape (abstract) → field, area; leverage (verb) → use; meticulous → careful;
navigate (figurative) → handle, work through; realm → area, field; robust → strong
or name the quality; seamless → smooth or cut; showcase → show; tapestry → cut;
testament → shows or cut; unlock (figurative) → cut or name what it enables;
valuable → cut or name the value; vibrant → cut.

## Preservation rules

- **Never change meaning or delete a fact.** If removing slop drops information,
  rephrase to keep it.
- **Leave code, quotations, citations, and diagrams untouched** even when they
  contain a watchlist word or a dash.
- **Guide-specific: do not touch the quiz contract.** Keep answer lines in the
  form `> **b** explanation → Section Title`. The `→ Section Title` link and the
  exact `### ` breakdown headings it points to must stay byte-for-byte, or
  `guide-to-json.js` loses the review link. Em dashes in an answer line's
  explanation prose can go; the `→` arrow and heading text cannot.
- **A watchlist entry targets overuse, not the word.** Keep "encryption key",
  "robust statistics", a quoted source's "delve".
- **Preserve voice, register, and Markdown formatting.**
- **Add nothing.** No new sentences or examples. The only new output is the change
  summary in your reply.
