import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load the repo's .env into process.env so the keys documented in
// .env.example are actually visible to hasApiKey() and the callers below.
// Real environment variables win: loadEnvFile does not overwrite what is
// already set, so an exported key beats a stale .env entry.
const envPath = join(dirname(dirname(fileURLToPath(import.meta.url))), '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 300;

export function hasApiKey(provider) {
  if (provider === 'perplexity') return !!process.env.PERPLEXITY_API_KEY;
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY;
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt) {
  return Math.pow(2, attempt - 1) * BASE_BACKOFF_MS;
}

// Fetches with retry + exponential backoff. Retries up to MAX_RETRIES total
// attempts on 429 (rate limit) or other non-OK responses. Throws a
// descriptive error (including the HTTP status) if all attempts fail.
async function fetchWithRetry(url, options, maxRetries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) throw err;
      await sleep(backoffMs(attempt));
      continue;
    }

    if (res.ok) return res;

    const isRateLimited = res.status === 429;
    const body = await res.text().catch(() => '');
    lastError = new Error(`API request failed with status ${res.status}: ${body}`);

    if (attempt === maxRetries) {
      throw lastError;
    }

    if (isRateLimited || !res.ok) {
      await sleep(backoffMs(attempt));
      continue;
    }
  }

  throw lastError;
}

export async function callPerplexity(prompt, outputPath) {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    throw new Error('PERPLEXITY_API_KEY is not set. Set it in your environment to use the Perplexity API.');
  }

  const res = await fetchWithRetry('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';

  let markdown = `# Perplexity Research\n\n${content}`;
  if (Array.isArray(data.citations) && data.citations.length > 0) {
    markdown += '\n\n## Sources\n\n';
    markdown += data.citations.map((url, i) => `${i + 1}. ${url}`).join('\n');
    markdown += '\n';
  }

  if (outputPath) {
    await writeFile(outputPath, markdown, 'utf-8');
  }

  return markdown;
}

export async function callChatGPT(prompt, outputPath) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY is not set. Set it in your environment to use the OpenAI API.');
  }

  const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a thorough research assistant. Take your time to reason deeply about the topic before responding. Explain underlying mechanisms and reasoning, not just surface facts. Be comprehensive and precise.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  const markdown = `# ChatGPT Research\n\n${content}`;

  if (outputPath) {
    await writeFile(outputPath, markdown, 'utf-8');
  }

  return markdown;
}

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 2) {
    flags[args[i].replace(/^--/, '')] = args[i + 1];
  }
  return flags;
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const flags = parseFlags(process.argv.slice(2));
  const promptFile = flags['prompt-file'];
  const { provider, output } = flags;

  if (!promptFile || !provider || !output) {
    console.error('Usage: node lib/api-clients.js --prompt-file <path> --provider perplexity|openai --output <path>');
    process.exit(1);
  }

  if (provider !== 'perplexity' && provider !== 'openai') {
    console.error(`Unknown provider "${provider}". Expected "perplexity" or "openai".`);
    process.exit(1);
  }

  try {
    const prompt = await readFile(promptFile, 'utf-8');

    if (provider === 'perplexity') {
      await callPerplexity(prompt, output);
      console.log(`Perplexity research saved to ${output}`);
    } else {
      await callChatGPT(prompt, output);
      console.log(`ChatGPT research saved to ${output}`);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
