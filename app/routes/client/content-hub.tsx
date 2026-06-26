import { useState, useEffect } from 'react';
import { useLoaderData, useActionData, Link } from 'react-router';
import type { Route } from './+types/content-hub';
import { requireUserRole } from '../../utils/auth.server';
import { sendDiscordNotification } from '../../utils/discord.server';

export interface UploadedFile {
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
  r2Key?: string;
}

export interface Section {
  id: string;
  title: string;
  content: string;
  files?: UploadedFile[];
}

export async function loader(args: Route.LoaderArgs) {
  const { context, request } = args;
  const { userId } = await requireUserRole(args, ["client"]);
  const db = (context as any).cloudflare.env.DB;

  let initialSections: Section[] = [
    { id: '1', title: '会社概要', content: '' },
    { id: '2', title: '代表挨拶', content: '' },
    { id: '3', title: 'サービス案内', content: '' },
    { id: '4', title: 'お問い合わせ情報', content: '' }
  ];
  let contentSubmitted = false;

  try {
    const project = await db.prepare("SELECT id FROM projects WHERE client_id = ?").bind(userId).first();
    if (project) {
      const hearing = await db.prepare("SELECT content_data FROM hearings WHERE project_id = ?").bind(project.id).first();
      if (hearing && hearing.content_data) {
        const contentDataObj = JSON.parse(hearing.content_data as string);
        if (contentDataObj.sections && contentDataObj.sections.length > 0) {
          initialSections = contentDataObj.sections;
        }
        contentSubmitted = Boolean(contentDataObj.submitted);
      }
    }
  } catch (e) {
    console.error("Failed to load initial content hub data:", e);
  }

  return {
    initialSections,
    contentSubmitted
  };
}

export async function action(args: Route.ActionArgs) {
  console.log(`[ACTION START] intent processing started for ${args.request.url}`);
  try {
    const { context, request } = args;
    const { userId } = await requireUserRole(args, ["client"]);
    console.log(`[ACTION] User ${userId} authorized.`);
    const db = (context as any).cloudflare.env.DB;
    const bucket = (context as any).cloudflare.env.BUCKET;

    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    console.log(`[ACTION] intent: ${intent}`);

    const project = await db.prepare("SELECT id, title FROM projects WHERE client_id = ?").bind(userId).first();
    if (!project) {
      return new Response(JSON.stringify({ error: "プロジェクトが見つかりません。" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    if (intent === "save-text") {
      const sectionsString = formData.get("sections") as string;
      if (!sectionsString) {
        return new Response(JSON.stringify({ error: "原稿データがありません。" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }

      const hearing = await db.prepare("SELECT * FROM hearings WHERE project_id = ?").bind(project.id).first();
      const hearingId = hearing ? hearing.id : crypto.randomUUID();
      
      let contentDataObj: any = {};
      if (hearing && hearing.content_data) {
        contentDataObj = JSON.parse(hearing.content_data as string);
      }
      contentDataObj.sections = JSON.parse(sectionsString);

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
      console.log(`[ACTION] intent === submit-content`);
      const sectionsString = formData.get("sections") as string;
      if (!sectionsString) {
        console.log(`[ACTION] No sections data`);
        return new Response(JSON.stringify({ error: "原稿データがありません。" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }

      console.log(`[ACTION] Updating hearing data...`);
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

      console.log(`[ACTION] Dispatching discord notification...`);
      // Dispatch Discord webhook notification
      const env = (context as any).cloudflare.env;
      try {
        await sendDiscordNotification(env, {
          title: "📝 原稿提出のお知らせ",
          description: `クライアント様より原稿が最終提出されました。`,
          fields: [
            { name: "プロジェクト名", value: project.title as string, inline: true },
            { name: "提出セクション数", value: `${contentDataObj.sections.length}件`, inline: true }
          ],
          color: 3447003, // 青系
        });
        console.log(`[ACTION] Discord notification sent successfully.`);
      } catch (err: any) {
        console.error(`[ACTION] Discord notification failed:`, err);
      }

      console.log(`[ACTION] Returning success response`);
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    if (intent === "upload-file") {
      const file = formData.get("file") as File;
      const fileId = formData.get("fileId") as string || crypto.randomUUID();
      const sectionId = formData.get("sectionId") as string;

      if (!file) {
        return new Response(JSON.stringify({ error: "ファイルがありません。" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }

      const key = `projects/${project.id}/${fileId}_${file.name}`;
      const buffer = await file.arrayBuffer();

      // 1. Upload to Cloudflare R2 BUCKET
      await bucket.put(key, buffer, {
        httpMetadata: { contentType: file.type }
      });

      const r2Url = `/api/assets?key=${encodeURIComponent(key)}`;
      const fileType = file.type.startsWith("image/") ? "image" : (file.type.startsWith("audio/") ? "audio" : "image");

      // 2. Insert record to files table
      await db.prepare(
        "INSERT INTO files (id, project_id, file_type, r2_url, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))"
      ).bind(fileId, project.id, fileType, r2Url, userId).run();

      // 3. Append to sections list in hearings.content_data
      const hearing = await db.prepare("SELECT id, content_data FROM hearings WHERE project_id = ?").bind(project.id).first();
      if (hearing && hearing.content_data) {
        const contentDataObj = JSON.parse(hearing.content_data as string);
        if (contentDataObj.sections) {
          contentDataObj.sections = contentDataObj.sections.map((s: any) => {
            if (s.id === sectionId) {
              const newFile = {
                id: fileId,
                url: r2Url,
                name: file.name,
                type: file.type,
                size: file.size,
                r2Key: key
              };
              return { ...s, files: [...(s.files || []), newFile] };
            }
            return s;
          });

          await db.prepare(
            "UPDATE hearings SET content_data = ?, updated_at = strftime('%s', 'now') WHERE id = ?"
          ).bind(JSON.stringify(contentDataObj), hearing.id).run();
        }
      }

      await db.prepare("UPDATE projects SET last_activity_at = strftime('%s', 'now') WHERE id = ?").bind(project.id).run();

      return new Response(JSON.stringify({ 
        success: true, 
        file: {
          id: fileId,
          url: r2Url,
          name: file.name,
          type: file.type,
          size: file.size,
          r2Key: key
        }
      }), { headers: { "Content-Type": "application/json" } });
    }

    if (intent === "delete-file") {
      const fileId = formData.get("fileId") as string;
      const sectionId = formData.get("sectionId") as string;

      if (!fileId) {
        return new Response(JSON.stringify({ error: "ファイルIDがありません。" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }

      const fileRecord = await db.prepare("SELECT * FROM files WHERE id = ?").bind(fileId).first();
      
      let r2Key = "";
      const hearing = await db.prepare("SELECT id, content_data FROM hearings WHERE project_id = ?").bind(project.id).first();
      if (hearing && hearing.content_data) {
        const contentDataObj = JSON.parse(hearing.content_data as string);
        if (contentDataObj.sections) {
          contentDataObj.sections = contentDataObj.sections.map((s: any) => {
            if (s.id === sectionId) {
              const fileToDelete = s.files?.find((f: any) => f.id === fileId);
              if (fileToDelete) {
                r2Key = fileToDelete.r2Key;
              }
              return { ...s, files: (s.files || []).filter((f: any) => f.id !== fileId) };
            }
            return s;
          });

          await db.prepare(
            "UPDATE hearings SET content_data = ?, updated_at = strftime('%s', 'now') WHERE id = ?"
          ).bind(JSON.stringify(contentDataObj), hearing.id).run();
        }
      }

      if (!r2Key && fileRecord) {
        const urlObj = new URL(fileRecord.r2_url, "http://localhost");
        r2Key = urlObj.searchParams.get("key") || "";
      }

      // Delete from R2
      if (r2Key) {
        await bucket.delete(r2Key);
      }

      // Delete from files table
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

export default function ContentHub() {
  const { initialSections, contentSubmitted } = useLoaderData<typeof loader>();
  const actionData = useActionData<{ success?: boolean }>();
  
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [activeSectionId, setActiveSectionId] = useState(initialSections[0]?.id || '1');
  const [isLoaded, setIsLoaded] = useState(true);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: number }>({});
  const [isDragging, setIsDragging] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-save debounced timer for textual changes
  useEffect(() => {
    if (!isLoaded || contentSubmitted) return;

    setSavingStatus('saving');
    const timer = setTimeout(async () => {
      try {
        const formData = new FormData();
        formData.append("intent", "save-text");
        formData.append("sections", JSON.stringify(sections));

        const response = await fetch("/api/content-hub", {
          method: "POST",
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const result = await response.json();
          if (result.success) {
            setSavingStatus('saved');
          } else {
            setSavingStatus('error');
          }
        } else {
          console.error("Received non-JSON response:", await response.text());
          throw new Error("サーバーから不正なレスポンスが返されました（JSONではありません）。");
        }
      } catch (e) {
        console.error('Auto-save error:', e);
        setSavingStatus('error');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [sections, isLoaded, contentSubmitted]);

  // Action result listener
  useEffect(() => {
    if (actionData?.success) {
      setIsEditing(false);
    }
  }, [actionData]);

  // Reset isEditing state when contentSubmitted shifts
  useEffect(() => {
    setIsEditing(false);
  }, [contentSubmitted]);

  const activeSection = sections.find(s => s.id === activeSectionId);

  const handleContentChange = (newContent: string) => {
    setSections(prev => prev.map(s => 
      s.id === activeSectionId ? { ...s, content: newContent } : s
    ));
  };

  const handleAddSection = () => {
    const newId = Date.now().toString();
    const newTitle = `新規項目 ${sections.length + 1}`;
    setSections([...sections, { id: newId, title: newTitle, content: '', files: [] }]);
    setActiveSectionId(newId);
  };

  const handleTitleChange = (newTitle: string) => {
    setSections(prev => prev.map(s => 
      s.id === activeSectionId ? { ...s, title: newTitle } : s
    ));
  };

  // Perform upload logic for multiple files
  const performUpload = async (filesArray: File[]) => {
    if (!activeSectionId) return;

    for (const file of filesArray) {
      if (file.size > 50 * 1024 * 1024) {
        alert(`ファイルサイズが大きすぎます（50MB以下にしてください）: ${file.name}`);
        continue;
      }

      const fileId = crypto.randomUUID();
      const uploadFormData = new FormData();
      uploadFormData.append("intent", "upload-file");
      uploadFormData.append("sectionId", activeSectionId);
      uploadFormData.append("fileId", fileId);
      uploadFormData.append("file", file);

      setUploadingFiles(prev => ({ ...prev, [fileId]: 50 }));

      try {
        const response = await fetch("/api/content-hub", {
          method: "POST",
          body: uploadFormData
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const contentType = response.headers.get("content-type");
        if (!contentType || contentType.indexOf("application/json") === -1) {
          console.error("Received non-JSON response:", await response.text());
          throw new Error("サーバーから不正なレスポンスが返されました。");
        }

        const result = await response.json();
        
        if (result.success && result.file) {
          setSections(prev => prev.map(s => {
            if (s.id === activeSectionId) {
              return { ...s, files: [...(s.files || []), result.file] };
            }
            return s;
          }));
        } else {
          alert(`ファイルのアップロードに失敗しました: ${result.error || file.name}`);
        }
      } catch (e) {
        console.error("Upload error:", e);
        alert(`ファイルのアップロードに失敗しました: ${file.name}`);
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
    e.target.value = '';
    await performUpload(filesArray);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!e.dataTransfer.files || !e.dataTransfer.files.length) return;
    const filesArray = Array.from(e.dataTransfer.files);
    await performUpload(filesArray);
  };
  
  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!confirm(`「${fileName}」を削除してもよろしいですか？`)) return;
    
    try {
      const deleteFormData = new FormData();
      deleteFormData.append("intent", "delete-file");
      deleteFormData.append("sectionId", activeSectionId);
      deleteFormData.append("fileId", fileId);

      const response = await fetch("/api/content-hub", {
        method: "POST",
        body: deleteFormData
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const contentType = response.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
        throw new Error("サーバーから不正なレスポンスが返されました。");
      }
      
      const result = await response.json();

      if (result.success) {
        setSections(prev => prev.map(s => {
          if (s.id === activeSectionId) {
            return { ...s, files: (s.files || []).filter(f => f.id !== fileId) };
          }
          return s;
        }));
      } else {
        alert(`ファイルの削除に失敗しました: ${result.error}`);
      }
    } catch (e) {
      console.error("Delete file error:", e);
      alert("ファイル削除中にエラーが発生しました。");
    }
  };

  const handleSaveImmediately = async () => {
    setSavingStatus('saving');
    try {
      const saveFormData = new FormData();
      saveFormData.append("intent", "save-text");
      saveFormData.append("sections", JSON.stringify(sections));

      const response = await fetch("/api/content-hub", {
        method: "POST",
        body: saveFormData
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const contentType = response.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
        throw new Error("サーバーから不正なレスポンスが返されました。");
      }
      
      const result = await response.json();

      if (result.success) {
        setSavingStatus('saved');
      } else {
        setSavingStatus('error');
        alert('保存に失敗しました。');
      }
    } catch (e) {
      console.error('Save error:', e);
      setSavingStatus('error');
      alert('保存に失敗しました。');
    }
  };

  const handleSubmitContent = async () => {
    if (!confirm("原稿を最終提出してよろしいですか？（提出後もいつでも内容の確認や再編集が可能です）")) return;
    setIsSubmitting(true);
    try {
      const submitFormData = new FormData();
      submitFormData.append("intent", "submit-content");
      submitFormData.append("sections", JSON.stringify(sections));

      const response = await fetch("/api/content-hub", {
        method: "POST",
        body: submitFormData
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error("Submit error text:", text);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
        const text = await response.text();
        console.error("Received non-JSON response:", text);
        throw new Error("サーバーからHTMLが返されました（認証切れ等の可能性があります）。");
      }

      const result = await response.json();

      if (result.success) {
        setIsEditing(false);
        // リロードしてデータを再検証
        window.location.reload();
      } else {
        alert(`送信に失敗しました: ${result.error}`);
      }
    } catch (e) {
      console.error("Submit content error:", e);
      alert("提出処理中にエラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render final submission completed panel
  if (contentSubmitted && !isEditing) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
        <header style={{ marginBottom: '3rem' }}>
          <h2 className="font-mincho" style={{ fontSize: '2rem', fontWeight: 500, marginBottom: '0.8rem', color: 'var(--text-color)', letterSpacing: '0.05em' }}>
            原稿ご提出
          </h2>
        </header>
        <div className="neumorphic-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h2 className="font-mincho" style={{ fontSize: '1.8rem', marginBottom: '1.5rem', color: 'var(--accent-color)' }}>
            原稿ご提出完了
          </h2>
          <p className="font-gothic" style={{ opacity: 0.8, lineHeight: '1.8', marginBottom: '2.5rem' }}>
            原稿のご提出ありがとうございました。<br />
            ご提出いただいた内容を確認の上、制作スタッフがWebサイトの構築を進めさせていただきます。<br />
            内容の確認や変更がある場合は、下記のボタンよりいつでも編集可能です。
          </p>
          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link 
              to="/client/dashboard" 
              style={{ 
                textDecoration: 'none',
                background: 'var(--accent-color)',
                color: 'var(--bg-color)',
                padding: '0.8rem 2.2rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                fontFamily: 'var(--font-gothic)',
                boxShadow: '0 4px 15px rgba(184, 156, 109, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease'
              }}
            >
              ダッシュボードへ戻る
            </Link>
            <button 
              onClick={() => setIsEditing(true)}
              style={{ 
                background: 'transparent',
                border: '1px solid rgba(184, 156, 109, 0.4)',
                color: 'var(--accent-color)',
                padding: '0.8rem 2.2rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 500,
                fontFamily: 'var(--font-gothic)',
                cursor: 'pointer',
                boxShadow: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease',
                minWidth: 'auto',
                minHeight: 'auto'
              }}
            >
              提出した原稿を再編集する
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', paddingRight: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h2 className="font-mincho" style={{ fontSize: '1.8rem', fontWeight: 500, marginBottom: '0.6rem' }}>原稿ご提出ボード</h2>
        <p className="font-gothic" style={{ opacity: 0.7, letterSpacing: '0.05em', fontSize: '0.85rem', lineHeight: '1.5' }}>
          ウェブサイトに掲載する文章の作成・ご提出をお願いいたします。<br />
          セクションはご自由に増やすことができますので、必要に応じて項目を追加してください。
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem' }}>
        
        {/* Navigation Sidebar */}
        <div className="neumorphic-panel" style={{ padding: '1.2rem 1rem', height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingLeft: '0.3rem' }}>
            <h3 className="font-mincho" style={{ fontSize: '0.95rem', margin: 0 }}>構成一覧</h3>
          </div>
          
          <ul className="font-gothic" style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {sections.map(sec => (
              <li 
                key={sec.id}
                onClick={() => setActiveSectionId(sec.id)}
                style={{ 
                  padding: '0.6rem 1rem', 
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: activeSectionId === sec.id ? 500 : 400,
                  color: activeSectionId === sec.id ? 'var(--accent-color)' : 'var(--text-color)',
                  boxShadow: activeSectionId === sec.id ? 'var(--shadow-in)' : 'none',
                  border: activeSectionId === sec.id ? 'var(--neu-border)' : '1px solid transparent',
                  transition: 'var(--transition-smooth)',
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {sec.title}
              </li>
            ))}
          </ul>

          <button 
            onClick={handleAddSection}
            style={{ width: '100%', padding: '0.6rem', fontSize: '0.8rem', background: 'transparent', boxShadow: 'var(--shadow-out)', border: 'var(--neu-border)' }}
          >
            新規セクションを追加
          </button>
        </div>

        {/* Editor Area */}
        <div className="neumorphic-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <input 
              type="text" 
              value={activeSection?.title || ''}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="font-mincho"
              style={{ 
                fontSize: '1.25rem', 
                fontWeight: 600, 
                border: 'none', 
                background: 'transparent',
                boxShadow: 'none',
                padding: '0.3rem',
                borderBottom: '1px dashed var(--neu-border)',
                borderRadius: 0,
                color: 'var(--text-color)',
                width: '70%'
              }}
              placeholder="セクション名"
            />
            
            <span className="font-gothic" style={{ fontSize: '0.75rem', opacity: 0.6, letterSpacing: '0.05em', marginTop: '0.5rem', transition: 'var(--transition-smooth)' }}>
              {savingStatus === 'idle' && 'すべての変更は保存されています'}
              {savingStatus === 'saving' && '自動保存中...'}
              {savingStatus === 'saved' && '変更が保存されました'}
              {savingStatus === 'error' && '自動保存に失敗しました'}
            </span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <textarea 
              value={activeSection?.content || ''}
              onChange={e => handleContentChange(e.target.value)}
              placeholder={`ここに ${activeSection?.title || 'テキスト'} の内容をご記入ください。ドラッグ＆ドロップでこの領域に直接ファイルをアップロードできます。`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{ 
                minHeight: '280px', 
                width: '100%',
                resize: 'vertical',
                padding: '1rem',
                border: isDragging ? '2px dashed var(--accent-color)' : '1px solid var(--neu-border)',
                backgroundColor: isDragging ? 'rgba(184, 156, 109, 0.05)' : 'transparent',
                transition: 'all 0.2s ease',
                fontSize: '0.95rem',
                lineHeight: '1.6'
              }}
            />

            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{ 
                padding: '1.2rem', 
                border: isDragging ? '2px dashed var(--accent-color)' : '1px dashed var(--neu-border)', 
                borderRadius: '12px', 
                background: isDragging ? 'rgba(184, 156, 109, 0.05)' : 'var(--bg-color)',
                transition: 'all 0.2s ease',
                textAlign: 'center'
              }}
            >
              <h4 className="font-mincho" style={{ fontSize: '0.95rem', marginBottom: '0.5rem', marginTop: 0 }}>参考資料・画像</h4>
              <p className="font-gothic" style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '1rem', lineHeight: '1.4' }}>
                画像やPDFなどの資料をここにドラッグ＆ドロップするか、ファイルを選択してください。
              </p>
              
              <div style={{ marginBottom: '2rem' }}>
                <input 
                  type="file" 
                  id={`file-upload-${activeSectionId}`}
                  multiple 
                  onChange={handleFileUpload} 
                  style={{ display: 'none' }} 
                />
                <label 
                  htmlFor={`file-upload-${activeSectionId}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', padding: '0.8rem 2rem',
                    background: 'var(--accent-color)', color: '#fff', borderRadius: '40px',
                    cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, boxShadow: '0 4px 10px rgba(184, 156, 109, 0.3)',
                    transition: 'var(--transition-smooth)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  ファイルを選択
                </label>
              </div>

              {/* Uploading File Progress Bar */}
              {Object.entries(uploadingFiles).map(([id, progress]) => (
                <div key={id} style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                    <span>アップロード中...</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="neu-progress-track" style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div className="neu-progress-fill" style={{ width: `${progress}%`, height: '100%', background: 'var(--accent-color)' }} />
                  </div>
                </div>
              ))}

              {/* Uploaded File Grid */}
              {(activeSection?.files?.length ?? 0) > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', textAlign: 'left', marginTop: '1.5rem' }}>
                  {activeSection!.files!.map(file => (
                    <div key={file.id} style={{
                      padding: '1rem', border: 'var(--neu-border)', borderRadius: '12px',
                      background: 'var(--bg-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem',
                      boxShadow: 'var(--shadow-out)', position: 'relative', overflow: 'hidden'
                    }}>
                      <button 
                        onClick={() => handleDeleteFile(file.id, file.name)}
                        style={{
                          position: 'absolute', top: '0.5rem', right: '0.5rem', width: '20px', height: '20px',
                          padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '10px',
                          zIndex: 10
                        }}
                      >
                        x
                      </button>
                      
                      {file.type.startsWith('image/') ? (
                        <div style={{ width: '100%', height: '120px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
                          <img src={file.url} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div style={{ 
                          width: '100%', height: '120px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-muted)'
                        }}>
                          <div style={{ fontWeight: 600, fontSize: '1.2rem', marginBottom: '0.2rem' }}>FILE</div>
                          <div>{file.name.split('.').pop()?.toUpperCase()}</div>
                        </div>
                      )}
                      
                      <a href={file.url} target="_blank" rel="noopener noreferrer" style={{
                        fontSize: '0.8rem', color: 'var(--text-color)', textDecoration: 'none', 
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', marginTop: '0.5rem',
                        borderBottom: '1px solid transparent'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.borderBottom = '1px solid var(--text-color)'}
                      onMouseOut={(e) => e.currentTarget.style.borderBottom = '1px solid transparent'}
                      >
                        {file.name}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.2rem' }}>
            <button 
              onClick={handleSaveImmediately}
              style={{ 
                padding: '0.8rem 2rem', 
                background: 'transparent', 
                border: '1px solid var(--neu-border)',
                color: 'var(--text-color)',
                borderRadius: '8px',
                opacity: savingStatus === 'saving' ? 0.7 : 1,
                cursor: savingStatus === 'saving' ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '0.85rem'
              }}
              disabled={savingStatus === 'saving'}
            >
              下書き保存
            </button>
            <button 
              onClick={handleSubmitContent}
              disabled={isSubmitting}
              style={{ 
                padding: '0.8rem 2.5rem', 
                background: 'var(--accent-color)', 
                color: 'var(--bg-color)',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 4px 10px rgba(184, 156, 109, 0.25)',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              {isSubmitting ? '提出中...' : '原稿を最終提出する'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
