import { describe, it, expect } from 'vitest';
import { generatePerplexityPrompt, generateChatGPTPrompt } from './prompts.js';

describe('generatePerplexityPrompt', () => {
  it('returns a string containing the role and goal', () => {
    const result = generatePerplexityPrompt('security engineer', 'understand container breakouts');
    expect(typeof result).toBe('string');
    expect(result).toContain('security engineer');
    expect(result).toContain('container breakouts');
  });

  it('instructs to cite sources with URLs', () => {
    const result = generatePerplexityPrompt('developer', 'learn React hooks');
    expect(result.toLowerCase()).toMatch(/cite|source|url|reference/);
  });

  it('requests structured markdown with definitions first', () => {
    const result = generatePerplexityPrompt('student', 'learn calculus');
    expect(result.toLowerCase()).toMatch(/definition/);
    expect(result.toLowerCase()).toMatch(/markdown/);
  });

  // Goals are written first-person ("...so I can troubleshoot X"), so the
  // prompt must introduce the learner in first person too. A third-person
  // frame produces "a security engineer who wants to ... so I can ...".
  it('frames the learner in first person, matching how goals are phrased', () => {
    const result = generatePerplexityPrompt(
      'security engineer',
      'understand how DNS resolution works so I can troubleshoot lookup failures'
    );
    expect(result).toContain('I am a security engineer');
    expect(result).not.toMatch(/a security engineer who wants to/);
  });

  // The prompts exist to feed a fixed guide structure. If a section of that
  // structure has nothing asking for it, that section gets synthesised from
  // nothing — so every section needs a corresponding request in both prompts.
  it('asks for material for every section of the guide structure', () => {
    const role = 'security engineer';
    const goal = 'evaluate detection tooling';
    for (const prompt of [generatePerplexityPrompt(role, goal), generateChatGPTPrompt(role, goal)]) {
      const text = prompt.toLowerCase();
      expect(text).toMatch(/definition/);
      expect(text).toMatch(/rules & frameworks|rules and frameworks/);
      expect(text).toMatch(/misconception/);
      expect(text).toMatch(/example/);
      expect(text).toMatch(/connect/);
      expect(text).toMatch(/recall/);
      expect(text).toMatch(/comprehension/);
      expect(text).toMatch(/application/);
      expect(text).toMatch(/challenge/);
    }
  });

  it('asks both sources how to apply the material, not just understand it', () => {
    for (const prompt of [generatePerplexityPrompt('engineer', 'x'), generateChatGPTPrompt('engineer', 'x')]) {
      expect(prompt.toLowerCase()).toMatch(/build, run or produce|applying it/);
    }
  });

  it('keeps person consistent between the two prompts', () => {
    const role = 'security engineer';
    const goal = 'understand eBPF so I can evaluate detection tooling';
    const perplexity = generatePerplexityPrompt(role, goal);
    const chatgpt = generateChatGPTPrompt(role, goal);
    for (const prompt of [perplexity, chatgpt]) {
      expect(prompt).toContain(`I am a ${role}`);
    }
  });
});

describe('generateChatGPTPrompt', () => {
  it('returns a string containing the role and goal', () => {
    const result = generateChatGPTPrompt('security engineer', 'understand container breakouts');
    expect(typeof result).toBe('string');
    expect(result).toContain('security engineer');
    expect(result).toContain('container breakouts');
  });

  it('instructs deep reasoning and mechanism explanation', () => {
    const result = generateChatGPTPrompt('developer', 'learn React hooks');
    expect(result.toLowerCase()).toMatch(/explain|mechanism|reason|why/);
  });

  it('requests misconceptions and examples', () => {
    const result = generateChatGPTPrompt('student', 'learn calculus');
    expect(result.toLowerCase()).toMatch(/misconception/);
    expect(result.toLowerCase()).toMatch(/example/);
  });
});
