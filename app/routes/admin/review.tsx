import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLoaderData, useSubmit } from 'react-router';
import type { Route } from './+types/review';
import { requireUserRole } from '../../utils/auth.server';

interface Design {
  id: string;
  title: string;
  imageUrl: string;
  createdAt: number;
}

interface Comment {
  id: string;
  fileId: string;
  userId: string;
  x: number;
  y: number;
  text: string;
  authorRole: 'client' | 'admin';
  authorEmail: string;
  createdAt: number;
}

export async function loader(args: Route.LoaderArgs) {
  const { context, params, request } = args;
  await requireUserRole(args, ["admin"]);
  const db = (context as any).cloudflare.env.DB;
  const { id: projectId } = params;

  let designs: Design[] = [];
  let comments: Comment[] = [];

  try {
    // Load designs for this project
    const fileRecords = await db.prepare(
      "SELECT id, file_type, r2_url, created_at FROM files WHERE project_id = ? AND file_type IN ('image', 'design_comp') ORDER BY created_at DESC"
    ).bind(projectId).all();

    designs = (fileRecords.results || []).map((file: any) => ({
      id: file.id,
      title: file.file_type === 'design_comp' ? 'デザインカンプ' : '画像アセット',
      imageUrl: file.r2_url,
      createdAt: file.created_at
    }));

    if (designs.length > 0) {
      // Load annotations for the first design by default
      const activeFileId = designs[0].id;
      const annotationRecords = await db.prepare(`
        SELECT a.id, a.file_id, a.user_id, a.pos_x, a.pos_y, a.comment, a.created_at, u.role, u.email
        FROM annotations a
        JOIN users u ON a.user_id = u.id
        WHERE a.file_id = ?
        ORDER BY a.created_at ASC
      `).bind(activeFileId).all();

      comments = (annotationRecords.results || []).map((ann: any) => ({
        id: ann.id,
        fileId: ann.file_id,
        userId: ann.user_id,
        x: ann.pos_x,
        y: ann.pos_y,
        text: ann.comment,
        authorRole: ann.role,
        authorEmail: ann.email,
        createdAt: ann.created_at
      }));
    }
  } catch (e) {
    console.error("Failed to load admin design review data:", e);
  }

  return {
    designs,
    initialComments: comments,
  };
}

export async function action(args: Route.ActionArgs) {
  const { context, params, request } = args;
  const { userId } = await requireUserRole(args, ["admin"]);
  const db = (context as any).cloudflare.env.DB;
  const bucket = (context as any).cloudflare.env.BUCKET;
  const { id: projectId } = params;

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "upload-design") {
      const file = formData.get("file") as File;
      const title = formData.get("title") as string || file.name;

      if (!file) {
        return new Response(JSON.stringify({ error: "ファイルがありません。" }), { status: 400 });
      }

      const fileId = crypto.randomUUID();
      const key = `projects/${projectId}/${fileId}_${file.name}`;
      const buffer = await file.arrayBuffer();

      // 1. Upload design asset to R2
      await bucket.put(key, buffer, {
        httpMetadata: { contentType: file.type }
      });

      const r2Url = `/api/assets?key=${encodeURIComponent(key)}`;

      // 2. Insert to files table as 'design_comp'
      await db.prepare(
        "INSERT INTO files (id, project_id, file_type, r2_url, uploaded_by, created_at) VALUES (?, ?, 'design_comp', ?, ?, strftime('%s', 'now'))"
      ).bind(fileId, projectId, r2Url, userId).run();

      await db.prepare("UPDATE projects SET last_activity_at = strftime('%s', 'now') WHERE id = ?").bind(projectId).run();

      return new Response(JSON.stringify({ success: true }));
    }

    if (intent === "add-annotation") {
      const fileId = formData.get("fileId") as string;
      const posX = parseFloat(formData.get("posX") as string);
      const posY = parseFloat(formData.get("posY") as string);
      const commentText = formData.get("comment") as string;

      if (!fileId || isNaN(posX) || isNaN(posY) || !commentText) {
        return new Response(JSON.stringify({ error: "パラメータが不正です。" }), { status: 400 });
      }

      const annotationId = crypto.randomUUID();
      await db.prepare(
        "INSERT INTO annotations (id, file_id, user_id, pos_x, pos_y, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))"
      ).bind(annotationId, fileId, userId, posX, posY, commentText).run();

      await db.prepare("UPDATE projects SET last_activity_at = strftime('%s', 'now') WHERE id = ?").bind(projectId).run();

      return new Response(JSON.stringify({ success: true }));
    }

    if (intent === "resolve-annotation") {
      const annotationId = formData.get("annotationId") as string;
      if (!annotationId) {
        return new Response(JSON.stringify({ error: "アノテーションIDがありません。" }), { status: 400 });
      }

      await db.prepare("DELETE FROM annotations WHERE id = ?").bind(annotationId).run();
      await db.prepare("UPDATE projects SET last_activity_at = strftime('%s', 'now') WHERE id = ?").bind(projectId).run();

      return new Response(JSON.stringify({ success: true }));
    }

    return new Response(JSON.stringify({ error: "無効なリクエストです。" }), { status: 400 });
  } catch (e) {
    console.error("Admin review action error:", e);
    return new Response(JSON.stringify({ error: "サーバーエラーが発生しました。" }), { status: 500 });
  }
}

export default function AdminReview() {
  const { id } = useParams();
  const { designs, initialComments } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  
  const [activeDesignId, setActiveDesignId] = useState<string | null>(designs[0]?.id || null);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  
  const [newCommentPos, setNewCommentPos] = useState<{ x: number, y: number } | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const imageRef = useRef<HTMLImageElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleDesignChange = async (designId: string) => {
    setActiveDesignId(designId);
    setNewCommentPos(null);
    const formData = new FormData();
    formData.append("intent", "revalidate");
    submit(formData, { method: "post" });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length || !id) return;
    
    const file = e.target.files[0];
    const designTitle = prompt('デザインの名前を入力してください（例：トップページ案A）', file.name);
    if (!designTitle) return;

    setUploading(true);
    setUploadProgress(50);

    const formData = new FormData();
    formData.append("intent", "upload-design");
    formData.append("title", designTitle);
    formData.append("file", file);

    try {
      const response = await fetch(window.location.pathname, {
        method: "POST",
        body: formData
      });
      const result = await response.json();
      if (result.success) {
        submit(null, { method: "get" });
      } else {
        alert("アップロードに失敗しました。");
      }
    } catch (err) {
      console.error(err);
      alert("アップロード中にエラーが発生しました。");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setNewCommentPos({ x, y });
    setNewCommentText('');
  };

  const handleAddComment = async () => {
    if (!id || !activeDesignId || !newCommentPos || !newCommentText.trim()) return;
    
    try {
      const formData = new FormData();
      formData.append("intent", "add-annotation");
      formData.append("fileId", activeDesignId);
      formData.append("posX", newCommentPos.x.toString());
      formData.append("posY", newCommentPos.y.toString());
      formData.append("comment", newCommentText);

      const response = await fetch(window.location.pathname, {
        method: "POST",
        body: formData
      });
      const result = await response.json();

      if (result.success) {
        setNewCommentPos(null);
        setNewCommentText('');
        submit(null, { method: "get" });
      } else {
        alert("コメントの追加に失敗しました。");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveComment = async (commentId: string) => {
    try {
      const formData = new FormData();
      formData.append("intent", "resolve-annotation");
      formData.append("annotationId", commentId);

      const response = await fetch(window.location.pathname, {
        method: "POST",
        body: formData
      });
      const result = await response.json();

      if (result.success) {
        setComments(prev => prev.filter(c => c.id !== commentId));
      } else {
        alert("コメントの解決処理に失敗しました。");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const activeDesign = designs.find(d => d.id === activeDesignId);

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 6rem)' }}>
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button onClick={() => navigate(`/admin/project/${id}`)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }} className="font-gothic">
            戻る
          </button>
          <h2 className="font-mincho" style={{ fontSize: '2rem', fontWeight: 500, margin: 0 }}>デザインレビュー管理</h2>
        </div>
        
        <div>
          <input type="file" id="design-upload" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
          <label htmlFor="design-upload" style={{
            display: 'inline-flex', alignItems: 'center', padding: '0.8rem 1.5rem', background: 'var(--accent-color)', color: '#fff', borderRadius: '40px',
            cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, boxShadow: '0 4px 10px rgba(184, 156, 109, 0.3)'
          }}>
            {uploading ? `アップロード中... ${Math.round(uploadProgress)}%` : '新規デザインをアップロード'}
          </label>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '2rem', flex: 1, minHeight: 0 }}>
        {/* Left: Design Preview */}
        <div className="neumorphic-panel" style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', borderBottom: 'var(--neu-border)', marginBottom: '1rem' }}>
            {designs.length === 0 ? (
              <span className="font-gothic" style={{ opacity: 0.5, fontSize: '0.9rem' }}>デザインがまだアップロードされていません。</span>
            ) : (
              designs.map(design => (
                <button 
                  key={design.id}
                  onClick={() => handleDesignChange(design.id)}
                  style={{ 
                    padding: '0.5rem 1.5rem', borderRadius: '40px', fontSize: '0.9rem', whiteSpace: 'nowrap',
                    background: activeDesignId === design.id ? 'var(--accent-color)' : 'transparent',
                    color: activeDesignId === design.id ? '#fff' : 'var(--text-color)',
                    boxShadow: activeDesignId === design.id ? '0 4px 10px rgba(184, 156, 109, 0.3)' : 'none',
                    border: activeDesignId === design.id ? 'none' : 'var(--neu-border)'
                  }}
                >
                  {design.title}
                </button>
              ))
            )}
          </div>

          <div style={{ position: 'relative', flex: 1, overflow: 'auto', background: 'var(--neumorphic-dark)', borderRadius: '12px', display: 'flex', justifyContent: 'center' }}>
            {activeDesign && (
              <div style={{ position: 'relative', display: 'inline-block', height: 'max-content' }}>
                <img 
                  ref={imageRef}
                  src={activeDesign.imageUrl} 
                  alt={activeDesign.title} 
                  style={{ display: 'block', maxWidth: '100%', cursor: 'crosshair', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  onClick={handleImageClick}
                />
                
                {comments.map((comment, i) => (
                  <div key={comment.id} style={{
                    position: 'absolute', left: `${comment.x}%`, top: `${comment.y}%`, transform: 'translate(-50%, -100%)',
                    background: comment.authorRole === 'client' ? 'var(--accent-color)' : '#28a745',
                    color: '#fff', width: '24px', height: '24px', borderRadius: '50% 50% 50% 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)', zIndex: 10, cursor: 'pointer', border: '2px solid #fff'
                  }}>
                    {i + 1}
                  </div>
                ))}

                {newCommentPos && (
                  <div style={{
                    position: 'absolute', left: `${newCommentPos.x}%`, top: `${newCommentPos.y}%`, transform: 'translate(-50%, -100%)',
                    background: 'var(--text-color)', color: 'var(--bg-color)', width: '24px', height: '24px', borderRadius: '50% 50% 50% 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.5)', zIndex: 20, border: '2px solid var(--bg-color)', animation: 'pulse 1s infinite alternate'
                  }}>
                    +
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Comments List Sidebar */}
        <div className="neumorphic-panel" style={{ width: '350px', padding: '1.5rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <h3 className="font-mincho" style={{ fontSize: '1.2rem', marginBottom: '1.5rem', borderBottom: 'var(--neu-border)', paddingBottom: '1rem' }}>コメント・修正指示</h3>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem' }}>
            {comments.length === 0 && !newCommentPos && (
              <div style={{ textAlign: 'center', opacity: 0.5, marginTop: '2rem' }}>
                <p>コメントはまだありません</p>
              </div>
            )}

            {comments.map((comment, i) => (
              <div key={comment.id} style={{ 
                padding: '1rem', borderRadius: '12px', 
                background: 'var(--bg-color)',
                border: 'var(--neu-border)',
                boxShadow: 'var(--shadow-out)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ 
                      display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%', 
                      background: comment.authorRole === 'client' ? 'var(--accent-color)' : '#28a745',
                      color: '#fff', fontSize: '10px', textAlign: 'center', lineHeight: '20px', fontWeight: 'bold'
                    }}>{i + 1}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{comment.authorRole === 'admin' ? 'あなた' : 'クライアント'}</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.9rem', margin: 0, whiteSpace: 'pre-wrap' }}>{comment.text}</p>
                <div style={{ marginTop: '0.8rem', textAlign: 'right' }}>
                  <button 
                    onClick={() => handleResolveComment(comment.id)}
                    style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--text-color)', color: 'var(--text-color)' }}
                  >
                    対応完了（解決済みにする）
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* New Comment Input Form */}
          {newCommentPos && (
            <div style={{ 
              marginTop: '1rem', padding: '1.2rem', background: 'var(--neumorphic-dark)', 
              borderRadius: '12px', boxShadow: 'var(--shadow-in)', border: '1px solid var(--accent-color)'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '0.5rem' }}>新規コメント（ピン配置中）</div>
              <textarea 
                value={newCommentText}
                onChange={e => setNewCommentText(e.target.value)}
                placeholder="クライアントへの返信などを入力..."
                autoFocus
                style={{ 
                  width: '100%', minHeight: '80px', padding: '0.8rem', fontSize: '0.9rem', 
                  background: 'var(--bg-color)', border: 'none', borderRadius: '8px',
                  marginBottom: '1rem', resize: 'vertical', color: 'var(--text-color)'
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setNewCommentPos(null)} style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'transparent', boxShadow: 'none', border: 'var(--neu-border)' }}>
                  キャンセル
                </button>
                <button onClick={handleAddComment} disabled={!newCommentText.trim()} style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'var(--accent-color)', color: '#fff', border: 'none', opacity: newCommentText.trim() ? 1 : 0.5 }}>
                  送信
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
