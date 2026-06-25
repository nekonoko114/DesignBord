import { SignIn } from "@clerk/react-router";
import { redirect } from "react-router";
import type { Route } from "./+types/login";
import { getAuth } from "@clerk/react-router/server";

export async function loader(args: Route.LoaderArgs) {
  // If already authenticated, redirect to appropriate dashboard based on role
  const auth = await getAuth(args);
  const userId = auth?.userId;
  const role = (auth?.sessionClaims?.metadata as any)?.role;

  console.log("Login loader auth:", JSON.stringify(auth, null, 2));

  if (userId && role) {
    if (role === "admin") {
      return redirect("/admin/dashboard");
    } else {
      return redirect("/client/dashboard");
    }
  } else if (userId) {
    // If authenticated but no role, default to client dashboard or wait
    console.log("User authenticated but no role found in metadata.");
    return redirect("/client/dashboard");
  }

  return {};
}

export default function Login() {
  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "var(--bg-color)",
      padding: "2rem"
    }}>
      <div className="neumorphic-panel" style={{
        width: "100%",
        maxWidth: "480px",
        padding: "3.5rem 3rem",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}>
        <h1 className="kinetic-text" style={{ fontSize: "2.5rem", marginBottom: "2.5rem", fontWeight: 600 }}>
          DesignBoard
        </h1>
        
        <SignIn 
          routing="path"
          path="/login"
          fallbackRedirectUrl="/client/dashboard"
        />
      </div>
    </div>
  );
}
