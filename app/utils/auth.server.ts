import { redirect } from "react-router";
import { getAuth } from "@clerk/react-router/server";


export async function requireUserRole(args: any, allowedRoles: ("admin" | "client")[]) {
  // Extract auth using getAuth
  const auth = await getAuth(args);
  const request = args.request;
  
  console.log(`[DEBUG] requireUserRole called for ${request.method} ${request.url}`);
  console.log(`[DEBUG] auth.userId: ${auth?.userId}`);
  
  if (!auth || !auth.userId) {
    const redirectTo = new URL(request.url).pathname;
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }

  // Retrieve user role from Clerk session publicMetadata
  // Default to "client" if no role is explicitly set for new signups.
  const rawRole = (auth.sessionClaims?.metadata as any)?.role;
  const role = (rawRole || "client") as "admin" | "client";
  
  if (!allowedRoles.includes(role)) {
    // If user's role is not authorized for this area, redirect to their default landing page
    if (role === "admin") {
      throw redirect("/admin/dashboard");
    } else if (role === "client") {
      throw redirect("/client/dashboard");
    } else {
      throw redirect("/login");
    }
  }

  return { userId: auth.userId, role };
}
