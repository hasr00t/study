import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile, unlink } from 'fs/promises';
import { hasApiKey, callPerplexity, callChatGPT } from './api-clients.js';

const TMP_PERPLEXITY = '/tmp/test-perplexity-output.md';
const TMP_CHATGPT = '/tmp/test-chatgpt-output.md';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('hasApiKey', () => {
  beforeEach(() => {
    delete process.env.PERPLEXITY_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('returns false when PERPLEXITY_API_KEY is not set', () => {
    expect(hasApiKey('perplexity')).toBe(false);
  });

  it('returns true when PERPLEXITY_API_KEY is set', () => {
    process.env.PERPLEXITY_API_KEY = 'test-key';
    expect(hasApiKey('perplexity')).toBe(true);
  });

  it('returns false when OPENAI_API_KEY is not set', () => {
    expect(hasApiKey('openai')).toBe(false);
  });

  it('returns true when OPENAI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    expect(hasApiKey('openai')).toBe(true);
  });
});

describe('callPerplexity', () => {
  beforeEach(() => {
    delete process.env.PERPLEXITY_API_KEY;
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await unlink(TMP_PERPLEXITY).catch(() => {});
  });

  it('throws an error containing PERPLEXITY_API_KEY when the key is missing', async () => {
    await expect(callPerplexity('test prompt', TMP_PERPLEXITY))
      .rejects.toThrow(/PERPLEXITY_API_KEY/);
  });

  it('calls the Perplexity chat completions endpoint with sonar-pro and bearer auth', async () => {
    process.env.PERPLEXITY_API_KEY = 'secret-key-123';
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'Some research content.' } }] })
    );
    vi.stubGlobal('fetch', fetchMock);

    await callPerplexity('research prompt', TMP_PERPLEXITY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.perplexity.ai/chat/completions');
    expect(options.headers['Authorization']).toBe('Bearer secret-key-123');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('sonar-pro');
    expect(body.messages[0].content).toBe('research prompt');
  });

  it('wraps the response content in markdown with a Perplexity Research heading', async () => {
    process.env.PERPLEXITY_API_KEY = 'secret-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'Findings about DNS.' } }] })
    ));

    const result = await callPerplexity('prompt', TMP_PERPLEXITY);

    expect(result.startsWith('# Perplexity Research')).toBe(true);
    expect(result).toContain('Findings about DNS.');
  });

  it('appends a Sources section when the response includes citations', async () => {
    process.env.PERPLEXITY_API_KEY = 'secret-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: 'Findings.' } }],
        citations: ['https://example.com/a', 'https://example.com/b'],
      })
    ));

    const result = await callPerplexity('prompt', TMP_PERPLEXITY);

    expect(result).toContain('## Sources');
    expect(result).toContain('https://example.com/a');
    expect(result).toContain('https://example.com/b');
  });

  it('omits the Sources section when there are no citations', async () => {
    process.env.PERPLEXITY_API_KEY = 'secret-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'Findings.' } }] })
    ));

    const result = await callPerplexity('prompt', TMP_PERPLEXITY);

    expect(result).not.toContain('## Sources');
  });

  it('writes the markdown to outputPath when provided', async () => {
    process.env.PERPLEXITY_API_KEY = 'secret-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'Findings.' } }] })
    ));

    const result = await callPerplexity('prompt', TMP_PERPLEXITY);
    const written = await readFile(TMP_PERPLEXITY, 'utf-8');

    expect(written).toBe(result);
  });

  it('never writes the API key into the output file', async () => {
    process.env.PERPLEXITY_API_KEY = 'super-secret-value';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'Findings.' } }] })
    ));

    await callPerplexity('prompt', TMP_PERPLEXITY);
    const written = await readFile(TMP_PERPLEXITY, 'utf-8');

    expect(written).not.toContain('super-secret-value');
  });

  it('retries on a 429 response and succeeds once the rate limit clears', async () => {
    process.env.PERPLEXITY_API_KEY = 'secret-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: 'Recovered.' } }] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await callPerplexity('prompt', null);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toContain('Recovered.');
  });

  it('throws a descriptive error for a non-OK, non-429 response after retries are exhausted', async () => {
    process.env.PERPLEXITY_API_KEY = 'secret-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'boom' }, 500)));

    await expect(callPerplexity('prompt', null)).rejects.toThrow(/500/);
  });
});

describe('callChatGPT', () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await unlink(TMP_CHATGPT).catch(() => {});
  });

  it('throws an error containing OPENAI_API_KEY when the key is missing', async () => {
    await expect(callChatGPT('test prompt', TMP_CHATGPT))
      .rejects.toThrow(/OPENAI_API_KEY/);
  });

  it('calls the OpenAI chat completions endpoint with gpt-4o, bearer auth, and a system message', async () => {
    process.env.OPENAI_API_KEY = 'secret-key-456';
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'Deep analysis.' } }] })
    );
    vi.stubGlobal('fetch', fetchMock);

    await callChatGPT('research prompt', TMP_CHATGPT);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(options.headers['Authorization']).toBe('Bearer secret-key-456');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('gpt-4o');
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content.toLowerCase()).toMatch(/reason|research|thorough/);
    expect(body.messages[1].content).toBe('research prompt');
  });

  it('wraps the response content in markdown with a ChatGPT Research heading', async () => {
    process.env.OPENAI_API_KEY = 'secret-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'Mechanism explained.' } }] })
    ));

    const result = await callChatGPT('prompt', TMP_CHATGPT);

    expect(result.startsWith('# ChatGPT Research')).toBe(true);
    expect(result).toContain('Mechanism explained.');
  });

  it('writes the markdown to outputPath when provided', async () => {
    process.env.OPENAI_API_KEY = 'secret-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'Mechanism explained.' } }] })
    ));

    const result = await callChatGPT('prompt', TMP_CHATGPT);
    const written = await readFile(TMP_CHATGPT, 'utf-8');

    expect(written).toBe(result);
  });

  it('retries on a 429 response and succeeds once the rate limit clears', async () => {
    process.env.OPENAI_API_KEY = 'secret-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: 'Recovered.' } }] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await callChatGPT('prompt', null);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toContain('Recovered.');
  });

  it('throws a descriptive error for a non-OK, non-429 response after retries are exhausted', async () => {
    process.env.OPENAI_API_KEY = 'secret-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'boom' }, 401)));

    await expect(callChatGPT('prompt', null)).rejects.toThrow(/401/);
  });
});
