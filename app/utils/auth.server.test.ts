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
