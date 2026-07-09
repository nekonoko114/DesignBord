import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireUserRole } from './auth.server';
import * as clerkReactRouterServer from '@clerk/react-router/server';
import { redirect } from 'react-router';

// Mocking the getAuth method
vi.mock('@clerk/react-router/server', () => ({
  getAuth: vi.fn(),
}));

// Mocking react-router redirect to just throw what it receives so we can assert it
vi.mock('react-router', () => ({
  redirect: vi.fn((url) => {
    // Create a mock Response to match what React Router does
    const response = new Response(null, {
      status: 302,
      headers: {
        Location: url,
      },
    });
    return response;
  }),
}));

describe('requireUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws a redirect to login with redirectTo search param when user is not authenticated', async () => {
    // Mock getAuth to return null (unauthenticated)
    vi.spyOn(clerkReactRouterServer, 'getAuth').mockResolvedValue(null as any);

    const mockRequest = new Request('http://localhost:3000/protected-route');
    const args = { request: mockRequest };

    try {
      await requireUserRole(args, ['admin']);
      // If it doesn't throw, fail the test
      expect.fail('Expected requireUserRole to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      const response = error as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/login?redirectTo=%2Fprotected-route');
    }
  });

  it('throws a redirect to login when auth is present but userId is null', async () => {
    // Mock getAuth to return auth but no userId
    vi.spyOn(clerkReactRouterServer, 'getAuth').mockResolvedValue({ userId: null } as any);

    const mockRequest = new Request('http://localhost:3000/another-route');
    const args = { request: mockRequest };

    try {
      await requireUserRole(args, ['client']);
      expect.fail('Expected requireUserRole to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      const response = error as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/login?redirectTo=%2Fanother-route');
    }
  });

  it('throws a redirect to default dashboard if user role does not match allowedRoles (admin)', async () => {
    vi.spyOn(clerkReactRouterServer, 'getAuth').mockResolvedValue({
      userId: 'user_123',
      sessionClaims: {
        metadata: {
          role: 'admin',
        },
      },
    } as any);

    const mockRequest = new Request('http://localhost:3000/client/dashboard');
    const args = { request: mockRequest };

    try {
      await requireUserRole(args, ['client']);
      expect.fail('Expected requireUserRole to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      const response = error as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/admin/dashboard');
    }
  });

  it('throws a redirect to default dashboard if user role does not match allowedRoles (client)', async () => {
    vi.spyOn(clerkReactRouterServer, 'getAuth').mockResolvedValue({
      userId: 'user_123',
      sessionClaims: {
        metadata: {
          role: 'client',
        },
      },
    } as any);

    const mockRequest = new Request('http://localhost:3000/admin/dashboard');
    const args = { request: mockRequest };

    try {
      await requireUserRole(args, ['admin']);
      expect.fail('Expected requireUserRole to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      const response = error as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/client/dashboard');
    }
  });

  it('returns userId and role if user is authenticated and has an allowed role', async () => {
    vi.spyOn(clerkReactRouterServer, 'getAuth').mockResolvedValue({
      userId: 'user_123',
      sessionClaims: {
        metadata: {
          role: 'admin',
        },
      },
    } as any);

    const mockRequest = new Request('http://localhost:3000/admin/dashboard');
    const args = { request: mockRequest };

    const result = await requireUserRole(args, ['admin']);
    expect(result).toEqual({ userId: 'user_123', role: 'admin' });
  });

  it('defaults to client role if no role is explicitly set', async () => {
    vi.spyOn(clerkReactRouterServer, 'getAuth').mockResolvedValue({
      userId: 'user_123',
      sessionClaims: {}, // no metadata.role
    } as any);

    const mockRequest = new Request('http://localhost:3000/client/dashboard');
    const args = { request: mockRequest };

    const result = await requireUserRole(args, ['client']);
    expect(result).toEqual({ userId: 'user_123', role: 'client' });
  });
});
