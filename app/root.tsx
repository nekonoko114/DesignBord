import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

import { clerkMiddleware, rootAuthLoader } from "@clerk/react-router/server";
import { ClerkProvider } from "@clerk/react-router";
import { seedDatabase } from "./utils/db.server";

// Export middleware for React Router v8_middleware pipeline
export const middleware = [clerkMiddleware()];

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600&family=Shippori+Mincho:wght@400;500;600;700&display=swap",
  },
];

import { getAuth } from "@clerk/react-router/server";

// Wrap root loader with Clerk rootAuthLoader
export const loader = (args: Route.LoaderArgs) => {
  return rootAuthLoader(args, async ({ context, request }) => {
    const db = (context as any).cloudflare.env.DB;
    
    // Seed default tables
    await seedDatabase(db);

    const auth = await getAuth(args);
    const userId = auth?.userId;
    const rawRole = (auth?.sessionClaims?.metadata as any)?.role;
    const role = (rawRole || "client") as "admin" | "client";

    let user = null;
    let project = null;

    if (userId) {
      try {
        // Sync Clerk user with D1 database user table
        let userResult = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
        
        if (!userResult) {
          const email = auth.sessionClaims?.email || "";
          const defaultRole = role || "client";
          
          await db.prepare(
            "INSERT INTO users (id, email, role) VALUES (?, ?, ?)"
          ).bind(userId, email, defaultRole).run();
          
          userResult = { id: userId, email, role: defaultRole };
        }

        user = {
          uid: userResult.id,
          email: userResult.email,
          role: userResult.role,
          name: auth.sessionClaims?.name || userResult.email.split("@")[0] || "ユーザー",
        };

        if (userResult.role === "client") {
          // ログインユーザーのプロジェクトを取得
          let projectResult = await db.prepare("SELECT * FROM projects WHERE client_id = ?").bind(userId).first();
          
          // プロジェクトがない場合、シードされたダミープロジェクトを引き継ぐ
          if (!projectResult) {
            const hasMockProject = await db.prepare("SELECT * FROM projects WHERE client_id = 'test_client_id'").first();
            if (hasMockProject) {
              await db.batch([
                // プロジェクトのクライアントIDを更新
                db.prepare("UPDATE projects SET client_id = ? WHERE client_id = 'test_client_id'").bind(userId),
                // ファイルのアップロード者を更新
                db.prepare("UPDATE files SET uploaded_by = ? WHERE uploaded_by = 'test_client_id'").bind(userId),
                // アノテーションの投稿者を更新
                db.prepare("UPDATE annotations SET user_id = ? WHERE user_id = 'test_client_id'").bind(userId)
              ]);
              projectResult = await db.prepare("SELECT * FROM projects WHERE client_id = ?").bind(userId).first();
            }
          }

          if (projectResult) {
            // ヒアリングシートのステータスを取得
            const hearingResult = await db.prepare("SELECT status FROM hearings WHERE project_id = ?").bind(projectResult.id).first();
            const hearingSubmitted = hearingResult ? hearingResult.status === "submitted" : false;

            project = {
              id: projectResult.id,
              title: projectResult.title,
              progressRate: projectResult.progress_rate,
              bookingLimit: projectResult.booking_limit,
              hearingSubmitted,
            };
          }
        }
      } catch (e) {
        console.error("Failed to load/sync session user in root loader:", e);
      }
    }

    return {
      user,
      project,
    };
  });
};

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Wrap application with ClerkProvider
export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <ClerkProvider loaderData={loaderData}>
      <Outlet />
    </ClerkProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}

