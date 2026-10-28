const kicker =
  'font-display text-[9.5px] tracking-[0.18em] uppercase text-[var(--accent)] mb-3';

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4 pb-9">
      <span className="font-display font-bold text-[19px] text-[var(--accent)] tabular-nums leading-[1.35]">
        {n}
      </span>
      <div className="min-w-0">
        <h2 className="font-display font-semibold text-[20px] tracking-[-0.015em] text-[var(--text-bright)] mb-3 leading-snug">
          {title}
        </h2>
        <div className="flex flex-col gap-3.5 text-[16.5px] leading-relaxed">{children}</div>
      </div>
    </section>
  );
}

function Cmd({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-[var(--code-bg)] text-[var(--code-text)] border border-[var(--border)] rounded-[3px] px-4 py-3 overflow-x-auto text-[13px] font-mono leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-[var(--accent)] pl-4 text-[14.5px] leading-relaxed text-[var(--text-dim)]">
      {children}
    </p>
  );
}

export function HowItWorks() {
  return (
    <main className="flex-1 px-6 sm:px-8 lg:px-14 py-11">
      <div className="w-full max-w-[54rem] mx-auto">
        <div className={kicker}>The workflow</div>
        <h1 className="font-display font-bold text-[31px] leading-[1.14] tracking-[-0.022em] text-[var(--text-bright)] mb-5 text-pretty">
          How to make a study guide
        </h1>
        <p className="text-[16.5px] leading-relaxed mb-4">
          Three sources research the topic independently, their claims get checked against
          each other and against primary documentation, and what survives becomes a guide you
          can read here. The whole thing runs from one command in Claude Code — the steps
          below are what happens, and where you come in.
        </p>
        <p className="text-[16.5px] leading-relaxed mb-10">
          You come in twice: naming the goal at the start, and pasting two research responses
          in the middle if you have no API keys. Everything else runs itself.
        </p>

        <Step n="01" title="Start a topic">
          <p>
            In Claude Code, from wherever you keep study material, run:
          </p>
          <Cmd>/learn-topic</Cmd>
          <p>
            It asks three things: your role, what you want to learn, and — the one worth
            thinking about — what you&rsquo;ll produce or be able to do afterwards. Answer that
            last one concretely. &ldquo;Learn Kubernetes&rdquo; produces a worse guide than
            &ldquo;identify dangerous pod specs on sight during an assessment,&rdquo; because
            it decides what gets emphasised and what the Implementation section asks of you.
          </p>
        </Step>

        <Step n="02" title="Research runs across three sources">
          <p>
            A Claude agent starts researching immediately with web search. In parallel, two
            prompts are generated — one tuned for Perplexity, one for ChatGPT — and written to{' '}
            <code className="font-mono text-[0.9em] text-[var(--accent)] bg-[var(--surface-2)] px-1 py-0.5 rounded">
              {'{topic}/prompts/'}
            </code>
            .
          </p>
          <p>
            With API keys configured, both are called automatically and you skip to step 4.
            Without them, you get the copy-paste path, which is fully supported rather than a
            degraded mode.
          </p>
          <Note>
            The three sources are deliberately different. Claude and Perplexity search the
            live web and cite; ChatGPT reasons from what it knows. Where they disagree is
            where the interesting corrections come from — which is the point of using three.
          </Note>
        </Step>

        <Step n="03" title="Feed the other two sources">
          <p>
            Each prompt is shown in the chat as its own copy block, and saved as a file. Paste
            the first into Perplexity and the second into ChatGPT (use reasoning mode if you
            have it), then save each response into the topic&rsquo;s research folder:
          </p>
          <Cmd>{`{topic}/research/perplexity-research.md
{topic}/research/chatgpt-research.md`}</Cmd>
          <p>
            Or just paste each response back into the chat and let it write the files — less
            friction, and it avoids the mistake below.
          </p>
          <Note>
            Any text extension works, but the file must land in{' '}
            <code className="font-mono text-[0.9em]">research/</code>. A response saved
            somewhere else is silently not used, and the guide will look complete without it.
          </Note>
        </Step>

        <Step n="04" title="Combine and fact-check">
          <p>
            Say <strong className="font-semibold text-[var(--text-bright)]">continue</strong>.
            Every research file is read, then fact-checkers are dispatched — each taking one
            domain of the material, verifying claims against primary sources, and adjudicating
            wherever the three sources contradict each other.
          </p>
          <p>
            This is the step that earns its cost. On the first real run it caught a claim that
            two of three sources agreed on and the kernel documentation flatly contradicted,
            capability names that were wrong in the upstream vendor docs, and two passages
            presented as direct quotes that did not appear in the documents they cited.
          </p>
          <p>
            What survives becomes{' '}
            <code className="font-mono text-[0.9em] text-[var(--accent)] bg-[var(--surface-2)] px-1 py-0.5 rounded">
              {'{topic}/{topic}-study-guide.md'}
            </code>
            . Corrections go to a separate{' '}
            <code className="font-mono text-[0.9em]">fact-check-notes.md</code> so they
            don&rsquo;t sit between the content and the questions.
          </p>
        </Step>

        <Step n="05" title="It appears here">
          <p>
            The guide is converted to JSON and written into the site, which is the only place
            the app reads from:
          </p>
          <Cmd>web/public/guides/{'{topic}'}.json</Cmd>
          <p>Then start the app:</p>
          <Cmd>{`cd web && npm run dev`}</Cmd>
          <Note>
            The guide list is read at build time. A new guide shows up on refresh in dev, but
            a deployed build needs rebuilding to see it.
          </Note>
        </Step>

        <Step n="06" title="Study it in the right order">
          <p>
            Start with the <strong className="font-semibold text-[var(--text-bright)]">Priming Pass</strong>{' '}
            and genuinely attempt its questions before reading anything else. They are meant
            to be mostly unanswerable — attempting and failing is what makes the answers stick
            when you meet them. Skipping this is skipping the cheapest step in the whole
            method.
          </p>
          <p>
            Then read broadly and come back deeper. Finish in{' '}
            <strong className="font-semibold text-[var(--text-bright)]">Implementation</strong>{' '}
            — reading the guide is not the same as being able to do the thing, and the
            exercises there are ordered easiest-first for that reason.
          </p>
          <p>
            If you have several guides, rotate between them in a session rather than spending
            a day on each. Mixing topics improves retention and holds motivation. And study
            when your energy is high rather than whenever the time is free — an hour sharp
            beats two tired.
          </p>
        </Step>

        <div className="border-t border-[var(--border)] pt-8 mt-2">
          <h2 className="font-display font-semibold text-[20px] tracking-[-0.015em] text-[var(--text-bright)] mb-3">
            Importing a guide you already have
          </h2>
          <p className="text-[16.5px] leading-relaxed mb-4">
            If the markdown already uses the section headings below, convert it directly —
            no research run needed:
          </p>
          <Cmd>{`node lib/guide-to-json.js \\
  --input  path/to/your-guide.md \\
  --output web/public/guides/your-slug.json \\
  --slug   your-slug \\
  --role   "security engineer" \\
  --goal   "what you wanted to learn"`}</Cmd>
          <p className="text-[16.5px] leading-relaxed mt-4 mb-3">
            The converter recognises these headings. Anything else still renders — it just
            becomes a plain section.
          </p>
          <ul className="text-[15.5px] leading-relaxed flex flex-col gap-1.5 pl-5 list-disc marker:text-[var(--text-dim)]">
            <li><code className="font-mono text-[0.9em]">## What You&rsquo;ll Learn</code></li>
            <li><code className="font-mono text-[0.9em]">## Priming Pass</code></li>
            <li><code className="font-mono text-[0.9em]">## Key Concepts &amp; Definitions</code> — as a two-column table</li>
            <li><code className="font-mono text-[0.9em]">## Rules &amp; Frameworks</code></li>
            <li><code className="font-mono text-[0.9em]">## Comprehensive Breakdown</code> — with <code className="font-mono text-[0.9em]">###</code> subsections</li>
            <li><code className="font-mono text-[0.9em]">## Common Misconceptions</code> — a numbered list</li>
            <li><code className="font-mono text-[0.9em]">## Connections &amp; Context</code></li>
            <li><code className="font-mono text-[0.9em]">## Implementation</code></li>
            <li><code className="font-mono text-[0.9em]">## Reinforcement Questions</code> — with <code className="font-mono text-[0.9em]">### Recall / Comprehension / Application / Challenge Questions</code></li>
          </ul>
        </div>
      </div>
    </main>
  );
}
