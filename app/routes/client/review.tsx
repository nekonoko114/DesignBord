import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, doc, onSnapshot, setDoc, serverTimestamp, query, orderBy, updateDoc } from 'firebase/firestore';

interface Design {
  id: string;
  title: string;
  imageUrl: string;
  createdAt: any;
}

interface Comment {
  id: string;
  x: number;
  y: number;
  text: string;
  author: 'client' | 'admin';
  createdAt: any;
  resolved: boolean;
}

export default function ClientReview() {
  const { currentUser } = useAuth();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [activeDesignId, setActiveDesignId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newCommentPos, setNewCommentPos] = useState<{ x: number, y: number } | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const imageRef = useRef<HTMLImageElement>(null);

  // デザイン一覧の取得
  useEffect(() => {
    if (!currentUser) return;
    
    const designsRef = collection(db, 'projects', currentUser.uid, 'designs');
    const q = query(designsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedDesigns: Design[] = [];
      snapshot.forEach(doc => {
        fetchedDesigns.push({ id: doc.id, ...doc.data() } as Design);
      });
      setDesigns(fetchedDesigns);
      if (fetchedDesigns.length > 0 && !activeDesignId) {
        setActiveDesignId(fetchedDesigns[0].id);
      }
      setLoading(false);
    });
    
    return unsubscribe;
  }, [currentUser]);

  // アクティブなデザインのコメント取得
  useEffect(() => {
    if (!currentUser || !activeDesignId) return;
    
    const commentsRef = collection(db, 'projects', currentUser.uid, 'designs', activeDesignId, 'comments');
    const unsubscribe = onSnapshot(commentsRef, (snapshot) => {
      const fetchedComments: Comment[] = [];
      snapshot.forEach(doc => {
        fetchedComments.push({ id: doc.id, ...doc.data() } as Comment);
      });
      // 未解決のものを手前に、新しいものを下に
      fetchedComments.sort((a, b) => {
        if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
        return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
      });
      setComments(fetchedComments);
    });
    
    return unsubscribe;
  }, [currentUser, activeDesignId]);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    
    // パーセンテージで座標を計算
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setNewCommentPos({ x, y });
    setNewCommentText('');
  };

  const handleAddComment = async () => {
    if (!currentUser || !activeDesignId || !newCommentPos || !newCommentText.trim()) return;
    
    const commentId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
    const commentRef = doc(db, 'projects', currentUser.uid, 'designs', activeDesignId, 'comments', commentId);
    
    await setDoc(commentRef, {
      x: newCommentPos.x,
      y: newCommentPos.y,
      text: newCommentText,
      author: 'client',
      createdAt: serverTimestamp(),
      resolved: false
    });
    
    setNewCommentPos(null);
    setNewCommentText('');
  };
  
  const handleResolveComment = async (commentId: string) => {
    if (!currentUser || !activeDesignId) return;
    const commentRef = doc(db, 'projects', currentUser.uid, 'designs', activeDesignId, 'comments', commentId);
    await updateDoc(commentRef, { resolved: true });
  };

  const activeDesign = designs.find(d => d.id === activeDesignId);

  if (loading) {
    return <div style={{ padding: '2rem' }}>読み込み中...</div>;
  }

  if (designs.length === 0) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center', padding: '4rem 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🎨</div>
        <h2 className="font-mincho" style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>デザインは準備中です</h2>
        <p style={{ opacity: 0.7 }}>
          現在、デザインを作成中です。デザインが提出されるとこちらに表示され、画像をクリックして修正指示などのコメントを残すことができるようになります。
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 8rem)' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h2 className="font-mincho" style={{ fontSize: '2.5rem', fontWeight: 500, marginBottom: '0.5rem' }}>デザインレビュー</h2>
        <p className="font-gothic" style={{ opacity: 0.7, letterSpacing: '0.05em' }}>
          画像をクリックしてピンを立て、修正指示などのコメントを残すことができます。
        </p>
      </header>

      <div style={{ display: 'flex', gap: '2rem', flex: 1, minHeight: 0 }}>
        {/* 左側：デザイン画像プレビュー */}
        <div className="neumorphic-panel" style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* デザイン切り替えタブ */}
          <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', borderBottom: 'var(--neu-border)', marginBottom: '1rem' }}>
            {designs.map(design => (
              <button 
                key={design.id}
                onClick={() => {
                  setActiveDesignId(design.id);
                  setNewCommentPos(null);
                }}
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
              <div style={{ position: 'relative', display: 'inline-block', height: 'max-content' }}>
                <img 
                  ref={imageRef}
                  src={activeDesign.imageUrl} 
                  alt={activeDesign.title} 
                  style={{ display: 'block', maxWidth: '100%', cursor: 'crosshair', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  onClick={handleImageClick}
                />
                
                {/* 既存のコメントピン */}
                {comments.map((comment, i) => (
                  <div 
                    key={comment.id}
                    style={{
                      position: 'absolute',
                      left: `${comment.x}%`,
                      top: `${comment.y}%`,
                      transform: 'translate(-50%, -100%)',
                      background: comment.resolved ? 'var(--text-muted)' : (comment.author === 'client' ? 'var(--accent-color)' : '#28a745'),
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

                {/* 新規コメントピン（入力中） */}
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

        {/* 右側：コメントリスト */}
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
                padding: '1rem', borderRadius: '12px', 
                background: comment.resolved ? 'transparent' : 'var(--bg-color)',
                border: comment.resolved ? '1px dashed var(--neu-border)' : 'var(--neu-border)',
                boxShadow: comment.resolved ? 'none' : 'var(--shadow-out)',
                opacity: comment.resolved ? 0.6 : 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ 
                      display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%', 
                      background: comment.resolved ? 'var(--text-muted)' : (comment.author === 'client' ? 'var(--accent-color)' : '#28a745'),
                      color: '#fff', fontSize: '10px', textAlign: 'center', lineHeight: '20px', fontWeight: 'bold'
                    }}>{i + 1}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{comment.author === 'client' ? 'あなた' : 'デザインチーム'}</span>
                  </div>
                  {comment.resolved && <span style={{ fontSize: '0.7rem', color: '#28a745', border: '1px solid #28a745', padding: '2px 6px', borderRadius: '4px' }}>解決済</span>}
                </div>
                <p style={{ fontSize: '0.9rem', margin: 0, whiteSpace: 'pre-wrap' }}>{comment.text}</p>
                {!comment.resolved && comment.author === 'admin' && (
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

          {/* 新規コメント入力フォーム */}
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
                  marginBottom: '1rem', resize: 'vertical'
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
                  disabled={!newCommentText.trim()}
                  style={{ 
                    padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'var(--accent-color)', 
                    color: '#fff', border: 'none', opacity: newCommentText.trim() ? 1 : 0.5 
                  }}
                >
                  送信
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
