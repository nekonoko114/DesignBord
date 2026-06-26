import { requireUserRole } from "../../utils/auth.server";
import { sendDiscordNotification } from "../../utils/discord.server";
import type { Route } from "./+types/content-hub"; // wait, typescript might complain if the type doesn't exist, I'll use any

export async function action(args: any) {
  try {
    const { context, request } = args;
    const { userId } = await requireUserRole(args, ["client"]);
    
    const db = (context as any).cloudflare.env.DB;
    const bucket = (context as any).cloudflare.env.BUCKET;

    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    const project = await db.prepare("SELECT id, title FROM projects WHERE client_id = ?").bind(userId).first();
    if (!project) {
      return new Response(JSON.stringify({ error: "プロジェクトが見つかりません。" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    if (intent === "save-text") {
      const sectionsString = formData.get("sections") as string;
      if (!sectionsString) {
        return new Response(JSON.stringify({ error: "セクションデータがありません。" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }

      const hearing = await db.prepare("SELECT * FROM hearings WHERE project_id = ?").bind(project.id).first();
      const hearingId = hearing ? hearing.id : crypto.randomUUID();
      
      const contentDataObj = {
        sections: JSON.parse(sectionsString),
        submitted: false
      };

      await db.prepare(
        "INSERT OR REPLACE INTO hearings (id, project_id, status, overview_data, content_data, terms_accepted, updated_at) VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))"
      ).bind(
        hearingId,
        project.id,
        hearing ? hearing.status : 'draft',
        hearing ? hearing.overview_data : '{}',
        JSON.stringify(contentDataObj),
        hearing ? hearing.terms_accepted : 0
      ).run();

      await db.prepare("UPDATE projects SET last_activity_at = strftime('%s', 'now') WHERE id = ?").bind(project.id).run();

      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    if (intent === "submit-content") {
      const sectionsString = formData.get("sections") as string;
      if (!sectionsString) {
        return new Response(JSON.stringify({ error: "原稿データがありません。" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }

      const hearing = await db.prepare("SELECT * FROM hearings WHERE project_id = ?").bind(project.id).first();
      const hearingId = hearing ? hearing.id : crypto.randomUUID();
      
      const contentDataObj = {
        sections: JSON.parse(sectionsString),
        submitted: true
      };

      await db.prepare(
        "INSERT OR REPLACE INTO hearings (id, project_id, status, overview_data, content_data, terms_accepted, updated_at) VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))"
      ).bind(
        hearingId,
        project.id,
        hearing ? hearing.status : 'draft',
        hearing ? hearing.overview_data : '{}',
        JSON.stringify(contentDataObj),
        hearing ? hearing.terms_accepted : 0
      ).run();

      await db.prepare("UPDATE projects SET last_activity_at = strftime('%s', 'now') WHERE id = ?").bind(project.id).run();

      const env = (context as any).cloudflare.env;
      try {
        await sendDiscordNotification(env, {
          title: "📝 原稿提出のお知らせ",
          description: `クライアント様より原稿が最終提出されました。`,
          fields: [
            { name: "プロジェクト名", value: project.title as string, inline: true },
            { name: "提出セクション数", value: `${contentDataObj.sections.length}件`, inline: true }
          ],
          color: 3447003,
        });
      } catch (err: any) {
        console.error(`[ACTION] Discord notification failed:`, err);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    if (intent === "upload-file") {
      const file = formData.get("file") as File;
      const sectionId = formData.get("sectionId") as string;
      if (!file || !sectionId) {
        return new Response(JSON.stringify({ error: "ファイルまたはセクションIDがありません。" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }

      const fileId = crypto.randomUUID();
      const ext = file.name.split('.').pop() || '';
      const objectKey = `projects/${project.id}/content/${sectionId}/${fileId}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      await bucket.put(objectKey, arrayBuffer, {
        httpMetadata: { contentType: file.type }
      });

      await db.prepare(
        "INSERT INTO files (id, project_id, uploader_id, file_name, file_size, file_type, storage_path, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))"
      ).bind(
        fileId, project.id, userId, file.name, file.size, file.type, objectKey, 'content_reference'
      ).run();

      await db.prepare("UPDATE projects SET last_activity_at = strftime('%s', 'now') WHERE id = ?").bind(project.id).run();

      return new Response(JSON.stringify({ 
        success: true, 
        file: {
          id: fileId,
          name: file.name,
          url: `/api/assets?path=${encodeURIComponent(objectKey)}`,
          type: file.type,
          size: file.size
        }
      }), { headers: { "Content-Type": "application/json" } });
    }

    if (intent === "delete-file") {
      const sectionId = formData.get("sectionId") as string;
      const fileId = formData.get("fileId") as string;
      if (!sectionId || !fileId) {
        return new Response(JSON.stringify({ error: "セクションIDまたはファイルIDがありません。" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }

      const fileRecord = await db.prepare("SELECT * FROM files WHERE id = ? AND project_id = ?").bind(fileId, project.id).first();
      if (!fileRecord) {
        return new Response(JSON.stringify({ error: "ファイルが見つかりません。" }), { status: 404, headers: { "Content-Type": "application/json" } });
      }

      try {
        await bucket.delete(fileRecord.storage_path);
      } catch (err) {
        console.error("Failed to delete file from R2:", err);
      }

      await db.prepare("DELETE FROM files WHERE id = ?").bind(fileId).run();
      await db.prepare("UPDATE projects SET last_activity_at = strftime('%s', 'now') WHERE id = ?").bind(project.id).run();

      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "無効なリクエストです。" }), { status: 400, headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("Action error in content hub:", e);
    return new Response(JSON.stringify({ error: e.message || "サーバー処理中にエラーが発生しました。" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
