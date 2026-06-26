import { useState } from "react";
import { useNavigate, useLoaderData, useSubmit } from "react-router";
import type { Route } from "./+types/dashboard";
import { useAuth } from "../../contexts/AuthContext";
import { requireUserRole } from "../../utils/auth.server";
import { Check } from "lucide-react";

export async function loader(args: Route.LoaderArgs) {
  const { context, request } = args;
  const { userId } = await requireUserRole(args, ["client"]);
  const db = (context as any).cloudflare.env.DB;

  let project = null;
  let bookings: any[] = [];
  let bookingCount = 0;

  try {
    project = await db.prepare("SELECT * FROM projects WHERE client_id = ?").bind(userId).first();
    if (project) {
      const bookingsResult = await db.prepare(
        "SELECT * FROM bookings WHERE project_id = ? AND status = 'reserved' ORDER BY scheduled_at ASC"
      ).bind(project.id).all();
      bookings = bookingsResult.results || [];
      bookingCount = bookings.length;
    }
  } catch (e) {
    console.error("Failed to load dashboard data from D1:", e);
  }

  return {
    project,
    bookings,
    bookingCount,
  };
}

export async function action(args: Route.ActionArgs) {
  const { context, request } = args;
  const { userId } = await requireUserRole(args, ["client"]);
  const db = (context as any).cloudflare.env.DB;

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    const project = await db.prepare("SELECT id, booking_limit FROM projects WHERE client_id = ?").bind(userId).first();
    if (!project) {
      return new Response(JSON.stringify({ error: "プロジェクトが見つかりません。" }), { status: 404 });
    }

    if (intent === "create-booking") {
      const scheduledStr = formData.get("scheduledAt") as string;
      if (!scheduledStr) {
        return new Response(JSON.stringify({ error: "日時を指定してください。" }), { status: 400 });
      }

      const scheduledAt = Math.floor(new Date(scheduledStr).getTime() / 1000);
      if (isNaN(scheduledAt)) {
        return new Response(JSON.stringify({ error: "無効な日時形式です。" }), { status: 400 });
      }

      // Check booking limit limit
      const currentBookings = await db.prepare(
        "SELECT COUNT(*) as count FROM bookings WHERE project_id = ? AND status = 'reserved'"
      ).bind(project.id).first();
      
      const count = currentBookings ? (currentBookings.count as number) : 0;
      const limit = project.booking_limit as number;
      if (count >= limit) {
        return new Response(JSON.stringify({ error: `予約上限（${limit}回）に達しているため、これ以上予約できません。` }), { status: 400 });
      }

      const bookingId = crypto.randomUUID();
      await db.prepare(
        "INSERT INTO bookings (id, project_id, scheduled_at, status) VALUES (?, ?, ?, 'reserved')"
      ).bind(bookingId, project.id, scheduledAt).run();

      await db.prepare("UPDATE projects SET last_activity_at = strftime('%s', 'now') WHERE id = ?").bind(project.id).run();

      return new Response(JSON.stringify({ success: true }));
    }

    return new Response(JSON.stringify({ error: "無効なリクエストです。" }), { status: 400 });
  } catch (e) {
    console.error("Action error in booking:", e);
    return new Response(JSON.stringify({ error: "サーバー処理中にエラーが発生しました。" }), { status: 500 });
  }
}

export default function ClientDashboard() {
  const { project, bookings, bookingCount } = useLoaderData<typeof loader>();
  const { projectData } = useAuth();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [scheduledAt, setScheduledAt] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // UI状態管理：タイムライン表示と予約フォーム表示
  const [showTimeline, setShowTimeline] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);

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

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt) return;
    setIsSubmitting(true);
    setBookingError(null);

    try {
      const formData = new FormData();
      formData.append("intent", "create-booking");
      formData.append("scheduledAt", scheduledAt);

      const response = await fetch(window.location.pathname, {
        method: "POST",
        body: formData
      });
      const result = await response.json();

      if (result.success) {
        setScheduledAt("");
        setShowBookingForm(false);
        submit(null, { method: "get" }); // Revalidate
      } else {
        setBookingError(result.error || "予約に失敗しました。");
      }
    } catch (err) {
      console.error(err);
      setBookingError("予約処理中に通信エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (unixTimestamp: number) => {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const limit = project?.booking_limit || 3;
  const canBook = bookingCount < limit;
  const hasTodo = !projectData.hearingSubmitted || !projectData.contentSubmitted;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem' }}>
      <header style={{ marginBottom: '3rem' }}>
        <h2 className="font-mincho" style={{ fontSize: '2rem', fontWeight: 500, marginBottom: '0.8rem', color: 'var(--text-color)', letterSpacing: '0.05em' }}>
          ダッシュボード
        </h2>
        <p className="font-gothic" style={{ opacity: 0.6, fontSize: '0.9rem', letterSpacing: '0.05em', margin: 0 }}>
          プロジェクト「{project?.title || "Webサイト制作"}」の現状と次回のアクション
        </p>
      </header>

      {/* 1-Column Content Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
        
        {/* Section 1: Status & Timeline (Collapsible) */}
        <div className="neumorphic-panel" style={{ padding: '1.8rem 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ 
                width: '12px', height: '12px', borderRadius: '50%', 
                backgroundColor: 'var(--accent-color)', 
                boxShadow: '0 0 10px var(--accent-glow)' 
              }} />
              <span className="font-gothic" style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                現在のフェーズ: <span className="font-mincho" style={{ color: 'var(--accent-color)', fontWeight: 600, marginLeft: '0.4rem', fontSize: '1.05rem' }}>{getPhaseName(projectData.currentPhase)}</span>
              </span>
            </div>
            <button 
              onClick={() => setShowTimeline(!showTimeline)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-color)',
                opacity: 0.6,
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontFamily: 'var(--font-gothic)',
                padding: '0.2rem 0.5rem',
                textDecoration: 'underline',
                textUnderlineOffset: '4px'
              }}
            >
              {showTimeline ? "進捗詳細を閉じる" : "全体の進捗工程を表示"}
            </button>
          </div>

          {/* Collapsible Timeline */}
          {showTimeline && (
            <div style={{ 
              marginTop: '2rem', 
              paddingTop: '2rem', 
              borderTop: '1px solid var(--neu-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              animation: 'fadeIn 0.3s ease-out'
            }}>
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
          )}
        </div>

        {/* Section 2: Action Needed (Todo) */}
        <div className="neumorphic-panel" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--accent-color)' }} />
          <h3 className="font-mincho" style={{ fontSize: '1.2rem', fontWeight: 600, margin: '0 0 1.5rem 0', letterSpacing: '0.05em' }}>
            ご対応お願い事項
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            
            {/* Task 1: Hearing Board */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '1.2rem 1.5rem', 
              borderRadius: '12px', 
              background: 'var(--bg-color)',
              boxShadow: projectData.hearingSubmitted ? 'var(--shadow-in)' : 'var(--shadow-out)',
              border: projectData.hearingSubmitted ? 'var(--neu-border)' : '1px solid transparent',
              opacity: projectData.hearingSubmitted ? 0.7 : 1,
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <div className="font-mincho" style={{ fontWeight: 600, color: projectData.hearingSubmitted ? 'var(--text-color)' : 'var(--accent-color)', fontSize: '1rem', marginBottom: '0.3rem', display: 'flex', alignItems: 'center' }}>
                  ヒアリングボード入力
                  {projectData.hearingSubmitted && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--accent-color)', marginLeft: '0.8rem', fontWeight: 600 }}>
                      <Check size={14} /> 提出済
                    </span>
                  )}
                </div>
                <p className="font-gothic" style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0, lineHeight: 1.5 }}>
                  プロジェクトの目的やデザインのご希望をお伺いします。
                </p>
              </div>
              <button 
                onClick={() => navigate('/client/discovery')}
                style={{ 
                  padding: '0.6rem 1.5rem', 
                  fontSize: '0.8rem', 
                  borderRadius: '8px', 
                  border: projectData.hearingSubmitted ? '1px solid var(--accent-color)' : 'none', 
                  background: projectData.hearingSubmitted ? 'transparent' : 'var(--accent-color)', 
                  color: projectData.hearingSubmitted ? 'var(--accent-color)' : 'var(--bg-color)', 
                  boxShadow: projectData.hearingSubmitted ? 'none' : '0 4px 10px rgba(184, 156, 109, 0.25)',
                  cursor: 'pointer',
                  fontWeight: 500,
                  minHeight: 'auto',
                  minWidth: 'auto'
                }}
              >
                {projectData.hearingSubmitted ? '回答内容を確認・修正' : '入力画面へ'}
              </button>
            </div>

            {/* Task 2: Content Hub */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '1.2rem 1.5rem', 
              borderRadius: '12px', 
              background: 'var(--bg-color)',
              boxShadow: projectData.contentSubmitted ? 'var(--shadow-in)' : 'var(--shadow-out)',
              border: projectData.contentSubmitted ? 'var(--neu-border)' : '1px solid transparent',
              opacity: projectData.contentSubmitted ? 0.7 : 1,
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <div className="font-mincho" style={{ fontWeight: 600, color: 'var(--text-color)', fontSize: '1rem', marginBottom: '0.3rem', display: 'flex', alignItems: 'center' }}>
                  原稿のご提出
                  {projectData.contentSubmitted && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--accent-color)', marginLeft: '0.8rem', fontWeight: 600 }}>
                      <Check size={14} /> 提出済
                    </span>
                  )}
                </div>
                <p className="font-gothic" style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0, lineHeight: 1.5 }}>
                  会社概要および代表挨拶のテキストのご準備をお願いいたします。
                </p>
              </div>
              <button 
                onClick={() => navigate('/client/content-hub')}
                style={{ 
                  padding: '0.6rem 1.5rem', 
                  fontSize: '0.8rem', 
                  borderRadius: '8px', 
                  border: projectData.contentSubmitted ? '1px solid var(--accent-color)' : 'none',
                  background: projectData.contentSubmitted ? 'transparent' : 'var(--accent-color)',
                  color: projectData.contentSubmitted ? 'var(--accent-color)' : 'var(--bg-color)',
                  boxShadow: projectData.contentSubmitted ? 'none' : '0 4px 10px rgba(184, 156, 109, 0.25)',
                  cursor: 'pointer',
                  fontWeight: 500,
                  minHeight: 'auto',
                  minWidth: 'auto'
                }}
              >
                {projectData.contentSubmitted ? '提出原稿を確認・追加' : '提出画面へ'}
              </button>
            </div>

          </div>
        </div>

        {/* Section 3: Next Meeting Reservation */}
        <div className="neumorphic-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 className="font-mincho" style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
              次回のお打ち合わせ
            </h3>
            {canBook && !showBookingForm && (
              <button 
                onClick={() => setShowBookingForm(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-color)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-gothic)',
                  padding: '0.2rem 0.5rem',
                  textDecoration: 'underline',
                  textUnderlineOffset: '4px',
                  fontWeight: 500
                }}
              >
                新規お打合せ予約をする
              </button>
            )}
          </div>

          {/* List of current active reservations */}
          {bookings.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: showBookingForm ? '1.5rem' : 0 }}>
              {bookings.map((booking) => (
                <div key={booking.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1.2rem', 
                  padding: '1rem',
                  background: 'var(--bg-color)',
                  borderRadius: '8px',
                  border: '1px solid var(--neu-border)'
                }}>
                  <div style={{ 
                    width: '40px', height: '40px', borderRadius: '8px', 
                    background: 'var(--bg-color)', boxShadow: 'var(--shadow-in)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-color)' }}>MTG</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>打合せ（オンライン）</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.1rem' }}>
                      {formatDate(booking.scheduled_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !showBookingForm && (
              <p className="font-gothic" style={{ fontSize: '0.85rem', opacity: 0.6, margin: 0 }}>
                現在、確定しているお打ち合わせ予定はありません。
              </p>
            )
          )}

          {/* Collapsible Reservation Form */}
          {showBookingForm && (
            <div style={{ 
              marginTop: '1.5rem', 
              paddingTop: '1.5rem', 
              borderTop: '1px solid var(--neu-border)',
              animation: 'fadeIn 0.3s ease-out'
            }}>
              <form onSubmit={handleBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label htmlFor="booking-time" className="font-gothic" style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                    希望日時を選択（現在の予約枠 {bookingCount} / {limit}）
                  </label>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <input 
                      type="datetime-local" 
                      id="booking-time"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      required
                      style={{
                        padding: '0.8rem',
                        background: 'var(--neu-bg-inset)',
                        border: '1px solid var(--neu-border)',
                        borderRadius: '8px',
                        color: 'var(--text-color)',
                        fontFamily: 'var(--font-gothic)',
                        fontSize: '0.9rem',
                        flex: 1,
                        minWidth: '200px'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        type="submit" 
                        disabled={isSubmitting || !scheduledAt}
                        style={{ 
                          padding: '0.8rem 1.5rem', 
                          fontSize: '0.85rem', 
                          background: 'var(--accent-color)', 
                          color: 'var(--bg-color)',
                          border: 'none',
                          borderRadius: '8px',
                          opacity: (isSubmitting || !scheduledAt) ? 0.6 : 1,
                          cursor: (isSubmitting || !scheduledAt) ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          minHeight: 'auto',
                          minWidth: 'auto'
                        }}
                      >
                        {isSubmitting ? '予約中...' : '予約を確定'}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          setShowBookingForm(false);
                          setBookingError(null);
                        }}
                        style={{ 
                          padding: '0.8rem 1.2rem', 
                          fontSize: '0.85rem', 
                          background: 'transparent', 
                          color: 'var(--text-color)',
                          border: '1px solid var(--neu-border)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          minHeight: 'auto',
                          minWidth: 'auto'
                        }}
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                </div>
                
                {bookingError && (
                  <p className="font-gothic" style={{ fontSize: '0.8rem', color: '#dc3545', margin: 0 }}>
                    {bookingError}
                  </p>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Section 4: Project Information (Footer style) */}
        <div style={{ 
          marginTop: '1.5rem',
          paddingTop: '1.5rem', 
          borderTop: '1px solid var(--neu-border)',
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '2rem', 
          fontSize: '0.8rem', 
          fontFamily: 'var(--font-gothic)', 
          opacity: 0.6 
        }}>
          <div>
            <span style={{ marginRight: '0.4rem' }}>プラン:</span>
            <span style={{ fontWeight: 500, color: 'var(--text-color)' }}>{projectData.planName}</span>
          </div>
          <div>
            <span style={{ marginRight: '0.4rem' }}>公開予定日:</span>
            <span style={{ fontWeight: 500, color: 'var(--text-color)' }}>{projectData.launchDate}</span>
          </div>
          <div>
            <span style={{ marginRight: '0.4rem' }}>サイト種別:</span>
            <span style={{ fontWeight: 500, color: 'var(--text-color)' }}>{projectData.siteType}</span>
          </div>
          <div>
            <span style={{ marginRight: '0.4rem' }}>担当ディレクター:</span>
            <span style={{ fontWeight: 500, color: 'var(--text-color)' }}>{projectData.directorName}</span>
          </div>
        </div>

      </div>

      {/* Custom Styles for Animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function ProgressTimelineStep({ phase, title, desc, status, isLast = false }: { phase: string, title: string, desc: string, status: 'completed' | 'active' | 'upcoming', isLast?: boolean }) {
  const isCompleted = status === 'completed';
  const isActive = status === 'active';
  
  return (
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ 
          width: '32px', height: '32px', borderRadius: '50%', 
          background: isActive ? 'var(--accent-color)' : (isCompleted ? 'var(--bg-color)' : 'transparent'),
          boxShadow: isActive ? '0 0 10px var(--accent-glow)' : (isCompleted ? 'var(--shadow-in)' : 'none'),
          border: isActive ? 'none' : (isCompleted ? '1px solid rgba(184, 156, 109, 0.4)' : '1px solid var(--neu-border)'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isActive ? 'var(--bg-color)' : (isCompleted ? 'var(--accent-color)' : 'var(--text-muted)'),
          fontWeight: 600, fontSize: '0.9rem', zIndex: 2
        }}>
          {isCompleted ? '✓' : ''}
          {isActive && <span style={{ width: '8px', height: '8px', background: 'var(--bg-color)', borderRadius: '50%' }} />}
          {status === 'upcoming' && <span style={{ width: '6px', height: '6px', background: 'var(--neu-border)', borderRadius: '50%' }} />}
        </div>
        {!isLast && (
          <div style={{ 
            width: '2px', flex: 1, minHeight: '40px',
            background: isCompleted ? 'var(--accent-color)' : 'var(--neu-border)',
            opacity: isCompleted ? 0.3 : 0.5,
            margin: '0.3rem 0'
          }} />
        )}
      </div>
      <div style={{ paddingBottom: isLast ? '0' : '1.8rem', paddingTop: '0.2rem' }}>
        <div className="font-gothic" style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 600, marginBottom: '0.1rem', opacity: isActive || isCompleted ? 1 : 0.5 }}>
          {phase}
        </div>
        <div className="font-gothic" style={{ 
          fontWeight: isActive ? 600 : (isCompleted ? 500 : 400),
          color: isActive ? 'var(--accent-color)' : (isCompleted ? 'var(--text-color)' : 'var(--text-muted)'),
          fontSize: '1rem',
          letterSpacing: '0.05em',
          marginBottom: '0.2rem'
        }}>
          {title}
        </div>
        <div className="font-gothic" style={{ fontSize: '0.8rem', opacity: isActive ? 0.8 : 0.5 }}>
          {desc}
        </div>
      </div>
    </div>
  );
}
