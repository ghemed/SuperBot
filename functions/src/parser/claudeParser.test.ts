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
});
