import { useState, useRef } from "react";
import { useLoaderData, useNavigate, useSubmit, useActionData } from "react-router";
import type { Route } from "./+types/project";
import type { FormData } from "../../types/form";
import { requireUserRole } from "../../utils/auth.server";
import { sendDiscordNotification } from "../../utils/discord.server";
import toast from "react-hot-toast";

interface ContentSection {
  id: string;
  title: string;
  content: string;
  files?: any[];
}

export async function action(args: Route.ActionArgs) {
  const { context, request, params } = args;
  const { userId } = await requireUserRole(args, ["admin"]);
  const db = (context as any).cloudflare.env.DB;
  const bucket = (context as any).cloudflare.env.BUCKET;
  const { id } = params;

  if (!id) return new Response(JSON.stringify({ error: "No project id" }), { status: 400 });

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "upload-file") {
    const file = formData.get("file") as File;
    const fileId = formData.get("fileId") as string || crypto.randomUUID();

    if (!file) {
      return new Response(JSON.stringify({ error: "ファイルがありません。" }), { status: 400 });
    }

    const key = `projects/${id}/${fileId}_${file.name}`;
    const buffer = await file.arrayBuffer();

    await bucket.put(key, buffer, {
      httpMetadata: { contentType: file.type }
    });

    const r2Url = `/api/assets?key=${encodeURIComponent(key)}`;
    const fileType = "design_comp";

    await db.prepare(
      "INSERT INTO files (id, project_id, file_type, r2_url, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))"
    ).bind(fileId, id, fileType, r2Url, userId).run();

    // Check project title
    const project = await db.prepare("SELECT title FROM projects WHERE id = ?").bind(id).first();

    const env = (context as any).cloudflare.env;
    await sendDiscordNotification(env, {
      title: "🎨 デザインアップロードのお知らせ",
      description: `新しいデザインカンプがアップロードされました。`,
      fields: [
        { name: "プロジェクト名", value: (project?.title as string) || "不明", inline: true },
        { name: "ファイル名", value: file.name, inline: true }
      ],
      color: 12098669,
    }).catch(console.error);

    return new Response(JSON.stringify({ success: true, file: { id: fileId, url: r2Url, name: file.name } }));
  }

  if (intent === "update-project-meta") {
    const planName = formData.get("planName") as string;
    const launchDate = formData.get("launchDate") as string;
    const siteType = formData.get("siteType") as string;
    const directorName = formData.get("directorName") as string;

    const metaData = JSON.stringify({ planName, launchDate, siteType, directorName });

    try {
      await db.prepare("UPDATE projects SET meta_data = ? WHERE id = ?").bind(metaData, id).run();
      return new Response(JSON.stringify({ success: true }));
    } catch (e) {
      console.error("Failed to update project meta:", e);
      return new Response(JSON.stringify({ error: "更新に失敗しました。" }), { status: 500 });
    }
  }

  if (intent === "delete-file") {
    const fileId = formData.get("fileId") as string;
    if (!fileId) return new Response(JSON.stringify({ error: "ファイルIDがありません。" }), { status: 400 });

    const fileRecord = await db.prepare("SELECT r2_url FROM files WHERE id = ?").bind(fileId).first();
    if (fileRecord) {
      const urlObj = new URL(fileRecord.r2_url as string, "http://localhost");
      const r2Key = urlObj.searchParams.get("key");
      if (r2Key) {
        await bucket.delete(r2Key);
      }
    }

    await db.prepare("DELETE FROM files WHERE id = ?").bind(fileId).run();

    return new Response(JSON.stringify({ success: true }));
  }

  return new Response(JSON.stringify({ error: "Invalid intent" }), { status: 400 });
}


export async function loader({ context, params, request }: Route.LoaderArgs) {
  await requireUserRole({ request, context } as any, ["admin"]);
  const db = (context as any).cloudflare.env.DB;
  const { id } = params;

  if (!id) {
    throw new Response("Not Found", { status: 404 });
  }

  // 1. Load project basic info
  const projectResult = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first();
  if (!projectResult) {
    throw new Response("Project Not Found", { status: 404 });
  }

  let metaData = {};
  if (projectResult.meta_data) {
    try {
      metaData = JSON.parse(projectResult.meta_data as string);
    } catch (e) {}
  }

  const project = {
    title: projectResult.title,
    progressRate: projectResult.progress_rate || 0,
    currentPhase: projectResult.current_phase || "Phase 1",
    planName: (metaData as any).planName || "",
    launchDate: (metaData as any).launchDate || "",
    siteType: (metaData as any).siteType || "",
    directorName: (metaData as any).directorName || "",
  };

  // 2. Load hearing and draft documents from hearings table
  let hearingData: FormData | null = null;
  let contentData: ContentSection[] | null = null;
  
  const hearingResult = await db.prepare("SELECT * FROM hearings WHERE project_id = ?").bind(projectResult.id).first();
  if (hearingResult) {
    try {
      const overview = hearingResult.overview_data ? JSON.parse(hearingResult.overview_data as string) : {};
      const content = hearingResult.content_data ? JSON.parse(hearingResult.content_data as string) : {};
      
      hearingData = { ...overview, ...content } as FormData;
      
      if (content && content.sections) {
        contentData = content.sections as ContentSection[];
      }
    } catch (e) {
      console.error("Failed to parse hearing/content data:", e);
    }
  }

  return {
    id,
    project,
    hearingData,
    contentData,
    designFiles: []
  };
}

export default function AdminProjectDetail() {
  const { id, project, hearingData, contentData } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: number }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [metaForm, setMetaForm] = useState({
    planName: project.planName,
    launchDate: project.launchDate,
    siteType: project.siteType,
    directorName: project.directorName
  });

  const handleMetaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("intent", "update-project-meta");
    formData.append("planName", metaForm.planName);
    formData.append("launchDate", metaForm.launchDate);
    formData.append("siteType", metaForm.siteType);
    formData.append("directorName", metaForm.directorName);

    try {
      const response = await fetch(window.location.pathname, { method: "POST", body: formData });
      const result = await response.json();
      if (result.success) {
        toast.success("プロジェクト情報を更新しました");
        submit(null, { method: "get" }); // revalidate
      } else {
        toast.error(result.error || "更新に失敗しました");
      }
    } catch (e) {
      toast.error("更新に失敗しました");
    }
  };

  const performUpload = async (filesArray: File[]) => {
    for (const file of filesArray) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`ファイルサイズが大きすぎます（50MB以下にしてください）: ${file.name}`);
        continue;
      }

      const fileId = crypto.randomUUID();
      const uploadFormData = new FormData();
      uploadFormData.append("intent", "upload-file");
      uploadFormData.append("fileId", fileId);
      uploadFormData.append("file", file);

      setUploadingFiles(prev => ({ ...prev, [fileId]: 50 }));

      try {
        const response = await fetch(window.location.pathname, {
          method: "POST",
          body: uploadFormData
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();

        if (result.success) {
          toast.success(`${file.name} をアップロードしました`);
          submit(null, { method: "get" }); // revalidate
        } else {
          toast.error(`ファイルのアップロードに失敗しました: ${result.error || file.name}`);
        }
      } catch (e) {
        console.error("Upload error:", e);
        toast.error(`ファイルのアップロードに失敗しました: ${file.name}`);
      } finally {
        setUploadingFiles(prev => {
          const next = { ...prev };
          delete next[fileId];
          return next;
        });
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length) return;
    const filesArray = Array.from(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await performUpload(filesArray);
  };

  return (
    <div style={{ maxWidth: '1000px', paddingBottom: '5rem' }}>
      <button 
        onClick={() => navigate('/admin/dashboard')}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}
        className="font-gothic"
      >
        一覧へ戻る
      </button>

      <header style={{ marginBottom: '3rem' }}>
        <h2 className="font-mincho" style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--text-color)', margin: 0 }}>
          {project.title}
        </h2>
        <p className="font-gothic" style={{ opacity: 0.6, marginTop: '0.5rem' }}>
          プロジェクトID: {id} | 現在のフェーズ: {project.currentPhase} | 進捗率: {project.progressRate}%
        </p>
      </header>

      <div style={{ display: 'grid', gap: '3rem' }}>

        {/* Project Meta Data Form */}
        <section className="neumorphic-panel" style={{ padding: '2.5rem' }}>
          <h3 className="font-mincho" style={{ fontSize: '1.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', marginBottom: '2rem' }}>
            プロジェクト基本情報
          </h3>
          <form onSubmit={handleMetaSubmit} style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }} className="font-gothic">
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>プラン名</label>
              <input
                type="text"
                value={metaForm.planName}
                onChange={e => setMetaForm({...metaForm, planName: e.target.value})}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--neu-border)', background: 'var(--neumorphic-dark)', color: 'var(--text-color)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>公開予定日</label>
              <input
                type="text"
                value={metaForm.launchDate}
                onChange={e => setMetaForm({...metaForm, launchDate: e.target.value})}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--neu-border)', background: 'var(--neumorphic-dark)', color: 'var(--text-color)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>サイト種別</label>
              <input
                type="text"
                value={metaForm.siteType}
                onChange={e => setMetaForm({...metaForm, siteType: e.target.value})}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--neu-border)', background: 'var(--neumorphic-dark)', color: 'var(--text-color)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>担当ディレクター</label>
              <input
                type="text"
                value={metaForm.directorName}
                onChange={e => setMetaForm({...metaForm, directorName: e.target.value})}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--neu-border)', background: 'var(--neumorphic-dark)', color: 'var(--text-color)' }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                type="submit"
                style={{ padding: '0.8rem 2rem', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                保存する
              </button>
            </div>
          </form>
        </section>
        
        {/* Hearing Data Details */}
        <section className="neumorphic-panel" style={{ padding: '2.5rem' }}>
          <h3 className="font-mincho" style={{ fontSize: '1.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', marginBottom: '2rem' }}>
            ヒアリングデータ
          </h3>
          
          {!hearingData ? (
            <p className="font-gothic" style={{ opacity: 0.5 }}>まだ提出されていません。</p>
          ) : (
            <div className="font-gothic" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div>
                <h4 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>会社・事業について</h4>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.5rem', borderRadius: '8px', border: 'var(--neu-border)' }}>
                  <p><strong>会社名:</strong> {hearingData.companyName || '未入力'}</p>
                  <p><strong>電話番号:</strong> {hearingData.phone || '未入力'}</p>
                  <p><strong>住所:</strong> {hearingData.address || '未入力'}</p>
                  <p><strong>希望納期:</strong> {hearingData.deadline || '未入力'}</p>
                  <p><strong>納品形式:</strong> {hearingData.deliveryFormat || '未入力'}</p>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>デザイン・希望</h4>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.5rem', borderRadius: '8px', border: 'var(--neu-border)' }}>
                  <p><strong>ご希望のカラー:</strong> {hearingData.themeColors ? hearingData.themeColors.join(', ') : '未選択'}</p>
                  <p><strong>デザインキーワード:</strong> {hearingData.designKeywords ? hearingData.designKeywords.join(', ') : '未選択'}</p>
                  <p><strong>参考サイト:</strong> {hearingData.competitors || '未入力'}</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Textual Draft Data */}
        <section className="neumorphic-panel" style={{ padding: '2.5rem' }}>
          <h3 className="font-mincho" style={{ fontSize: '1.4rem', borderBottom: 'var(--neu-border)', paddingBottom: '1rem', marginBottom: '2rem' }}>
            ご提出いただいた原稿データ
          </h3>

          {!contentData || contentData.length === 0 ? (
            <p className="font-gothic" style={{ opacity: 0.5 }}>まだ提出されていません。</p>
          ) : (
            <div className="font-gothic" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {contentData.map(section => (
                <div key={section.id}>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.8rem' }}>項目: {section.title}</h4>
                  <div style={{ 
                    background: 'var(--bg-color)', padding: '1.5rem', borderRadius: '8px', 
                    whiteSpace: 'pre-wrap', lineHeight: 1.6, border: 'var(--neu-border)'
                  }}>
                    {section.content || <span style={{ opacity: 0.4 }}>（本文なし）</span>}
                  </div>
                  
                  {/* Attached Files List */}
                  {section.files && section.files.length > 0 && (
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {section.files.map((file: any) => (
                        <div key={file.id} style={{ padding: '0.5rem 1rem', border: 'var(--neu-border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', fontSize: '0.8rem' }}>
                          <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>
                            {file.name}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Designs Upload / Reviews redirection */}
        <section className="neumorphic-panel" style={{ padding: '2.5rem' }}>
          <h3 className="font-mincho" style={{ fontSize: '1.4rem', borderBottom: 'var(--neu-border)', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>デザイン提出・レビュー管理</span>
            <button 
              onClick={() => navigate(`/admin/project/${id}/review`)}
              style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem', background: 'var(--accent-color)', color: 'var(--bg-color)', border: 'none', cursor: 'pointer' }}
            >
              レビューボードを開く
            </button>
          </h3>
          <p className="font-gothic" style={{ opacity: 0.7, marginBottom: '2rem' }}>
            デザインのアップロードや、クライアントからの修正指示の確認・対応は専用のレビューボードで行います。
          </p>

          <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--neumorphic-dark)', borderRadius: '12px', border: '1px dashed var(--neu-border)' }}>
            <h4 className="font-mincho" style={{ fontSize: '1rem', marginBottom: '1rem', marginTop: 0 }}>デザインカンプのアップロード</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                ref={fileInputRef}
                style={{ display: 'none' }}
                id="design-upload"
              />
              <label
                htmlFor="design-upload"
                style={{
                  display: 'inline-flex', alignItems: 'center', padding: '0.8rem 2rem',
                  background: 'var(--accent-color)', color: '#fff', borderRadius: '40px',
                  cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, boxShadow: '0 4px 10px rgba(184, 156, 109, 0.3)',
                }}
              >
                画像を選択してアップロード
              </label>
            </div>

            {/* Uploading Status */}
            {Object.entries(uploadingFiles).map(([fid, progress]) => (
              <div key={fid} style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
                アップロード中...
              </div>
            ))}
          </div>

        </section>

      </div>
    </div>
  );
}
