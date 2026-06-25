import type { Route } from "./+types/assets";
import { requireUserRole } from "../../utils/auth.server";

export async function loader(args: Route.LoaderArgs) {
  const { context, request } = args;
  // Ensure the user is logged in
  await requireUserRole(args, ["admin", "client"]);
  
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return new Response("Missing key parameter", { status: 400 });
  }
  
  const bucket = (context as any).cloudflare.env.BUCKET;
  try {
    const object = await bucket.get(key);
    
    if (!object) {
      return new Response("Asset Not Found", { status: 404 });
    }
    
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    // Cache control for performance
    headers.set("Cache-Control", "private, max-age=86400");
    
    return new Response(object.body, {
      headers,
    });
  } catch (e) {
    console.error("R2 get asset error:", e);
    return new Response("Internal Server Error", { status: 500 });
  }
}
