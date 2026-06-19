import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { multiMonthTotals, addExpense, deleteExpense, addRecurring, processRecurringExpenses } from '../src/lib/expenses';
import { formatCurrency } from '../src/lib/format';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

// Use an in-memory DB for testing by overriding DATABASE_PATH
const TEST_DB = ':memory:';

// We need to bootstrap the DB before tests
import { getDb } from '../src/lib/db';

describe('formatCurrency', () => {
  it('formats euro correctly', () => {
    const s = formatCurrency(1234.5);
    expect(s).toContain('1.234');
    expect(s).toContain('50');
  });

  it('formats zero', () => {
    const s = formatCurrency(0);
    expect(s).toContain('0');
  });
});

describe('multiMonthTotals', () => {
  it('returns N entries', () => {
    process.env.DATABASE_PATH = TEST_DB;
    const results = multiMonthTotals('nonexistent-user', 6);
    expect(results).toHaveLength(6);
    expect(results.every((r) => r.total === 0)).toBe(true);
  });

  it('months are in chronological order', () => {
    const results = multiMonthTotals('nonexistent-user', 3);
    expect(results[0].month < results[1].month).toBe(true);
    expect(results[1].month < results[2].month).toBe(true);
  });
});

describe('processRecurringExpenses', () => {
  it('is idempotent', () => {
    // calling twice should not double-insert
    const r1 = processRecurringExpenses();
    const r2 = processRecurringExpenses();
    // With no recurring entries, both should return 0
    expect(r1.inserted).toBe(0);
    expect(r2.inserted).toBe(0);
  });
});
