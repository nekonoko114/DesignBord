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
