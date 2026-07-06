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
import { jaJP } from "@clerk/localizations";
import { Toaster } from "react-hot-toast";

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

import { getAuth, clerkClient } from "@clerk/react-router/server";

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
    let noProjectFound = false;

    if (userId) {
      try {
        // Fetch full user details from Clerk API to ensure we always have the email
        const client = clerkClient(args);
        const clerkUser = await client.users.getUser(userId);
        const fetchedEmail = clerkUser.emailAddresses[0]?.emailAddress || "";
        const fetchedName = clerkUser.firstName || clerkUser.lastName ? `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() : "";

        // Sync Clerk user with D1 database user table
        let userResult = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
        
        if (!userResult) {
          const email = fetchedEmail;
          const defaultRole = role || "client";
          
          // Check if there is a pending placeholder user with matching email
          const pendingUser = await db.prepare(
            "SELECT * FROM users WHERE email = ? AND role = 'client' AND id LIKE 'pending_%'"
          ).bind(email).first();
          
          if (pendingUser) {
            const placeholderId = pendingUser.id;
            // Migrating pending user id to real Clerk userId
            await db.batch([
              db.prepare("INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)").bind(userId, email, fetchedName, defaultRole),
              db.prepare("UPDATE projects SET client_id = ? WHERE client_id = ?").bind(userId, placeholderId),
              db.prepare("DELETE FROM users WHERE id = ?").bind(placeholderId)
            ]);
            userResult = { id: userId, email, name: fetchedName, role: defaultRole };
          } else {
            await db.prepare(
              "INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)"
            ).bind(userId, email, fetchedName, defaultRole).run();
            
            userResult = { id: userId, email, name: fetchedName, role: defaultRole };
          }
        } else {
          // If the existing user has an empty email and we now have the email from Clerk API, update it
          if (!userResult.email && fetchedEmail) {
            await db.prepare("UPDATE users SET email = ?, name = ? WHERE id = ?").bind(fetchedEmail, fetchedName, userId).run();
            userResult.email = fetchedEmail;
            userResult.name = fetchedName;
          } else if (!userResult.name && fetchedName) {
            await db.prepare("UPDATE users SET name = ? WHERE id = ?").bind(fetchedName, userId).run();
            userResult.name = fetchedName;
          }
        }

        user = {
          uid: userResult.id,
          email: userResult.email,
          role: userResult.role,
          name: fetchedName || userResult.email.split("@")[0] || "ユーザー",
        };

        if (userResult.role === "client") {
          // ログインユーザーのプロジェクトを取得
          let projectResult = await db.prepare("SELECT * FROM projects WHERE client_id = ?").bind(userId).first();
          
          // プロジェクトがない場合
          if (!projectResult) {
            const isDev = process.env.NODE_ENV === "development";
            if (isDev) {
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
              } else {
                // 引き継ぐダミープロジェクトも既に他で使われている場合は、自動で新規プロジェクトを作成して紐づける
                const newProjectId = crypto.randomUUID();
                await db.batch([
                  db.prepare(
                    "INSERT INTO projects (id, client_id, title, progress_rate, booking_limit) VALUES (?, ?, ?, ?, ?)"
                  ).bind(
                    newProjectId,
                    userId,
                    "新規クライアント Webサイト制作プロジェクト",
                    0,
                    3
                  ),
                  db.prepare(
                    "INSERT INTO hearings (id, project_id, status, overview_data, content_data, terms_accepted) VALUES (?, ?, ?, ?, ?, ?)"
                  ).bind(
                    crypto.randomUUID(),
                    newProjectId,
                    "draft",
                    "{}",
                    "{}",
                    0
                  )
                ]);
                projectResult = await db.prepare("SELECT * FROM projects WHERE client_id = ?").bind(userId).first();
              }
            } else {
              // 本番環境（production）の場合は自動生成せず、フラグを立てる
              noProjectFound = true;
            }
          }

          if (projectResult) {
            // ヒアリングシートのステータスを取得
            const hearingResult = await db.prepare("SELECT status, content_data FROM hearings WHERE project_id = ?").bind(projectResult.id).first();
            const hearingSubmitted = hearingResult ? hearingResult.status === "submitted" : false;

            let contentSubmitted = false;
            if (hearingResult && (hearingResult as any).content_data) {
              try {
                const contentData = JSON.parse((hearingResult as any).content_data);
                contentSubmitted = Boolean(contentData.submitted);
              } catch (e) {}
            }

            let metaData = {};
            if (projectResult.meta_data) {
              try {
                metaData = JSON.parse(projectResult.meta_data as string);
              } catch (e) {}
            }

            project = {
              id: projectResult.id,
              title: projectResult.title,
              progressRate: projectResult.progress_rate,
              bookingLimit: projectResult.booking_limit,
              currentPhase: projectResult.current_phase,
              planName: (metaData as any).planName || "未設定",
              launchDate: (metaData as any).launchDate || "未設定",
              siteType: (metaData as any).siteType || "未設定",
              directorName: (metaData as any).directorName || "未設定",
              hearingSubmitted,
              contentSubmitted,
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
      noProjectFound,
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
    <ClerkProvider loaderData={loaderData} localization={jaJP}>
      <Outlet />
      <Toaster position="bottom-right" />
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

