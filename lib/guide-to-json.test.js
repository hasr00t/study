import { describe, it, expect } from 'vitest';
import { convertGuideToJson } from './guide-to-json.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, 'fixtures', 'sample-guide.md');

describe('convertGuideToJson', () => {
  it('parses the title from the first H1', async () => {
    const result = await convertGuideToJson(fixturePath, null, { slug: 'test', role: 'engineer', goal: 'learn containers' });
    expect(result.title).toBe('Container Security Fundamentals');
  });

  it('extracts definitions from the Key Concepts table', async () => {
    const result = await convertGuideToJson(fixturePath, null, { slug: 'test', role: 'engineer', goal: 'learn containers' });
    const defSection = result.sections.find(s => s.type === 'definitions');
    expect(defSection).toBeDefined();
    expect(defSection.definitions.length).toBe(3);
    expect(defSection.definitions[0].term).toBe('Container');
  });

  it('extracts breakdown sections', async () => {
    const result = await convertGuideToJson(fixturePath, null, { slug: 'test', role: 'engineer', goal: 'learn containers' });
    const breakdowns = result.sections.filter(s => s.type === 'breakdown');
    expect(breakdowns.length).toBeGreaterThanOrEqual(2);
    expect(breakdowns[0].title).toBe('Linux Namespaces');
  });

  it('strips the source guide own section numbering', async () => {
    const result = await convertGuideToJson(fixturePath, null, { slug: 'test', role: 'engineer', goal: 'learn containers' });
    const breakdowns = result.sections.filter(s => s.type === 'breakdown');
    // Source headings are "### 1. Linux Namespaces" — the web app numbers by
    // position, so keeping both renders as "03 1. Linux Namespaces".
    expect(breakdowns[0].title).toBe('Linux Namespaces');
    expect(breakdowns[0].id).toBe('linux-namespaces');
    expect(breakdowns.every(s => !/^\d+[.)]\s/.test(s.title))).toBe(true);
  });

  it('extracts misconceptions', async () => {
    const result = await convertGuideToJson(fixturePath, null, { slug: 'test', role: 'engineer', goal: 'learn containers' });
    expect(result.misconceptions.length).toBe(2);
  });

  it('extracts quiz questions grouped by tier', async () => {
    const result = await convertGuideToJson(fixturePath, null, { slug: 'test', role: 'engineer', goal: 'learn containers' });
    expect(result.quiz.length).toBeGreaterThanOrEqual(8);
    const tiers = [...new Set(result.quiz.map(q => q.tier))];
    expect(tiers).toContain('recall');
    expect(tiers).toContain('comprehension');
    expect(tiers).toContain('application');
    expect(tiers).toContain('challenge');
  });

  it('types the priming, rules and implementation sections', async () => {
    const result = await convertGuideToJson(fixturePath, null, { slug: 'test', role: 'engineer', goal: 'learn containers' });
    const types = result.sections.map(s => s.type);
    expect(types).toContain('priming');
    expect(types).toContain('rules');
    expect(types).toContain('implementation');
  });

  it('orders priming before the definitions it primes for', async () => {
    const result = await convertGuideToJson(fixturePath, null, { slug: 'test', role: 'engineer', goal: 'learn containers' });
    const types = result.sections.map(s => s.type);
    expect(types.indexOf('priming')).toBeLessThan(types.indexOf('definitions'));
  });

  it('parses multiple-choice options, the keyed answer and the explanation', async () => {
    const result = await convertGuideToJson(fixturePath, null, { slug: 'test', role: 'engineer', goal: 'learn containers' });
    const q = result.quiz[0];
    expect(q.options.length).toBe(4);
    expect(q.options[0]).toBe('PID, network, mount, UTS, IPC, user');
    expect(q.answer).toBe(0);
    expect(q.explanation).toMatch(/partition the resources/);
  });

  it('resolves the answer letter to an option index', async () => {
    const result = await convertGuideToJson(fixturePath, null, { slug: 'test', role: 'engineer', goal: 'learn containers' });
    // Second recall question keys answer "b" -> index 1.
    expect(result.quiz[1].answer).toBe(1);
    expect(result.quiz[1].options[1]).toBe('cgroups');
  });

  it('links each question back to the section it came from', async () => {
    const result = await convertGuideToJson(fixturePath, null, { slug: 'test', role: 'engineer', goal: 'learn containers' });
    expect(result.quiz[0].section).toEqual({ id: 'linux-namespaces', title: 'Linux Namespaces' });
  });

  it('links on the last arrow, so arrows inside an explanation survive', async () => {
    const result = await convertGuideToJson(fixturePath, null, { slug: 'test', role: 'engineer', goal: 'learn containers' });
    // The comprehension explanation in the fixture is arrow-free, so assert the
    // behaviour directly against a question whose explanation contains one.
    const q = result.quiz.find(q => q.explanation.includes('cgroups cap'));
    expect(q).toBeDefined();
    expect(q.section).not.toBeNull();
  });

  it('leaves challenge questions open-response', async () => {
    const result = await convertGuideToJson(fixturePath, null, { slug: 'test', role: 'engineer', goal: 'learn containers' });
    const challenge = result.quiz.filter(q => q.tier === 'challenge');
    expect(challenge.length).toBeGreaterThan(0);
    expect(challenge.every(q => q.options.length === 0)).toBe(true);
  });

  it('does not mistake an option line for a new question', async () => {
    const result = await convertGuideToJson(fixturePath, null, { slug: 'test', role: 'engineer', goal: 'learn containers' });
    expect(result.quiz.every(q => !/^[a-d]\)/.test(q.question))).toBe(true);
    expect(result.quiz.length).toBe(8);
  });

  it('includes metadata in output', async () => {
    const result = await convertGuideToJson(fixturePath, null, { slug: 'test-slug', role: 'engineer', goal: 'learn containers' });
    expect(result.slug).toBe('test-slug');
    expect(result.role).toBe('engineer');
    expect(result.goal).toBe('learn containers');
  });
});
