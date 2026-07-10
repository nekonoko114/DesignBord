import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedDatabase } from './db.server';

describe('seedDatabase', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should not call db.batch when the database is non-empty', async () => {
    const mockBatch = vi.fn();
    const mockPrepare = vi.fn().mockReturnValue({
      first: vi.fn().mockResolvedValue({ count: 1 }),
      bind: vi.fn(),
    });

    const mockDb = {
      prepare: mockPrepare,
      batch: mockBatch,
    };

    const consoleLogSpy = vi.spyOn(console, 'log');

    await seedDatabase(mockDb);

    // Verify it checks the user count
    expect(mockPrepare).toHaveBeenCalledWith("SELECT COUNT(*) as count FROM users");

    // Verify it does NOT call batch since count > 0
    expect(mockBatch).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalledWith("Seeding database with default schema data...");
  });

  it('should call db.batch when the database is empty', async () => {
    const mockBatch = vi.fn();

    const mockBind = vi.fn().mockReturnThis();
    const mockFirst = vi.fn().mockResolvedValue({ count: 0 });

    const mockPrepare = vi.fn().mockImplementation((query: string) => {
      return {
        first: mockFirst,
        bind: mockBind,
      };
    });

    const mockDb = {
      prepare: mockPrepare,
      batch: mockBatch,
    };

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await seedDatabase(mockDb);

    expect(mockPrepare).toHaveBeenCalledWith("SELECT COUNT(*) as count FROM users");
    expect(mockBatch).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith("Seeding database with default schema data...");
    expect(consoleLogSpy).toHaveBeenCalledWith("Database seeded successfully.");
import { describe, it, expect, vi } from 'vitest';
import { seedDatabase } from './db.server';

describe('seedDatabase', () => {
  it('should gracefully handle and log errors when seeding fails', async () => {
    // Mock console.error to spy on it and prevent it from logging during the test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create a mock db object that simulates a failure in the initial check
    const mockDb = {
      prepare: vi.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      }),
    };

    // Execute the seedDatabase function
    // We expect it to not throw an error, since there is a try-catch block
    await expect(seedDatabase(mockDb)).resolves.not.toThrow();

    // Verify that the error was caught and logged gracefully
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to seed database:',
      expect.any(Error)
    );
    expect(consoleSpy.mock.calls[0][1].message).toBe('Database connection failed');

    // Clean up the spy
    consoleSpy.mockRestore();
  });
});
