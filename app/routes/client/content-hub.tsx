import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

export interface UploadedFile {
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
}

export interface Section {
  id: string;
  title: string;
  content: string;
  files?: UploadedFile[];
}

export default function ContentHub() {
  const { currentUser, refreshProjectData } = useAuth();
  const [sections, setSections] = useState<Section[]>([
    { id: '1', title: '会社概要', content: '' },
    { id: '2', title: '代表挨拶', content: '' },
    { id: '3', title: 'サービス案内', content: '' },
    { id: '4', title: 'お問い合わせ情報', content: '' }
  ]);
  const [activeSectionId, setActiveSectionId] = useState('1');
  const [isLoaded, setIsLoaded] = useState(false);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    const loadContentData = async () => {
      if (currentUser) {
        try {
          const docRef = doc(db, 'contents', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().sections) {
            setSections(docSnap.data().sections as Section[]);
            if (docSnap.data().sections.length > 0) {
              setActiveSectionId((docSnap.data().sections as Section[])[0].id);
            }
          }
        } catch (e) {
          console.error('Failed to load content hub data from Firestore:', e);
        }
      }
      setIsLoaded(true);
    };

    loadContentData();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !isLoaded) return;

    setSavingStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'contents', currentUser.uid), {
          sections,
          updatedAt: serverTimestamp()
        }, { merge: true });

        await setDoc(doc(db, 'projects', currentUser.uid), {
          contentSubmitted: true,
          updatedAt: serverTimestamp()
        }, { merge: true });

        await refreshProjectData();
        setSavingStatus('saved');
      } catch (e) {
        console.error('Auto-save error:', e);
        setSavingStatus('error');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [sections, currentUser, isLoaded]);

  const activeSection = sections.find(s => s.id === activeSectionId);

  const handleContentChange = (newContent: string) => {
    setSections(prev => prev.map(s => 
      s.id === activeSectionId ? { ...s, content: newContent } : s
    ));
  };

  const handleAddSection = () => {
    const newId = Date.now().toString();
    const newTitle = `新規セクション ${sections.length + 1}`;
    setSections([...sections, { id: newId, title: newTitle, content: '' }]);
    setActiveSectionId(newId);
  };

  const handleTitleChange = (newTitle: string) => {
    setSections(prev => prev.map(s => 
      s.id === activeSectionId ? { ...s, title: newTitle } : s
    ));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length || !currentUser || !activeSectionId) return;
    
    const filesArray = Array.from(e.target.files);
    e.target.value = ''; 
    
    for (const file of filesArray) {
      if (file.size > 50 * 1024 * 1024) {
        alert(`ファイルサイズが大きすぎます（50MB以下にしてください）: ${file.name}`);
        continue;
      }

      const fileId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
      const storageRef = ref(storage, `projects/${currentUser.uid}/contents/${activeSectionId}/${fileId}_${file.name}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      setUploadingFiles(prev => ({ ...prev, [fileId]: 0 }));
      
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadingFiles(prev => ({ ...prev, [fileId]: progress }));
        },
        (error) => {
          console.error("Upload error:", error);
          setUploadingFiles(prev => {
            const next = { ...prev };
            delete next[fileId];
            return next;
          });
          alert(`ファイルのアップロードに失敗しました: ${file.name}`);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          const newFile: UploadedFile = {
            id: fileId,
            url: downloadURL,
            name: file.name,
            type: file.type,
            size: file.size
          };
          
          setSections(prev => prev.map(s => {
            if (s.id === activeSectionId) {
              return { ...s, files: [...(s.files || []), newFile] };
            }
            return s;
          }));
          
          setUploadingFiles(prev => {
            const next = { ...prev };
            delete next[fileId];
            return next;
          });
        }
      );
    }
  };
  
  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!confirm(`「${fileName}」を削除してもよろしいですか？`)) return;
    
    setSections(prev => prev.map(s => {
      if (s.id === activeSectionId) {
        return { ...s, files: (s.files || []).filter(f => f.id !== fileId) };
      }
      return s;
    }));
  };

  const handleSaveImmediately = async () => {
    if (!currentUser) return;
    setSavingStatus('saving');
    try {
      await setDoc(doc(db, 'contents', currentUser.uid), {
        sections,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // projects の contentSubmitted も true に更新
      await setDoc(doc(db, 'projects', currentUser.uid), {
        contentSubmitted: true,
        updatedAt: serverTimestamp()
      }, { merge: true });

      await refreshProjectData();
      setSavingStatus('saved');
      alert('すべての変更が正常に保存されました。');
    } catch (e) {
      console.error('Immediate save error:', e);
      setSavingStatus('error');
      alert('保存に失敗しました。インターネット接続を確認し、もう一度お試しください。');
    }
  };

  if (!isLoaded) {
    return (
      <div style={{
        display: "flex",
        minHeight: "60vh",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{
          width: "40px",
          height: "40px",
          border: "3px solid rgba(184, 156, 109, 0.1)",
          borderTopColor: "var(--accent-color)",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }} />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '4rem' }}>
        <h2 className="font-mincho" style={{ fontSize: '2.5rem', fontWeight: 500, marginBottom: '1rem' }}>原稿ご提出ボード</h2>
        <p className="font-gothic" style={{ opacity: 0.7, letterSpacing: '0.05em' }}>
          ウェブサイトに掲載する文章の作成・ご提出をお願いいたします。<br />
          セクションはご自由に増やすことができますので、必要に応じて項目を追加してください。
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '3rem' }}>
        
        {/* Navigation Sidebar for Content Hub */}
        <div className="neumorphic-panel" style={{ padding: '2rem 1.5rem', height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingLeft: '0.5rem' }}>
            <h3 className="font-mincho" style={{ fontSize: '1.1rem', margin: 0 }}>構成一覧</h3>
          </div>
          
          <ul className="font-gothic" style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            {sections.map(sec => (
              <li 
                key={sec.id}
                onClick={() => setActiveSectionId(sec.id)}
                style={{ 
                  padding: '1rem 1.5rem', 
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: activeSectionId === sec.id ? 500 : 400,
                  color: activeSectionId === sec.id ? 'var(--accent-color)' : 'var(--text-color)',
                  boxShadow: activeSectionId === sec.id ? 'var(--shadow-in)' : 'none',
                  border: activeSectionId === sec.id ? 'var(--neu-border)' : '1px solid transparent',
                  transition: 'var(--transition-smooth)',
                  fontSize: '0.95rem',
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
            style={{ width: '100%', padding: '0.8rem', fontSize: '0.9rem', background: 'transparent', boxShadow: 'var(--shadow-out)', border: 'var(--neu-border)' }}
          >
            ＋ セクションを追加
          </button>
        </div>

        {/* Editor Area */}
        <div className="neumorphic-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
            <input 
              type="text" 
              value={activeSection?.title || ''}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="font-mincho"
              style={{ 
                fontSize: '1.5rem', 
                fontWeight: 600, 
                border: 'none', 
                background: 'transparent',
                boxShadow: 'none',
                padding: '0.5rem',
                borderBottom: '1px dashed var(--neu-border)',
                borderRadius: 0,
                color: 'var(--text-color)',
                width: '70%'
              }}
              placeholder="セクション名（例：会社概要）"
            />
            
            <span className="font-gothic" style={{ fontSize: '0.8rem', opacity: 0.6, letterSpacing: '0.05em', marginTop: '1rem', transition: 'var(--transition-smooth)' }}>
              {savingStatus === 'idle' && '全ての変更は保存されています'}
              {savingStatus === 'saving' && '⏳ 自動保存中...'}
              {savingStatus === 'saved' && '✓ 変更が保存されました'}
              {savingStatus === 'error' && '⚠️ 自動保存に失敗しました'}
            </span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', marginBottom: '2.5rem' }}>
            <textarea 
              value={activeSection?.content || ''}
              onChange={e => handleContentChange(e.target.value)}
              placeholder={`ここに ${activeSection?.title || 'テキスト'} の内容をご記入ください。箇条書きなどのメモ書きでも構いません。`}
              style={{ 
                minHeight: '400px', 
                resize: 'vertical',
              }}
            />

            <div style={{ padding: '2rem', border: '1px dashed var(--neu-border)', borderRadius: '12px', background: 'var(--bg-color)' }}>
              <h4 className="font-mincho" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>参考資料・画像</h4>
              <p className="font-gothic" style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1.5rem' }}>
                このセクションに関連する画像やPDFなどの資料があればアップロードしてください。（1ファイル50MBまで）
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
                  ＋ ファイルを選択
                </label>
              </div>

              {/* アップロード中のファイル */}
              {Object.entries(uploadingFiles).map(([id, progress]) => (
                <div key={id} style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '8px', background: 'var(--neumorphic-dark)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                    <span>アップロード中...</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="neu-progress-track" style={{ height: '6px' }}>
                    <div className="neu-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ))}

              {/* アップロード済みファイル一覧 */}
              {(activeSection?.files?.length ?? 0) > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  {activeSection!.files!.map(file => (
                    <div key={file.id} style={{
                      padding: '1rem', border: 'var(--neu-border)', borderRadius: '12px',
                      background: 'var(--bg-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem',
                      boxShadow: 'var(--shadow-out)', position: 'relative', overflow: 'hidden'
                    }}>
                      <button 
                        onClick={() => handleDeleteFile(file.id, file.name)}
                        style={{
                          position: 'absolute', top: '0.5rem', right: '0.5rem', width: '24px', height: '24px',
                          padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px'
                        }}
                      >
                        ✕
                      </button>
                      
                      {file.type.startsWith('image/') ? (
                        <div style={{ width: '100%', height: '120px', borderRadius: '8px', overflow: 'hidden', background: 'var(--neumorphic-dark)' }}>
                          <img src={file.url} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div style={{ 
                          width: '100%', height: '120px', borderRadius: '8px', background: 'var(--neumorphic-dark)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: 'var(--text-muted)'
                        }}>
                          📄
                        </div>
                      )}
                      
                      <a href={file.url} target="_blank" rel="noopener noreferrer" style={{
                        fontSize: '0.8rem', color: 'var(--text-color)', textDecoration: 'none', 
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', marginTop: '0.5rem'
                      }}>
                        {file.name}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={handleSaveImmediately}
              style={{ 
                padding: '1rem 2.5rem', 
                background: 'var(--bg-color)', 
                color: 'var(--text-color)',
                opacity: savingStatus === 'saving' ? 0.7 : 1,
                cursor: savingStatus === 'saving' ? 'not-allowed' : 'pointer'
              }}
              disabled={savingStatus === 'saving'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              {savingStatus === 'saving' ? '保存中...' : '変更を保存する'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
