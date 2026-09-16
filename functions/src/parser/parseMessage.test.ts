// functions/src/parser/parseMessage.test.ts
import { describe, it, expect, vi } from 'vitest';
import { parseMessage } from './parseMessage';

describe('parseMessage', () => {
  it('recognizes "הצג רשימה" without calling AI', async () => {
    const aiParse = vi.fn();
    const result = await parseMessage('הצג רשימה', aiParse);
    expect(result).toEqual({ action: 'show', items: [] });
    expect(aiParse).not.toHaveBeenCalled();
  });

  it('recognizes "אני בסופר" without calling AI', async () => {
    const aiParse = vi.fn();
    const result = await parseMessage('אני בסופר', aiParse);
    expect(result).toEqual({ action: 'at_store', items: [] });
    expect(aiParse).not.toHaveBeenCalled();
  });

  it('uses the rule engine for a plain add without calling AI', async () => {
    const aiParse = vi.fn();
    const result = await parseMessage('חלב', aiParse);
    expect(result).toEqual({ action: 'add', items: ['חלב'] });
    expect(aiParse).not.toHaveBeenCalled();
  });

  it('falls back to AI when the rule engine is unsure', async () => {
    const aiParse = vi.fn().mockResolvedValue({ action: 'add', items: ['קפה'] });
    const result = await parseMessage('אין לנו יותר קפה', aiParse);
    expect(result).toEqual({ action: 'add', items: ['קפה'] });
    expect(aiParse).toHaveBeenCalledWith('אין לנו יותר קפה');
  });

  it('tolerates trailing punctuation on a special phrase', async () => {
    const aiParse = vi.fn();
    await expect(parseMessage('אני בסופר.', aiParse)).resolves.toEqual({
      action: 'at_store',
      items: [],
    });
    await expect(parseMessage('הצג רשימה!', aiParse)).resolves.toEqual({
      action: 'show',
      items: [],
    });
    expect(aiParse).not.toHaveBeenCalled();
  });
});
