// functions/src/parser/claudeParser.test.ts
import { describe, it, expect } from 'vitest';
import { createClaudeParser } from './claudeParser';

function mockCreate(responseText: string) {
  return async () => ({ content: [{ type: 'text', text: responseText }] });
}

describe('createClaudeParser', () => {
  it('parses a valid JSON response', async () => {
    const parse = createClaudeParser(mockCreate('{"action":"add","items":["קפה"]}'));
    await expect(parse('אין לנו יותר קפה')).resolves.toEqual({
      action: 'add',
      items: ['קפה'],
    });
  });

  it('falls back to unclear on malformed JSON', async () => {
    const parse = createClaudeParser(mockCreate('not json'));
    await expect(parse('???')).resolves.toEqual({ action: 'unclear', items: [] });
  });

  it('falls back to unclear on an unrecognized action value', async () => {
    const parse = createClaudeParser(mockCreate('{"action":"delete_everything","items":[]}'));
    await expect(parse('משהו מוזר')).resolves.toEqual({ action: 'unclear', items: [] });
  });

  it('falls back to unclear when the response has no text block', async () => {
    const parse = createClaudeParser(async () => ({ content: [{ type: 'image' }] }));
    await expect(parse('משהו')).resolves.toEqual({ action: 'unclear', items: [] });
  });

  it('falls back to unclear when items contains a non-string entry', async () => {
    const parse = createClaudeParser(mockCreate('{"action":"add","items":["קפה",42]}'));
    await expect(parse('קפה ו-42 משהו')).resolves.toEqual({ action: 'unclear', items: [] });
  });

  it('falls back to unclear when the API call itself rejects', async () => {
    const parse = createClaudeParser(async () => {
      throw new Error('rate limited');
    });
    await expect(parse('קפה')).resolves.toEqual({ action: 'unclear', items: [] });
  });

  it('falls back to unclear when action is add with no items', async () => {
    const parse = createClaudeParser(mockCreate('{"action":"add","items":[]}'));
    await expect(parse('משהו לא ברור')).resolves.toEqual({ action: 'unclear', items: [] });
  });

  it('falls back to unclear when action is remove with no items', async () => {
    const parse = createClaudeParser(mockCreate('{"action":"remove","items":[]}'));
    await expect(parse('משהו לא ברור')).resolves.toEqual({ action: 'unclear', items: [] });
  });

  it('falls back to unclear when items contains a blank string', async () => {
    const parse = createClaudeParser(mockCreate('{"action":"add","items":["קפה","   "]}'));
    await expect(parse('קפה ומשהו')).resolves.toEqual({ action: 'unclear', items: [] });
  });

  it('accepts an empty items array for show/at_store/unclear actions', async () => {
    const parse = createClaudeParser(mockCreate('{"action":"show","items":[]}'));
    await expect(parse('מה יש')).resolves.toEqual({ action: 'show', items: [] });
  });
});
