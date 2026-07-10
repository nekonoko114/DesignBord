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
import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireUserRole } from "./auth.server";
import { getAuth } from "@clerk/react-router/server";
import { redirect } from "react-router";

// Mock dependencies
vi.mock("@clerk/react-router/server", () => ({
  getAuth: vi.fn(),
}));

// react-router's redirect usually throws a Response, we can mock it to just return one or throw an Error to easily catch
vi.mock("react-router", () => {
  return {
    redirect: vi.fn((url: string) => {
      // Simulate react-router throwing a redirect response
      const error = new Error(`REDIRECT:${url}`);
      (error as any).url = url;
      return error;
    }),
  };
});

describe("requireUserRole", () => {
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
  const createMockArgs = (url = "http://localhost/test-path") => ({
    request: {
      url,
      method: "GET",
    },
  });

  it("redirects to login when unauthenticated (getAuth returns null)", async () => {
    vi.mocked(getAuth).mockResolvedValueOnce(null as any);

    const args = createMockArgs();

    try {
      await requireUserRole(args, ["admin", "client"]);
      expect.unreachable("Should have thrown a redirect");
    } catch (e: any) {
      expect(redirect).toHaveBeenCalledWith("/login?redirectTo=%2Ftest-path");
      expect(e.message).toBe("REDIRECT:/login?redirectTo=%2Ftest-path");
    }
  });

  it("redirects to login when auth has no userId", async () => {
    vi.mocked(getAuth).mockResolvedValueOnce({} as any);

    const args = createMockArgs("http://localhost/dashboard");

    try {
      await requireUserRole(args, ["admin", "client"]);
      expect.unreachable("Should have thrown a redirect");
    } catch (e: any) {
      expect(redirect).toHaveBeenCalledWith("/login?redirectTo=%2Fdashboard");
      expect(e.message).toBe("REDIRECT:/login?redirectTo=%2Fdashboard");
    }
  });

  it("defaults to 'client' role if no role is explicitly set in metadata", async () => {
    vi.mocked(getAuth).mockResolvedValueOnce({
      userId: "user_123",
      sessionClaims: {},
    } as any);

    const args = createMockArgs();
    const result = await requireUserRole(args, ["admin", "client"]);

    expect(result).toEqual({ userId: "user_123", role: "client" });
  });

  it("redirects admin to admin dashboard if role is admin but only client is allowed", async () => {
    vi.mocked(getAuth).mockResolvedValueOnce({
      userId: "admin_123",
      sessionClaims: { metadata: { role: "admin" } },
    } as any);

    const args = createMockArgs();

    try {
      await requireUserRole(args, ["client"]);
      expect.unreachable("Should have thrown a redirect");
    } catch (e: any) {
      expect(redirect).toHaveBeenCalledWith("/admin/dashboard");
      expect(e.message).toBe("REDIRECT:/admin/dashboard");
    }
  });

  it("redirects client to client dashboard if role is client but only admin is allowed", async () => {
    vi.mocked(getAuth).mockResolvedValueOnce({
      userId: "client_123",
      sessionClaims: { metadata: { role: "client" } },
    } as any);

    const args = createMockArgs();

    try {
      await requireUserRole(args, ["admin"]);
      expect.unreachable("Should have thrown a redirect");
    } catch (e: any) {
      expect(redirect).toHaveBeenCalledWith("/client/dashboard");
      expect(e.message).toBe("REDIRECT:/client/dashboard");
    }
  });

  it("redirects unknown roles to login when not authorized", async () => {
    vi.mocked(getAuth).mockResolvedValueOnce({
      userId: "user_123",
      sessionClaims: { metadata: { role: "guest" } },
    } as any);

    const args = createMockArgs();

    try {
      await requireUserRole(args, ["admin", "client"]);
      expect.unreachable("Should have thrown a redirect");
    } catch (e: any) {
      expect(redirect).toHaveBeenCalledWith("/login");
      expect(e.message).toBe("REDIRECT:/login");
    }
  });

  it("returns userId and role when user is authorized", async () => {
    vi.mocked(getAuth).mockResolvedValueOnce({
      userId: "admin_123",
      sessionClaims: { metadata: { role: "admin" } },
    } as any);

    const args = createMockArgs();
    const result = await requireUserRole(args, ["admin"]);

    expect(result).toEqual({ userId: "admin_123", role: "admin" });
  });
});
