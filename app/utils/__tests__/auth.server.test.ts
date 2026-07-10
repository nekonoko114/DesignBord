import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireUserRole } from '../auth.server';

// Mock getAuth from clerk
vi.mock('@clerk/react-router/server', () => ({
  getAuth: vi.fn(),
}));

// Mock redirect from react-router
vi.mock('react-router', () => ({
  redirect: vi.fn((url) => {
    const error = new Error(`Redirecting to ${url}`);
    (error as any).status = 302;
    (error as any).url = url;
    return error;
  }),
}));

import { getAuth } from '@clerk/react-router/server';
import { redirect } from 'react-router';

describe('requireUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createArgs = (url = 'http://localhost/test') => ({
    request: {
      url,
      method: 'GET',
    },
  });

  it('redirects to /login if no auth', async () => {
    vi.mocked(getAuth).mockResolvedValueOnce(null as any);

    try {
      await requireUserRole(createArgs(), ['admin']);
      expect.fail('Should have thrown redirect');
    } catch (e: any) {
      expect(e.url).toBe('/login?redirectTo=%2Ftest');
      expect(redirect).toHaveBeenCalledWith('/login?redirectTo=%2Ftest');
    }
  });

  it('returns userId and role if user has allowed role', async () => {
    vi.mocked(getAuth).mockResolvedValueOnce({
      userId: 'user_123',
      sessionClaims: {
        metadata: {
          role: 'admin',
        },
      },
    } as any);

    const result = await requireUserRole(createArgs(), ['admin']);
    expect(result).toEqual({ userId: 'user_123', role: 'admin' });
  });

  it('redirects admin to /admin/dashboard if not in allowedRoles', async () => {
    vi.mocked(getAuth).mockResolvedValueOnce({
      userId: 'user_123',
      sessionClaims: {
        metadata: {
          role: 'admin',
        },
      },
    } as any);

    try {
      await requireUserRole(createArgs(), ['client']);
      expect.fail('Should have thrown redirect');
    } catch (e: any) {
      expect(e.url).toBe('/admin/dashboard');
      expect(redirect).toHaveBeenCalledWith('/admin/dashboard');
    }
  });

  it('redirects client to /client/dashboard if not in allowedRoles', async () => {
    vi.mocked(getAuth).mockResolvedValueOnce({
      userId: 'user_123',
      sessionClaims: {
        metadata: {
          role: 'client',
        },
      },
    } as any);

    try {
      await requireUserRole(createArgs(), ['admin']);
      expect.fail('Should have thrown redirect');
    } catch (e: any) {
      expect(e.url).toBe('/client/dashboard');
      expect(redirect).toHaveBeenCalledWith('/client/dashboard');
    }
  });

  it('redirects to /login if role is neither admin nor client', async () => {
    vi.mocked(getAuth).mockResolvedValueOnce({
      userId: 'user_123',
      sessionClaims: {
        metadata: {
          role: 'unknown_role',
        },
      },
    } as any);

    try {
      await requireUserRole(createArgs(), ['admin']);
      expect.fail('Should have thrown redirect');
    } catch (e: any) {
      expect(e.url).toBe('/login');
      expect(redirect).toHaveBeenCalledWith('/login');
    }
  });

  it('defaults to client role if no role metadata exists', async () => {
    vi.mocked(getAuth).mockResolvedValueOnce({
      userId: 'user_123',
      sessionClaims: {},
    } as any);

    // If allowedRoles includes 'client', it should return the role
    const result = await requireUserRole(createArgs(), ['client']);
    expect(result).toEqual({ userId: 'user_123', role: 'client' });
  });
});
