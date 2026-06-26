import { reactRouter } from "@react-router/dev/vite";
import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    cloudflareDevProxy({
      async getLoadContext({ context }) {
        const { RouterContextProvider } = await import("react-router");
        const provider = new RouterContextProvider();
        // cloudflare binding (DB, BUCKET, env vars) をプロバイダに設定
        (provider as any).cloudflare = (context as any).cloudflare;
        return provider;
      }
    }),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths()
  ],
});

