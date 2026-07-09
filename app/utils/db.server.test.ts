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
  });
});
