import { useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/project";
import type { FormData } from "../../types/form";

interface ContentSection {
  id: string;
  title: string;
  content: string;
  files?: any[];
}

export async function loader({ context, params }: Route.LoaderArgs) {
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

  const project = {
    title: projectResult.title,
    progressRate: projectResult.progress_rate || 0,
    currentPhase: projectResult.current_phase || "Phase 1",
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
  };
}

export default function AdminProjectDetail() {
  const { id, project, hearingData, contentData } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

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
        </section>

      </div>
    </div>
  );
}
