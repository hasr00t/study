import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';

// Guides often number their own sections ("### 1. The Mental Model"). The web
// app numbers sections by position — which counts the intro, priming and
// definitions sections too — so keeping the source ordinal renders as "05 1.".
// The app's number is the accurate one, so drop the guide's.
function stripLeadingOrdinal(title) {
  return title.replace(/^\d+[.)]\s+/, '');
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// A markdown table separator row: | --- | :---: | etc.
function isTableSeparator(line) {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

function parseDefinitionsTable(content) {
  const lines = content.split('\n');
  const definitions = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed.startsWith('|')) {
      inTable = false;
      continue;
    }

    // Header row or separator row starts / continues the table but yields no data.
    if (isTableSeparator(trimmed)) {
      inTable = true;
      continue;
    }

    if (!inTable) {
      // First pipe row is the header.
      inTable = true;
      continue;
    }

    const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length >= 2) {
      definitions.push({ term: cells[0], definition: cells[1] });
    }
  }

  return definitions;
}

// A quiz question may be open-response (just a numbered line) or multiple
// choice, in which case it is followed by indented option lines and an answer
// line naming the correct letter:
//
//   1. What limits container resource usage?
//      - a) namespaces
//      - b) cgroups
//      > **b** — Namespaces partition; cgroups cap. -> Linux Namespaces
//
// The trailing arrow names the section to revisit when the question is missed.
// Open-response questions keep options: [] and are self-assessed by the reader.
function parseQuizQuestions(content, tier) {
  const questions = [];
  let current = null;

  const push = () => {
    if (current) questions.push(current);
    current = null;
  };

  for (const raw of content.split('\n')) {
    const line = raw.trim();

    const question = line.match(/^\d+[.)]\s+(.+)/);
    if (question) {
      push();
      current = {
        tier,
        question: question[1].trim(),
        options: [],
        answer: 0,
        explanation: '',
        sectionTitle: null,
      };
      continue;
    }

    if (!current) continue;

    const option = line.match(/^[-*]\s*([a-z])[).]\s+(.+)/i);
    if (option) {
      current.options.push(option[2].trim());
      continue;
    }

    const answer = line.match(/^>\s*\*\*([a-z])\*\*\s*(?:[—-]\s*)?(.*)/i);
    if (answer) {
      current.answer = answer[1].toLowerCase().charCodeAt(0) - 97;
      let rest = answer[2].trim();
      // "→ Section Title" (or "-> Section Title") names the section to revisit.
      // Match the LAST arrow: explanations legitimately contain arrows of their
      // own ("Compromised EC2 → metadata → credentials"), and matching the first
      // would swallow the explanation and lose the link.
      const link = rest.match(/^(.*)(?:→|->)\s*([^→]+)$/);
      if (link) {
        current.sectionTitle = link[2].trim();
        rest = link[1].replace(/\s*->\s*$/, '').trim();
      }
      current.explanation = rest.replace(/\s+$/, '');
    }
  }

  push();

  // A keyed answer outside the option range means the letter and the options
  // disagree; fall back to the first option rather than marking every attempt
  // wrong against an index that does not exist.
  for (const q of questions) {
    if (q.options.length && (q.answer < 0 || q.answer >= q.options.length)) {
      q.answer = 0;
    }
  }

  return questions;
}

function parseMisconceptions(content) {
  const items = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^\d+\.\s+(.+)/);
    if (match) {
      items.push(match[1].replace(/\*\*/g, '').trim());
    }
  }
  return items;
}

export async function convertGuideToJson(inputPath, outputPath, metadata = {}) {
  const md = await readFile(inputPath, 'utf-8');
  const lines = md.split('\n');

  let title = '';
  const sections = [];
  let misconceptions = [];
  const quiz = [];
  let currentH2 = '';
  let currentH3 = '';
  let currentH3Content = [];
  let currentH2Content = [];

  function flushH3() {
    if (!currentH3) {
      currentH3Content = [];
      return;
    }
    const content = currentH3Content.join('\n').trim();

    if (currentH2 === 'Reinforcement Questions') {
      const tierMap = {
        'Recall Questions': 'recall',
        'Comprehension Questions': 'comprehension',
        'Application Questions': 'application',
        'Challenge Questions': 'challenge',
      };
      const tier = tierMap[currentH3] || 'recall';
      quiz.push(...parseQuizQuestions(content, tier));
    } else if (currentH2 === 'Comprehensive Breakdown') {
      const title = stripLeadingOrdinal(currentH3);
      sections.push({
        id: slugify(title),
        title,
        type: 'breakdown',
        content,
      });
    }

    currentH3 = '';
    currentH3Content = [];
  }

  function flushH2() {
    flushH3();
    if (!currentH2) {
      currentH2Content = [];
      return;
    }
    const content = currentH2Content.join('\n').trim();

    if (currentH2 === "What You'll Learn") {
      sections.push({ id: 'what-youll-learn', title: currentH2, type: 'intro', content });
    } else if (currentH2 === 'Priming Pass') {
      // Read before the rest of the guide: a structure map plus questions the
      // reader is not expected to answer yet.
      sections.push({ id: 'priming', title: currentH2, type: 'priming', content });
    } else if (currentH2 === 'Rules & Frameworks') {
      sections.push({ id: 'rules-frameworks', title: currentH2, type: 'rules', content });
    } else if (currentH2 === 'Implementation') {
      sections.push({ id: 'implementation', title: currentH2, type: 'implementation', content });
    } else if (currentH2 === 'Key Concepts & Definitions') {
      const definitions = parseDefinitionsTable(content);
      sections.push({ id: 'key-concepts', title: currentH2, type: 'definitions', content, definitions });
    } else if (currentH2 === 'Common Misconceptions') {
      misconceptions = parseMisconceptions(content);
      sections.push({ id: 'misconceptions', title: currentH2, type: 'misconceptions', content });
    } else if (currentH2 === 'Connections & Context') {
      sections.push({ id: 'connections', title: currentH2, type: 'connections', content });
    } else if (currentH2 === 'Comprehensive Breakdown' || currentH2 === 'Reinforcement Questions') {
      // handled via H3 parsing
    } else {
      const title = stripLeadingOrdinal(currentH2);
      sections.push({ id: slugify(title), title, type: 'breakdown', content });
    }

    currentH2 = '';
    currentH2Content = [];
  }

  for (const line of lines) {
    if (line.startsWith('# ') && !title) {
      title = line.replace('# ', '').trim();
      continue;
    }
    if (line.startsWith('## ')) {
      flushH2();
      currentH2 = line.replace('## ', '').trim();
      continue;
    }
    if (line.startsWith('### ')) {
      flushH3();
      currentH3 = line.replace('### ', '').trim();
      continue;
    }
    if (currentH3) {
      currentH3Content.push(line);
    }
    currentH2Content.push(line);
  }
  flushH2();

  // Resolve each question's named section against the sections actually parsed,
  // so the quiz can offer the right material to revisit.
  for (const q of quiz) {
    const name = q.sectionTitle;
    delete q.sectionTitle;
    if (!name) {
      q.section = null;
      continue;
    }
    const match = sections.find(
      (s) => s.title.toLowerCase() === name.toLowerCase()
    );
    q.section = match ? { id: match.id, title: match.title } : null;
  }

  const result = {
    title,
    slug: metadata.slug || slugify(title),
    role: metadata.role || '',
    goal: metadata.goal || '',
    createdAt: metadata.createdAt || new Date().toISOString().split('T')[0],
    sections,
    misconceptions,
    quiz,
    sources: [],
    factCheckNotes: [],
  };

  if (outputPath) {
    await writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  }

  return result;
}

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    flags[arg.slice(2)] = args[i + 1];
    i += 1;
  }
  return flags;
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const flags = parseFlags(process.argv.slice(2));
  const { input, output, slug, role, goal } = flags;

  if (!input || !output) {
    console.error('Usage: node lib/guide-to-json.js --input <md> --output <json> [--slug x --role x --goal x]');
    process.exit(1);
  }

  try {
    const result = await convertGuideToJson(input, output, { slug, role, goal });
    console.log(`Converted: ${result.sections.length} sections, ${result.quiz.length} quiz questions → ${output}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
