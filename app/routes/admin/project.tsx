import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";
import type { ProjectData } from "../../contexts/AuthContext";
import type { FormData } from "../../types/form";

interface ContentSection {
  id: string;
  title: string;
  content: string;
}

export default function AdminProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<ProjectData | null>(null);
  const [hearingData, setHearingData] = useState<FormData | null>(null);
  const [contentData, setContentData] = useState<ContentSection[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!id) return;
      try {
        // 1. プロジェクト基本情報
        const projSnap = await getDoc(doc(db, "projects", id));
        if (projSnap.exists()) {
          setProject(projSnap.data() as ProjectData);
        }

        // 2. ヒアリングデータ
        const hearingSnap = await getDoc(doc(db, "discovery_forms", id));
        if (hearingSnap.exists() && hearingSnap.data().data) {
          setHearingData(hearingSnap.data().data as FormData);
        }

        // 3. 原稿データ
        const contentSnap = await getDoc(doc(db, "contents", id));
        if (contentSnap.exists() && contentSnap.data().sections) {
          setContentData(contentSnap.data().sections as ContentSection[]);
        }
      } catch (error) {
        console.error("Error fetching project details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [id]);

  if (loading) {
    return <div>データを読み込み中...</div>;
  }

  if (!project) {
    return <div>プロジェクトが見つかりません。</div>;
  }

  return (
    <div style={{ maxWidth: '1000px', paddingBottom: '5rem' }}>
      <button 
        onClick={() => navigate('/admin/dashboard')}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}
        className="font-gothic"
      >
        ❮ 一覧へ戻る
      </button>

      <header style={{ marginBottom: '3rem' }}>
        <h2 className="font-mincho" style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--text-color)', margin: 0 }}>
          {project.planName}
        </h2>
        <p className="font-gothic" style={{ opacity: 0.6, marginTop: '0.5rem' }}>
          UID: {id} | 現在のフェーズ: {project.currentPhase}
        </p>
      </header>

      <div style={{ display: 'grid', gap: '3rem' }}>
        
        {/* ヒアリングデータ */}
        <section className="neumorphic-panel" style={{ padding: '2.5rem' }}>
          <h3 className="font-mincho" style={{ fontSize: '1.4rem', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '1rem', marginBottom: '2rem' }}>
            ヒアリングデータ
          </h3>
          
          {!hearingData ? (
            <p className="font-gothic" style={{ opacity: 0.5 }}>まだ提出されていません。</p>
          ) : (
            <div className="font-gothic" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div>
                <h4 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>会社・事業について</h4>
                <div style={{ background: '#f8f8f8', padding: '1.5rem', borderRadius: '8px' }}>
                  <p><strong>会社名:</strong> {hearingData.companyName}</p>
                  <p><strong>事業内容:</strong> {hearingData.businessDescription}</p>
                  <p><strong>ターゲット:</strong> {hearingData.targetAudience}</p>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>デザイン・希望</h4>
                <div style={{ background: '#f8f8f8', padding: '1.5rem', borderRadius: '8px' }}>
                  <p><strong>ご希望のカラー:</strong> {hearingData.designPreferences}</p>
                  <p><strong>参考サイト:</strong> {hearingData.competitors}</p>
                  <p><strong>その他要望:</strong> {hearingData.additionalFeatures}</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 原稿データ */}
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
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.8rem' }}>■ {section.title}</h4>
                  <div style={{ 
                    background: 'var(--bg-color)', padding: '1.5rem', borderRadius: '8px', 
                    whiteSpace: 'pre-wrap', lineHeight: 1.6, border: 'var(--neu-border)'
                  }}>
                    {section.content || <span style={{ opacity: 0.4 }}>（本文なし）</span>}
                  </div>
                  
                  {/* 添付ファイル */}
                  {(section as any).files && (section as any).files.length > 0 && (
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {(section as any).files.map((file: any) => (
                        <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" style={{
                          padding: '0.5rem 1rem', background: 'var(--neumorphic-dark)', borderRadius: '8px',
                          textDecoration: 'none', color: 'var(--accent-color)', fontSize: '0.85rem', fontWeight: 500,
                          display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }}>
                          📎 {file.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* デザイン提出・レビュー */}
        <section className="neumorphic-panel" style={{ padding: '2.5rem' }}>
          <h3 className="font-mincho" style={{ fontSize: '1.4rem', borderBottom: 'var(--neu-border)', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>デザイン提出・レビュー管理</span>
            <button 
              onClick={() => navigate(`/admin/project/${id}/review`)}
              style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem', background: 'var(--accent-color)', color: '#fff', border: 'none' }}
            >
              レビューボードを開く ➡
            </button>
          </h3>
          <p className="font-gothic" style={{ opacity: 0.7, marginBottom: '2rem' }}>
            デザインのアップロードや、クライアントからの修正指示の確認・対応は専用のレビューボードで行います。
          </p>
        </section>

      </div>
    </div>
  );
}
