import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendDiscordNotification } from './discord.server';

describe('sendDiscordNotification', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // We mock console.warn with a no-op function so it won't pollute the test output.
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call console.warn when DISCORD_WEBHOOK_URL is undefined', async () => {
    const env = {};
    const payload = {
      title: 'Test Title',
      description: 'Test Description',
    };

    await sendDiscordNotification(env, payload);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'DISCORD_WEBHOOK_URL is not defined in environment variables.'
    );
  });
});
