// functions/src/parser/splitItems.test.ts
import { describe, it, expect } from 'vitest';
import { splitItems } from './splitItems';

describe('splitItems', () => {
  it('returns a single item unchanged', () => {
    expect(splitItems('חלב')).toEqual(['חלב']);
  });

  it('splits a comma-separated list', () => {
    expect(splitItems('חלב, ביצים, לחם')).toEqual(['חלב', 'ביצים', 'לחם']);
  });

  it('splits a trailing vav-conjunction item', () => {
    expect(splitItems('חלב, ביצים ולחם')).toEqual(['חלב', 'ביצים', 'לחם']);
  });

  it('splits two items joined only by a vav conjunction', () => {
    expect(splitItems('חלב ולחם')).toEqual(['חלב', 'לחם']);
  });

  it('splits on newlines', () => {
    expect(splitItems('חלב\nביצים')).toEqual(['חלב', 'ביצים']);
  });

  it('drops empty chunks from stray commas', () => {
    expect(splitItems('חלב,, ביצים')).toEqual(['חלב', 'ביצים']);
  });

  it('does not split a single word that happens to start with vav', () => {
    expect(splitItems('וופלים')).toEqual(['וופלים']);
  });
});
