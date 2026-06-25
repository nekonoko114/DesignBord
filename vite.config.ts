import { reactRouter } from "@react-router/dev/vite";
import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, ViteDevServer } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    cloudflareDevProxy({
      async getLoadContext({ context }) {
        const { createRequire } = await import("module");
        const require = createRequire(import.meta.url);
        const { RouterContextProvider } = require("react-router");
        
        const provider = new RouterContextProvider();
        Object.assign(provider, context);
        return provider;
      }
    }),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths()
  ],
});
