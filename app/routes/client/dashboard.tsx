import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";

export default function ClientDashboard() {
  const { projectData } = useAuth();
  const navigate = useNavigate();

  if (!projectData) {
    return null;
  }

  const getStepStatus = (stepPhase: string) => {
    const phases = ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "Phase 5"];
    const currentIndex = phases.indexOf(projectData.currentPhase);
    const stepIndex = phases.indexOf(stepPhase);
    
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "active";
    return "upcoming";
  };

  const getPhaseName = (phase: string) => {
    switch (phase) {
      case "Phase 1": return "ヒアリング・要件定義";
      case "Phase 2": return "ワイヤーフレーム・原稿作成";
      case "Phase 3": return "デザイン制作";
      case "Phase 4": return "コーディング・システム開発";
      case "Phase 5": return "最終確認・公開納品";
      default: return "ヒアリング・要件定義";
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <header style={{ marginBottom: '4rem' }}>
        <h2 className="font-mincho" style={{ fontSize: '2.5rem', fontWeight: 500, marginBottom: '1rem', color: 'var(--text-color)' }}>
          ダッシュボード
        </h2>
        <p className="font-gothic" style={{ opacity: 0.7, fontSize: '1rem', letterSpacing: '0.05em' }}>
          プロジェクトの全体像と、現在のアクションをご確認いただけます。
        </p>
      </header>

      {/* 2カラムレイアウト（メイン：進行状況 / サイド：お願い事項など） */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '3rem', alignItems: 'start' }}>
        
        {/* 左カラム：メインコンテンツ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          
          {/* 一目でわかる進行状況 (At-a-glance Progress) */}
          <div className="neumorphic-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3rem' }}>
              <h3 className="font-mincho" style={{ fontSize: '1.4rem', fontWeight: 600, margin: 0 }}>
                一目でわかる進行状況
              </h3>
              <span style={{ 
                background: 'var(--bg-color)', color: 'var(--accent-color)', 
                padding: '0.5rem 1.2rem', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 600,
                boxShadow: 'var(--shadow-out)', border: 'var(--neu-border)'
              }}>
                現在のフェーズ：{getPhaseName(projectData.currentPhase)}
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              <ProgressTimelineStep 
                phase="Phase 1" 
                title="ヒアリング・要件定義" 
                status={getStepStatus("Phase 1")} 
                desc="ヒアリングシートの記入と初回キックオフMTG" 
              />
              <ProgressTimelineStep 
                phase="Phase 2" 
                title="ワイヤーフレーム・原稿作成" 
                status={getStepStatus("Phase 2")} 
                desc="ページの骨組み確認と、掲載テキストのご用意" 
              />
              <ProgressTimelineStep 
                phase="Phase 3" 
                title="デザイン制作" 
                status={getStepStatus("Phase 3")} 
                desc="実際のデザイン案の作成とご確認" 
              />
              <ProgressTimelineStep 
                phase="Phase 4" 
                title="コーディング・システム開発" 
                status={getStepStatus("Phase 4")} 
                desc="ウェブ上での動作確認とテスト" 
              />
              <ProgressTimelineStep 
                phase="Phase 5" 
                title="最終確認・公開納品" 
                status={getStepStatus("Phase 5")} 
                desc="本番公開と操作レクチャー" 
                isLast
              />
            </div>
          </div>

          {/* プロジェクト基本情報 */}
          <div className="neumorphic-panel">
            <h3 className="font-mincho" style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '2rem', margin: 0 }}>プロジェクト基本情報</h3>
            <div className="font-gothic" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', opacity: 0.8, fontSize: '0.95rem' }}>
              <div>
                <div style={{ opacity: 0.6, fontSize: '0.8rem', marginBottom: '0.2rem' }}>ご契約プラン</div>
                <div style={{ fontWeight: 500 }}>{projectData.planName}</div>
              </div>
              <div>
                <div style={{ opacity: 0.6, fontSize: '0.8rem', marginBottom: '0.2rem' }}>公開予定日</div>
                <div style={{ fontWeight: 500 }}>{projectData.launchDate}</div>
              </div>
              <div>
                <div style={{ opacity: 0.6, fontSize: '0.8rem', marginBottom: '0.2rem' }}>サイト種別</div>
                <div style={{ fontWeight: 500 }}>{projectData.siteType}</div>
              </div>
              <div>
                <div style={{ opacity: 0.6, fontSize: '0.8rem', marginBottom: '0.2rem' }}>担当ディレクター</div>
                <div style={{ fontWeight: 500 }}>{projectData.directorName}</div>
              </div>
            </div>
          </div>

        </div>

        {/* 右カラム：アクションとサイド情報 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', position: 'sticky', top: '2rem' }}>
          
          {/* ご対応お願い事項 (Action Required) */}
          <div className="neumorphic-panel" style={{ position: 'relative', overflow: 'hidden', padding: '2rem' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', background: 'var(--accent-color)' }} />
            <h3 className="font-mincho" style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '2rem', margin: 0 }}>
              ご対応お願い事項
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Task 1: Hearing Board */}
              <div style={{ 
                padding: '1.5rem', 
                borderRadius: '12px', 
                background: 'var(--bg-color)',
                boxShadow: projectData.hearingSubmitted ? 'var(--shadow-in)' : 'var(--shadow-out)',
                border: projectData.hearingSubmitted ? 'var(--neu-border)' : '1px solid transparent',
                opacity: projectData.hearingSubmitted ? 0.7 : 1,
                transition: 'var(--transition-smooth)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div className="font-mincho" style={{ 
                    fontWeight: 600, 
                    color: projectData.hearingSubmitted ? 'var(--text-muted)' : 'var(--accent-color)', 
                    fontSize: '1.05rem' 
                  }}>
                    ヒアリングボード入力
                  </div>
                  {projectData.hearingSubmitted && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600 }}>✓ 提出済</span>
                  )}
                </div>
                <p className="font-gothic" style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1.5rem', lineHeight: 1.6 }}>
                  {projectData.hearingSubmitted 
                    ? "ご回答ありがとうございました。入力内容の確認・変更が可能です。" 
                    : "プロジェクトの目的やデザインのご希望をお伺いします。"}
                </p>
                <button 
                  onClick={() => navigate('/client/discovery')}
                  style={{ 
                    padding: '0.8rem 1.2rem', 
                    fontSize: '0.85rem', 
                    width: '100%', 
                    borderRadius: '8px', 
                    border: projectData.hearingSubmitted ? '1px solid var(--neu-border)' : 'none', 
                    background: projectData.hearingSubmitted ? 'transparent' : 'var(--accent-color)', 
                    color: projectData.hearingSubmitted ? 'var(--text-color)' : 'var(--bg-color)', 
                    boxShadow: projectData.hearingSubmitted ? 'none' : '0 4px 10px rgba(184, 156, 109, 0.3)',
                    cursor: 'pointer'
                  }}
                >
                  {projectData.hearingSubmitted ? "回答内容を確認・修正 →" : "ヒアリングボードへ →"}
                </button>
              </div>

              {/* Task 2: Content Hub */}
              <div style={{ 
                padding: '1.5rem', 
                borderRadius: '12px', 
                background: 'var(--bg-color)',
                boxShadow: projectData.contentSubmitted ? 'var(--shadow-in)' : 'var(--shadow-out)',
                border: projectData.contentSubmitted ? 'var(--neu-border)' : '1px dashed var(--neu-border)',
                opacity: projectData.contentSubmitted ? 0.7 : 1,
                transition: 'var(--transition-smooth)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div className="font-mincho" style={{ 
                    fontWeight: 600, 
                    color: projectData.contentSubmitted ? 'var(--text-muted)' : 'var(--text-color)', 
                    fontSize: '1.05rem',
                    opacity: projectData.contentSubmitted ? 0.7 : 1
                  }}>
                    原稿のご提出
                  </div>
                  {projectData.contentSubmitted && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600 }}>✓ 提出済</span>
                  )}
                </div>
                <p className="font-gothic" style={{ fontSize: '0.85rem', opacity: 0.5, marginBottom: '1.5rem', lineHeight: 1.6 }}>
                  {projectData.contentSubmitted 
                    ? "原稿をご提出いただきありがとうございます。追加や編集も可能です。"
                    : "「会社概要」および「代表挨拶」のテキストのご準備をお願いいたします。"}
                </p>
                <button 
                  onClick={() => navigate('/client/content-hub')}
                  style={{ 
                    padding: '0.8rem 1.2rem', 
                    fontSize: '0.85rem', 
                    width: '100%', 
                    borderRadius: '8px', 
                    border: projectData.contentSubmitted ? '1px solid var(--neu-border)' : 'none',
                    background: projectData.contentSubmitted ? 'transparent' : 'var(--accent-color)',
                    color: projectData.contentSubmitted ? 'var(--text-color)' : 'var(--bg-color)',
                    boxShadow: projectData.contentSubmitted ? 'none' : '0 4px 10px rgba(184, 156, 109, 0.3)',
                    cursor: 'pointer'
                  }}
                >
                  {projectData.contentSubmitted ? "確認・修正する →" : "原稿提出ボードへ →"}
                </button>
              </div>

            </div>
          </div>

          {/* Next Meeting */}
          <div className="neumorphic-panel" style={{ padding: '2rem' }}>
            <h3 className="font-mincho" style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', margin: 0 }}>
              次回のお打ち合わせ
            </h3>
            <div className="font-gothic" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ 
                width: '48px', height: '48px', borderRadius: '12px', 
                background: 'var(--bg-color)', boxShadow: 'var(--shadow-in)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 600 }}>10月</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>24</span>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>キックオフミーティング</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.2rem' }}>14:00 - 15:00 (Google Meet)</div>
              </div>
            </div>
            <button style={{ width: '100%', padding: '0.8rem', fontSize: '0.85rem', background: 'transparent', border: '1px solid var(--neu-border)' }}>
              ミーティングリンクを開く
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// タイムライン用のコンポーネント
function ProgressTimelineStep({ phase, title, desc, status, isLast = false }: { phase: string, title: string, desc: string, status: 'completed' | 'active' | 'upcoming', isLast?: boolean }) {
  const isCompleted = status === 'completed';
  const isActive = status === 'active';
  
  return (
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ 
          width: '36px', height: '36px', borderRadius: '50%', 
          background: isActive ? 'var(--accent-color)' : (isCompleted ? 'var(--bg-color)' : 'transparent'),
          boxShadow: isActive ? '0 0 15px var(--accent-glow)' : (isCompleted ? 'var(--shadow-in)' : 'none'),
          border: isActive ? 'none' : (isCompleted ? '1px solid rgba(184, 156, 109, 0.4)' : '1px solid var(--neu-border)'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isActive ? 'var(--bg-color)' : (isCompleted ? 'var(--accent-color)' : 'var(--text-muted)'),
          fontWeight: 600, fontSize: '1rem', zIndex: 2
        }}>
          {isCompleted ? '✓' : ''}
          {isActive && <span style={{ width: '10px', height: '10px', background: 'var(--bg-color)', borderRadius: '50%' }} />}
          {status === 'upcoming' && <span style={{ width: '8px', height: '8px', background: 'var(--neu-border)', borderRadius: '50%' }} />}
        </div>
        {!isLast && (
          <div style={{ 
            width: '2px', flex: 1, minHeight: '50px',
            background: isCompleted ? 'var(--accent-color)' : 'var(--neu-border)',
            opacity: isCompleted ? 0.3 : 0.5,
            margin: '0.4rem 0'
          }} />
        )}
      </div>
      <div style={{ paddingBottom: isLast ? '0' : '2.5rem', paddingTop: '0.3rem' }}>
        <div className="font-gothic" style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600, marginBottom: '0.2rem', opacity: isActive || isCompleted ? 1 : 0.5 }}>
          {phase}
        </div>
        <div className="font-gothic" style={{ 
          fontWeight: isActive ? 600 : (isCompleted ? 500 : 400),
          color: isActive ? 'var(--accent-color)' : (isCompleted ? 'var(--text-color)' : 'var(--text-muted)'),
          fontSize: '1.1rem',
          letterSpacing: '0.05em',
          marginBottom: '0.3rem'
        }}>
          {title}
        </div>
        <div className="font-gothic" style={{ fontSize: '0.85rem', opacity: isActive ? 0.8 : 0.5 }}>
          {desc}
        </div>
      </div>
    </div>
  );
}
