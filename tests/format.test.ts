import { describe, expect, it } from 'vitest';
import { formatDuration, formatNumber, formatPower, suffixForTier } from '../src/core';

describe('formatNumber', () => {
  it('follows 999, 1.2K, 3.4M, 5.6B, 7.8T, aa, ab', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(999.9)).toBe('999');
    expect(formatNumber(1000)).toBe('1K');
    expect(formatNumber(1234)).toBe('1.2K');
    expect(formatNumber(12_345)).toBe('12.3K');
    expect(formatNumber(123_456)).toBe('123K');
    expect(formatNumber(3_400_000)).toBe('3.4M');
    expect(formatNumber(5.6e9)).toBe('5.6B');
    expect(formatNumber(7.8e12)).toBe('7.8T');
    expect(formatNumber(1e15)).toBe('1aa');
    expect(formatNumber(2.5e18)).toBe('2.5ab');
    expect(formatNumber(1e21)).toBe('1ac');
    expect(formatNumber(-1500)).toBe('-1.5K');
  });

  it('floors rather than rounds up', () => {
    expect(formatNumber(1999)).toBe('1.9K');
  });

  it('builds letter suffixes after T', () => {
    expect(suffixForTier(5)).toBe('aa');
    expect(suffixForTier(6)).toBe('ab');
    expect(suffixForTier(30)).toBe('az');
    expect(suffixForTier(31)).toBe('ba');
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(9)).toBe('9s');
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(3725)).toBe('1h 2m');
  });
});

describe('formatPower', () => {
  it('shows power exactly (with commas) up to 9,999,999, then with two decimals, so every gain shows', () => {
    expect(formatPower(0)).toBe('0');
    expect(formatPower(999)).toBe('999');
    expect(formatPower(1234)).toBe('1,234');
    expect(formatPower(152_400)).toBe('152,400');
    expect(formatPower(152_700)).toBe('152,700');
    expect(formatPower(9_999_999.9)).toBe('9,999,999');
    expect(formatPower(12_345_678)).toBe('12.34M');
    expect(formatPower(5.678e9)).toBe('5.67B');
    expect(formatPower(-1234)).toBe('-1,234');
    // What formatNumber can't tell apart, formatPower can.
    expect(formatNumber(152_400)).toBe(formatNumber(152_700));
    expect(formatPower(152_400)).not.toBe(formatPower(152_700));
  });
});
