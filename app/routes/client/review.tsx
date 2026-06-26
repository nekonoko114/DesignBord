import { useState, useRef, useEffect } from 'react';
import { useLoaderData, useSubmit } from 'react-router';
import type { Route } from './+types/review';
import { requireUserRole } from '../../utils/auth.server';
import { sendDiscordNotification } from '../../utils/discord.server';

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
  const { context, request } = args;
  const { userId } = await requireUserRole(args, ["client"]);
  const db = (context as any).cloudflare.env.DB;

  let designs: Design[] = [];
  let comments: Comment[] = [];

  try {
    const project = await db.prepare("SELECT id FROM projects WHERE client_id = ?").bind(userId).first();
    if (project) {
      // Get reviewable files (images and design comps)
      const fileRecords = await db.prepare(
        "SELECT id, file_type, r2_url, created_at FROM files WHERE project_id = ? AND file_type IN ('image', 'design_comp') ORDER BY created_at DESC"
      ).bind(project.id).all();

      designs = (fileRecords.results || []).map((file: any) => ({
        id: file.id,
        title: file.file_type === 'design_comp' ? 'デザインカンプ' : '参考画像',
        imageUrl: file.r2_url,
        createdAt: file.created_at
      }));

      if (designs.length > 0) {
        // Load annotations for the first/active design by default
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
    }
  } catch (e) {
    console.error("Failed to load design review data:", e);
  }

  return {
    designs,
    initialComments: comments,
  };
}

export async function action(args: Route.ActionArgs) {
  const { context, request } = args;
  const { userId } = await requireUserRole(args, ["client"]);
  const db = (context as any).cloudflare.env.DB;

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    const project = await db.prepare("SELECT id, title FROM projects WHERE client_id = ?").bind(userId).first();
    if (!project) {
      return new Response(JSON.stringify({ error: "プロジェクトが見つかりません。" }), { status: 404 });
    }

    if (intent === "add-annotation") {
      const fileId = formData.get("fileId") as string;
      const posX = parseFloat(formData.get("posX") as string);
      const posY = parseFloat(formData.get("posY") as string);
      const commentText = formData.get("comment") as string;

      if (!fileId || isNaN(posX) || isNaN(posY) || !commentText) {
        return new Response(JSON.stringify({ error: "入力パラメータが不正です。" }), { status: 400 });
      }

      const annotationId = crypto.randomUUID();
      await db.prepare(
        "INSERT INTO annotations (id, file_id, user_id, pos_x, pos_y, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))"
      ).bind(annotationId, fileId, userId, posX, posY, commentText).run();

      // Update last activity timestamp
      await db.prepare("UPDATE projects SET last_activity_at = strftime('%s', 'now') WHERE id = ?").bind(project.id).run();

      // Dispatch Discord notification
      const env = (context as any).cloudflare.env;
      await sendDiscordNotification(env, {
        title: "コメント追加のお知らせ",
        description: `クライアント様がデザインにフィードバック（アノテーション）を追加しました。`,
        fields: [
          { name: "プロジェクト名", value: project.title as string, inline: true },
          { name: "コメント内容", value: commentText, inline: false },
          { name: "ピン位置", value: `X: ${posX.toFixed(1)}%, Y: ${posY.toFixed(1)}%`, inline: true }
        ],
        color: 12098669, // #b89c6d (ゴールド)
      });

      return new Response(JSON.stringify({ success: true }));
    }

    if (intent === "resolve-annotation") {
      const annotationId = formData.get("annotationId") as string;
      if (!annotationId) {
        return new Response(JSON.stringify({ error: "アノテーションIDがありません。" }), { status: 400 });
      }

      // Delete/Resolve annotation
      await db.prepare("DELETE FROM annotations WHERE id = ?").bind(annotationId).run();
      await db.prepare("UPDATE projects SET last_activity_at = strftime('%s', 'now') WHERE id = ?").bind(project.id).run();

      return new Response(JSON.stringify({ success: true }));
    }

    return new Response(JSON.stringify({ error: "無効なリクエストです。" }), { status: 400 });
  } catch (e) {
    console.error("Action handler error in review:", e);
    return new Response(JSON.stringify({ error: "サーバー処理中にエラーが発生しました。" }), { status: 500 });
  }
}

export default function ClientReview() {
  const { designs, initialComments } = useLoaderData<typeof loader>();
  const [activeDesignId, setActiveDesignId] = useState<string | null>(designs[0]?.id || null);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  
  const [newCommentPos, setNewCommentPos] = useState<{ x: number, y: number } | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const submit = useSubmit();

  const handleDesignChange = async (designId: string) => {
    setActiveDesignId(designId);
    setNewCommentPos(null);
    try {
      const formData = new FormData();
      formData.append("intent", "revalidate");
      submit(formData, { method: "post" });
    } catch (e) {
      console.error(e);
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
    if (!activeDesignId || !newCommentPos || !newCommentText.trim()) return;
    setIsSubmitting(true);
    
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
    } catch (e) {
      console.error(e);
      alert("通信エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
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
    } catch (e) {
      console.error(e);
      alert("通信エラーが発生しました。");
    }
  };

  const activeDesign = designs.find(d => d.id === activeDesignId);

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  if (designs.length === 0) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center', padding: '4rem 0' }}>
        <h2 className="font-mincho" style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>デザインは準備中です</h2>
        <p style={{ opacity: 0.7 }}>
          現在、デザインを作成中です。デザインが提出されるとこちらに表示され、画像をクリックして修正指示などのコメントを残すことができるようになります。
        </p>
      </div>
    );
  }

  const watermarkText = "DesignBoard PROTOTYPE - DO NOT COPY";

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 8rem)' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h2 className="font-mincho" style={{ fontSize: '2.5rem', fontWeight: 500, marginBottom: '0.5rem' }}>デザインレビュー</h2>
        <p className="font-gothic" style={{ opacity: 0.7, letterSpacing: '0.05em' }}>
          画像をクリックしてピンを立て、修正指示などのコメントを残すことができます。
        </p>
      </header>

      <div style={{ display: 'flex', gap: '2rem', flex: 1, minHeight: 0 }}>
        {/* Left: Design Preview */}
        <div className="neumorphic-panel" style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Design Switch Tabs */}
          <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', borderBottom: 'var(--neu-border)', marginBottom: '1rem' }}>
            {designs.map(design => (
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
            ))}
          </div>

          <div style={{ position: 'relative', flex: 1, overflow: 'auto', background: 'var(--neumorphic-dark)', borderRadius: '12px', display: 'flex', justifyContent: 'center' }}>
            {activeDesign && (
              <div 
                style={{ 
                  position: 'relative', 
                  display: 'inline-block', 
                  height: 'max-content',
                  userSelect: 'none',
                  WebkitUserSelect: 'none'
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                <img 
                  ref={imageRef}
                  src={activeDesign.imageUrl} 
                  alt={activeDesign.title} 
                  draggable={false}
                  style={{ 
                    display: 'block', 
                    maxWidth: '100%', 
                    cursor: 'crosshair', 
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    pointerEvents: 'auto',
                  }}
                  onClick={handleImageClick}
                />
                
                {/* Watermark Overlay */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  pointerEvents: 'none',
                  overflow: 'hidden',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gridTemplateRows: 'repeat(6, 1fr)',
                  gap: '1rem',
                  opacity: 0.07,
                  zIndex: 5
                }}>
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div 
                      key={i} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: 'rotate(-30deg)',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        color: 'var(--text-color)',
                        whiteSpace: 'nowrap',
                        fontFamily: 'var(--font-gothic)'
                      }}
                    >
                      {watermarkText}
                    </div>
                  ))}
                </div>
                
                {/* Active Annotation Pins */}
                {comments.map((comment, i) => (
                  <div 
                    key={comment.id}
                    style={{
                      position: 'absolute',
                      left: `${comment.x}%`,
                      top: `${comment.y}%`,
                      transform: 'translate(-50%, -100%)',
                      background: comment.authorRole === 'client' ? 'var(--accent-color)' : '#28a745',
                      color: '#fff',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50% 50% 50% 0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 'bold',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                      zIndex: 10,
                      cursor: 'pointer',
                      border: '2px solid #fff'
                    }}
                  >
                    {i + 1}
                  </div>
                ))}

                {/* New Temporary Pin */}
                {newCommentPos && (
                  <div style={{
                    position: 'absolute',
                    left: `${newCommentPos.x}%`,
                    top: `${newCommentPos.y}%`,
                    transform: 'translate(-50%, -100%)',
                    background: 'var(--text-color)',
                    color: 'var(--bg-color)',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50% 50% 50% 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 'bold',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                    zIndex: 20,
                    border: '2px solid var(--bg-color)',
                    animation: 'pulse 1s infinite alternate'
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
                <p>画像をクリックして<br/>コメントを追加できます</p>
              </div>
            )}

            {comments.map((comment, i) => (
              <div key={comment.id} style={{ 
                padding: '1rem', 
                borderRadius: '12px', 
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
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{comment.authorRole === 'client' ? 'あなた' : 'デザインチーム'}</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.9rem', margin: 0, whiteSpace: 'pre-wrap' }}>{comment.text}</p>
                {comment.authorRole === 'admin' && (
                  <div style={{ marginTop: '0.8rem', textAlign: 'right' }}>
                    <button 
                      onClick={() => handleResolveComment(comment.id)}
                      style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--text-color)', color: 'var(--text-color)' }}
                    >
                      解決済みにする
                    </button>
                  </div>
                )}
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
                placeholder="修正指示を入力してください..."
                autoFocus
                style={{ 
                  width: '100%', minHeight: '80px', padding: '0.8rem', fontSize: '0.9rem', 
                  background: 'var(--bg-color)', border: 'none', borderRadius: '8px',
                  marginBottom: '1rem', resize: 'vertical', color: 'var(--text-color)'
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => setNewCommentPos(null)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'transparent', boxShadow: 'none', border: 'var(--neu-border)' }}
                >
                  キャンセル
                </button>
                <button 
                  onClick={handleAddComment}
                  disabled={!newCommentText.trim() || isSubmitting}
                  style={{ 
                    padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'var(--accent-color)', 
                    color: '#fff', border: 'none', opacity: (newCommentText.trim() && !isSubmitting) ? 1 : 0.5,
                    cursor: (newCommentText.trim() && !isSubmitting) ? 'pointer' : 'not-allowed'
                  }}
                >
                  {isSubmitting ? '送信中...' : '送信'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes pulse {
          0% { transform: translate(-50%, -100%) scale(1); }
          100% { transform: translate(-50%, -100%) scale(1.15); }
        }
      `}</style>
    </div>
  );
}
