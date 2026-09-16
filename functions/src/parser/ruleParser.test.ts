// functions/src/parser/ruleParser.test.ts
import { describe, it, expect } from 'vitest';
import { parseRuleBased } from './ruleParser';

describe('parseRuleBased', () => {
  it('treats a bare item as an add', () => {
    expect(parseRuleBased('חלב')).toEqual({ action: 'add', items: ['חלב'] });
  });

  it('splits multiple bare items as an add', () => {
    expect(parseRuleBased('חלב, ביצים ולחם')).toEqual({
      action: 'add',
      items: ['חלב', 'ביצים', 'לחם'],
    });
  });

  it('recognizes "הסר X" as a removal', () => {
    expect(parseRuleBased('הסר חלב')).toEqual({ action: 'remove', items: ['חלב'] });
  });

  it('recognizes other removal keywords', () => {
    expect(parseRuleBased('מחק ביצים')).toEqual({ action: 'remove', items: ['ביצים'] });
    expect(parseRuleBased('תוריד לחם')).toEqual({ action: 'remove', items: ['לחם'] });
  });

  it('strips a leading object marker "את" after a removal keyword', () => {
    expect(parseRuleBased('הסר את החלב')).toEqual({ action: 'remove', items: ['החלב'] });
  });

  it('returns null for a question', () => {
    expect(parseRuleBased('מה יש ברשימה?')).toBeNull();
  });

  it('returns null for ambiguous "אין לנו" phrasing, deferring to AI', () => {
    expect(parseRuleBased('אין לנו יותר קפה')).toBeNull();
  });

  it('returns null for an empty message', () => {
    expect(parseRuleBased('   ')).toBeNull();
  });

  it('splits a multi-line removal message instead of falling through to add', () => {
    expect(parseRuleBased('מחק\nחלב\nביצים')).toEqual({
      action: 'remove',
      items: ['חלב', 'ביצים'],
    });
  });
});
