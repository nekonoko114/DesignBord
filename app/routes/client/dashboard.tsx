import { useState } from "react";
import { useNavigate, useLoaderData, useSubmit } from "react-router";
import type { Route } from "./+types/dashboard";
import { useAuth } from "../../contexts/AuthContext";
import { requireUserRole } from "../../utils/auth.server";

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

      {/* 2-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '3rem', alignItems: 'start' }}>
        
        {/* Left Column: Progress & Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          
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

          {/* Project Details */}
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

        {/* Right Column: Actions & Bookings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', position: 'sticky', top: '2rem' }}>
          
          {/* Action Items */}
          <div className="neumorphic-panel" style={{ position: 'relative', overflow: 'hidden', padding: '2rem' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', background: 'var(--accent-color)' }} />
            <h3 className="font-mincho" style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '2rem', margin: 0 }}>
              ご対応お願い事項
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Task 1: Hearing Sheet */}
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
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600 }}>提出済</span>
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
                  {projectData.hearingSubmitted ? "回答内容を確認・修正" : "ヒアリングボードへ"}
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
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600 }}>提出済</span>
                  )}
                </div>
                <p className="font-gothic" style={{ fontSize: '0.85rem', opacity: 0.5, marginBottom: '1.5rem', lineHeight: 1.6 }}>
                  {projectData.contentSubmitted 
                    ? "原稿をご提出いただきありがとうございます。追加や編集も可能です。"
                    : "会社概要および代表挨拶のテキストのご準備をお願いいたします。"}
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
                  {projectData.contentSubmitted ? "確認・修正する" : "原稿提出ボードへ"}
                </button>
              </div>

            </div>
          </div>

          {/* Next Meeting / Bookings Scheduler */}
          <div className="neumorphic-panel" style={{ padding: '2rem' }}>
            <h3 className="font-mincho" style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', margin: 0 }}>
              次回のお打ち合わせ予約
            </h3>

            {/* List of current active reservations */}
            {bookings.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {bookings.map((booking) => (
                  <div key={booking.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0' }}>
                    <div style={{ 
                      width: '48px', height: '48px', borderRadius: '12px', 
                      background: 'var(--bg-color)', boxShadow: 'var(--shadow-in)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 600 }}>予約済</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>MTG</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>打合せ（オンライン）</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.2rem' }}>
                        {formatDate(booking.scheduled_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-gothic" style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '1.5rem' }}>
                現在、予約されているお打ち合わせはありません。
              </p>
            )}

            {/* Reservation form within limits */}
            {canBook ? (
              <form onSubmit={handleBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label htmlFor="booking-time" className="font-gothic" style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                    希望日時を選択（予約枠 {bookingCount} / {limit}）
                  </label>
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
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
                
                {bookingError && (
                  <p className="font-gothic" style={{ fontSize: '0.8rem', color: '#dc3545', margin: 0 }}>
                    {bookingError}
                  </p>
                )}

                <button 
                  type="submit" 
                  disabled={isSubmitting || !scheduledAt}
                  style={{ 
                    width: '100%', 
                    padding: '0.8rem', 
                    fontSize: '0.85rem', 
                    background: 'var(--accent-color)', 
                    color: 'var(--bg-color)',
                    border: 'none',
                    borderRadius: '8px',
                    opacity: (isSubmitting || !scheduledAt) ? 0.6 : 1,
                    cursor: (isSubmitting || !scheduledAt) ? 'not-allowed' : 'pointer',
                    fontWeight: 600
                  }}
                >
                  {isSubmitting ? '処理中...' : '新規予約をする'}
                </button>
              </form>
            ) : (
              <p className="font-gothic" style={{ fontSize: '0.8rem', color: 'var(--accent-color)', background: 'rgba(184, 156, 109, 0.05)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(184, 156, 109, 0.2)', margin: 0 }}>
                予約枠の上限（{limit}回）に達しました。追加の面談をご希望の場合は、ディレクターにお問い合わせください。
              </p>
            )}
          </div>

        </div>
      </div>
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
