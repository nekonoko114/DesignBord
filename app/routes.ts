import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("login", "routes/login.tsx"),
  
  // クライアント用ルート
  layout("routes/client.tsx", [
    route("client/dashboard", "routes/client/dashboard.tsx"),
    route("client/discovery", "routes/client/discovery.tsx"),
    route("client/content-hub", "routes/client/content-hub.tsx"),
    route("client/review", "routes/client/review.tsx"),
  ]),

  // 管理者用ルート
  layout("routes/admin.tsx", [
    route("admin", "routes/admin/dashboard.tsx", { id: "admin-root" }),
    route("admin/dashboard", "routes/admin/dashboard.tsx"),
    route("admin/project/:id", "routes/admin/project.tsx"),
    route("admin/project/:id/review", "routes/admin/review.tsx"),
  ])
] satisfies RouteConfig;
