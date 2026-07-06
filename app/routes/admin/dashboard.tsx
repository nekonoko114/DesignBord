import { useState, useEffect } from "react";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import type { Route } from "./+types/dashboard";
import { requireUserRole } from "../../utils/auth.server";
import { sendDiscordNotification } from "../../utils/discord.server";

// Helper to check 5 working days (excluding Saturday & Sunday)
const isStagnant = (lastActivityAt: number): boolean => {
  const lastDate = new Date(lastActivityAt * 1000);
  const nowDate = new Date();
  
  let workingDays = 0;
  const tempDate = new Date(lastDate.getTime());
  while (tempDate < nowDate) {
    const day = tempDate.getDay();
    if (day !== 0 && day !== 6) {
      workingDays++;
    }
    tempDate.setDate(tempDate.getDate() + 1);
  }
  return workingDays >= 5;
};

export async function loader(args: Route.LoaderArgs) {
  const { context, request } = args;
  await requireUserRole(args, ["admin"]);
  const db = (context as any).cloudflare.env.DB;
  
  try {
    const { results } = await db.prepare(`
      SELECT p.*, u.email as user_email, u.name as client_name, h.status as hearing_status, h.overview_data, h.content_data
      FROM projects p
      JOIN users u ON p.client_id = u.id
      LEFT JOIN hearings h ON p.id = h.project_id
    `).all();

    const projects = (results || []).map((row: any) => {
      let companyName = "";
      if (row.overview_data) {
        try {
          const parsed = JSON.parse(row.overview_data);
          companyName = parsed.companyName || "";
        } catch (e) {}
      }

      return {
        id: row.id,
        title: row.title,
        clientName: row.client_name,
        companyName: companyName,
      userEmail: row.user_email,
      progressRate: row.progress_rate || 0,
      bookingLimit: row.booking_limit || 3,
      lastActivityAt: row.last_activity_at,
      currentPhase: row.current_phase || "Phase 1",
      hearingSubmitted: row.hearing_status === "submitted",
      overviewData: row.overview_data,
      contentData: row.content_data,
      };
    });

    // Load upcoming bookings
    const { results: bookingResults } = await db.prepare(`
      SELECT b.*, p.title as project_title, u.name as client_name
      FROM bookings b
      JOIN projects p ON b.project_id = p.id
      JOIN users u ON p.client_id = u.id
      WHERE b.status = 'reserved'
      ORDER BY b.scheduled_at ASC
    `).all();

    const upcomingBookings = (bookingResults || []).map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      projectTitle: row.project_title,
      clientName: row.client_name,
      scheduledAt: row.scheduled_at,
      status: row.status
    }));

    // Detect stagnant projects and dispatch Discord alerts
    const stagnantList = projects.filter((p: any) => isStagnant(p.lastActivityAt));
    if (stagnantList.length > 0) {
      const names = stagnantList.map((p: any) => p.clientName).join(", ");
      try {
        const env = (context as any).cloudflare.env;
        await sendDiscordNotification(env, {
          title: "停滞プロジェクト検知アラート",
          description: `最終活動から5営業日以上経過している案件があります。`,
          fields: [
            { name: "停滞しているプロジェクト", value: names, inline: false }
          ],
          color: 16750848, // オレンジ
        });
      } catch (err) {
        console.error("Failed to send stagnant Discord notification:", err);
      }
    }

    return { projects, upcomingBookings };
  } catch (e) {
    console.error("Failed to load projects from D1:", e);
    return { projects: [], upcomingBookings: [] };
  }
}

export async function action(args: Route.ActionArgs) {
  const { context, request } = args;
  await requireUserRole(args, ["admin"]);
  const db = (context as any).cloudflare.env.DB;
  const formData = await request.formData();
  const projectId = formData.get("projectId") as string;
  const nextPhase = formData.get("nextPhase") as string;
  const intent = formData.get("intent") as string;

  if (intent === "advancePhase" && projectId && nextPhase) {
    try {
      await db.prepare(
        "UPDATE projects SET current_phase = ?, last_activity_at = strftime('%s', 'now'), updated_at = strftime('%s', 'now') WHERE id = ?"
      ).bind(nextPhase, projectId).run();
      return { success: true };
    } catch (e) {
      console.error("Failed to advance phase in D1:", e);
      return { error: "フェーズの更新に失敗しました。" };
    }
  }

  if (intent === "updateProgress" && projectId) {
    const progressRate = parseInt(formData.get("progressRate") as string, 10);
    if (!isNaN(progressRate)) {
      try {
        await db.prepare(
          "UPDATE projects SET progress_rate = ?, last_activity_at = strftime('%s', 'now'), updated_at = strftime('%s', 'now') WHERE id = ?"
        ).bind(progressRate, projectId).run();
        return { success: true };
      } catch (e) {
        console.error("Failed to update progress rate in D1:", e);
        return { error: "進捗率の更新に失敗しました。" };
      }
    }
  }

  if (intent === "updateBookingStatus") {
    const bookingId = formData.get("bookingId") as string;
    const status = formData.get("status") as string;

    if (!bookingId || !status) return { error: "予約IDとステータスが必要です。" };

    try {
      await db.prepare("UPDATE bookings SET status = ? WHERE id = ?").bind(status, bookingId).run();
      return { success: true };
    } catch (e) {
      console.error("Failed to update booking status:", e);
      return { error: "予約ステータスの更新に失敗しました。" };
    }
  }

  if (intent === "createProject") {
    const clientEmail = formData.get("clientEmail") as string;
    const projectTitle = formData.get("projectTitle") as string;
    const bookingLimitVal = formData.get("bookingLimit") as string;
    const bookingLimit = parseInt(bookingLimitVal, 10) || 3;

    if (!clientEmail || !projectTitle) {
      return { error: "メールアドレスとプロジェクトタイトルは必須です。" };
    }

    try {
      // Check if user already exists
      const existingUser = await db.prepare("SELECT id FROM users WHERE email = ?").bind(clientEmail).first();
      let clientId = existingUser?.id;
      
      const newProjectId = crypto.randomUUID();
      const newHearingId = crypto.randomUUID();
      const batchQueries = [];

      if (!clientId) {
        // Create pending placeholder user
        clientId = `pending_${crypto.randomUUID()}`;
        batchQueries.push(
          db.prepare("INSERT INTO users (id, email, role) VALUES (?, ?, 'client')").bind(clientId, clientEmail)
        );
      }

      // Add project and initial blank hearing
      batchQueries.push(
        db.prepare(
          "INSERT INTO projects (id, client_id, title, progress_rate, booking_limit, last_activity_at, created_at) VALUES (?, ?, ?, 0, ?, strftime('%s', 'now'), strftime('%s', 'now'))"
        ).bind(newProjectId, clientId, projectTitle, bookingLimit)
      );

      batchQueries.push(
        db.prepare(
          "INSERT INTO hearings (id, project_id, status, overview_data, content_data, terms_accepted, updated_at) VALUES (?, ?, 'draft', '{}', '{}', 0, strftime('%s', 'now'))"
        ).bind(newHearingId, newProjectId)
      );

      await db.batch(batchQueries);
      return { success: true };
    } catch (e) {
      console.error("Failed to create project in D1:", e);
      return { error: "プロジェクトの作成に失敗しました。" };
    }
  }

  return {};
}

export default function AdminDashboard() {
  const { projects, upcomingBookings } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [showNotifications, setShowNotifications] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [bookingLimit, setBookingLimit] = useState(3);

  useEffect(() => {
    if (fetcher.data && (fetcher.data as any).success) {
      setIsModalOpen(false);
      setClientEmail("");
      setProjectTitle("");
      setBookingLimit(3);
    }
  }, [fetcher.data]);

  const getPhaseLabel = (phase: string) => {
    switch(phase) {
      case "Phase 1": return "Phase 1 (ヒアリング)";
      case "Phase 2": return "Phase 2 (ワイヤー/原稿)";
      case "Phase 3": return "Phase 3 (デザイン)";
      case "Phase 4": return "Phase 4 (実装)";
      case "Phase 5": return "Phase 5 (公開)";
      default: return phase;
    }
  };

  const advancePhase = (projectId: string, currentPhase: string) => {
    if (!window.confirm("フェーズを進めますか？クライアントのダッシュボードに即座に反映されます。")) return;
    
    const phases = ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "Phase 5"];
    const currentIndex = phases.indexOf(currentPhase);
    if (currentIndex < 0 || currentIndex >= phases.length - 1) return;
    
    const nextPhase = phases[currentIndex + 1];
    
    fetcher.submit(
      { intent: "advancePhase", projectId, nextPhase },
      { method: "post" }
    );
  };

  const updateProgress = (projectId: string, currentRate: number) => {
    const newRateStr = window.prompt("新しい進捗率（パーセント）を入力してください (0 - 100):", currentRate.toString());
    if (newRateStr === null) return;
    const newRate = parseInt(newRateStr, 10);
    if (isNaN(newRate) || newRate < 0 || newRate > 100) {
      alert("0から100の数値を入力してください。");
      return;
    }

    fetcher.submit(
      { intent: "updateProgress", projectId, progressRate: newRate.toString() },
      { method: "post" }
    );
  };

  const exportAsJSON = (project: any) => {
    const dataStr = JSON.stringify({
      projectTitle: project.title,
      clientName: project.clientName,
      email: project.userEmail,
      overview: project.overviewData ? JSON.parse(project.overviewData) : {},
      content: project.contentData ? JSON.parse(project.contentData) : {}
    }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `${project.clientName}_hearing.json`);
    linkElement.click();
  };

  const exportAsCSV = (project: any) => {
    const overview = project.overviewData ? JSON.parse(project.overviewData) : {};
    const content = project.contentData ? JSON.parse(project.contentData) : {};
    const combined = { ...overview, ...content };

    let csvContent = "\ufeff項目,回答内容\n";
    for (const [key, value] of Object.entries(combined)) {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
      csvContent += `"${key}","${String(displayValue).replace(/"/g, '""')}"\n`;
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', url);
    linkElement.setAttribute('download', `${project.clientName}_hearing.csv`);
    linkElement.click();
  };

  const handleUpdateBookingStatus = (bookingId: string, status: string) => {
    if (!window.confirm(status === 'completed' ? 'この予約を完了済みにしますか？' : 'この予約をキャンセルしますか？')) return;
    fetcher.submit({ intent: "updateBookingStatus", bookingId, status }, { method: "post" });
  };

  const formatDateTime = (unix: number) => {
    const d = new Date(unix * 1000);
    return d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const stagnantCount = projects.filter((p: any) => isStagnant(p.lastActivityAt)).length;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative' }}>
      
      {/* Header and Notifications bar */}
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="font-mincho" style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-color)', margin: 0 }}>
            プロジェクト一覧
          </h2>
          <p className="font-gothic" style={{ opacity: 0.6, marginTop: '0.5rem' }}>全クライアントの進行状況を管理します。</p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* 新規プロジェクト作成ボタン */}
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              background: 'var(--accent-color)',
              color: '#fff',
              border: 'none',
              padding: '0.8rem 1.5rem',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 600,
              boxShadow: '0 4px 10px rgba(184, 156, 109, 0.3)',
            }}
            className="font-gothic"
          >
            新規プロジェクト作成
          </button>

          {/* Bell Notifications */}
          <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            style={{
              background: 'transparent',
              border: 'var(--neu-border)',
              padding: '0.8rem 1.2rem',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              position: 'relative'
            }}
          >
            <span>通知</span>
            {stagnantCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: '#dc3545',
                color: '#fff',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}>
                {stagnantCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="neumorphic-panel" style={{
              position: 'absolute',
              right: 0,
              top: '120%',
              width: '320px',
              zIndex: 100,
              padding: '1.2rem',
              textAlign: 'left',
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              <h4 className="font-mincho" style={{ margin: '0 0 1rem 0', borderBottom: 'var(--neu-border)', paddingBottom: '0.5rem' }}>
                通知リスト
              </h4>
              {stagnantCount > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {projects.filter((p: any) => isStagnant(p.lastActivityAt)).map((p: any) => (
                    <div key={p.id} style={{ fontSize: '0.85rem', padding: '0.6rem', background: 'rgba(220, 53, 69, 0.05)', border: '1px solid rgba(220, 53, 69, 0.1)', borderRadius: '6px' }}>
                      <div style={{ fontWeight: 'bold', color: '#dc3545' }}>停滞警告</div>
                      <div style={{ opacity: 0.8, marginTop: '0.2rem' }}>
                        {p.clientName}様の最終活動から5営業日以上経過しています。
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-gothic" style={{ fontSize: '0.85rem', opacity: 0.6, margin: 0, textAlign: 'center', padding: '1rem 0' }}>
                  新しい通知はありません。
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </header>

      {/* Upcoming Bookings Panel */}
      <div className="neumorphic-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 className="font-mincho" style={{ fontSize: '1.2rem', marginBottom: '1rem', marginTop: 0 }}>今後の面談予約</h3>

        {upcomingBookings && upcomingBookings.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {upcomingBookings.map((booking: any) => (
              <div key={booking.id} style={{
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--neu-border)',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span className="font-gothic" style={{ fontWeight: 600, color: 'var(--accent-color)' }}>
                    {formatDateTime(booking.scheduledAt)}
                  </span>
                  <span className="font-gothic" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                    {booking.clientName}様
                  </span>
                </div>
                <div className="font-gothic" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                  {booking.projectTitle}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => handleUpdateBookingStatus(booking.id, 'completed')}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    完了
                  </button>
                  <button
                    onClick={() => handleUpdateBookingStatus(booking.id, 'cancelled')}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid #dc3545', color: '#dc3545', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-gothic" style={{ opacity: 0.5, fontSize: '0.9rem' }}>現在予約されている面談はありません。</p>
        )}
      </div>

      {/* Projects List Panel */}
      <div className="neumorphic-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }} className="font-gothic">
          <thead>
            <tr style={{ background: 'var(--neumorphic-dark)', borderBottom: 'var(--neu-border)' }}>
              <th style={{ padding: '1.2rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-color)' }}>クライアント</th>
              <th style={{ padding: '1.2rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-color)' }}>進捗率</th>
              <th style={{ padding: '1.2rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-color)' }}>現在のフェーズ</th>
              <th style={{ padding: '1.2rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-color)' }}>ヒアリング</th>
              <th style={{ padding: '1.2rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-color)', textAlign: 'right' }}>アクション / エクスポート</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>
                  プロジェクトがまだありません。
                </td>
              </tr>
            ) : (
              projects.map((project: any) => {
                const stagnant = isStagnant(project.lastActivityAt);
                return (
                  <tr 
                    key={project.id} 
                    style={{ 
                      borderBottom: 'var(--neu-border)', 
                      transition: 'background 0.2s',
                      borderLeft: stagnant ? '4px solid #dc3545' : '4px solid transparent',
                      background: stagnant ? 'rgba(220, 53, 69, 0.02)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '1.2rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {project.companyName ? project.companyName : project.clientName}
                      </div>
                      <div style={{ opacity: 0.5, fontSize: '0.75rem', marginTop: '0.2rem' }}>
                        担当: {project.clientName} | Email: {project.userEmail}
                      </div>
                      {stagnant && (
                        <div style={{ color: '#dc3545', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '0.3rem' }}>
                          警告: 最終活動から5営業日以上経過しています。
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1.2rem' }}>
                      <button 
                        onClick={() => updateProgress(project.id, project.progressRate)}
                        style={{
                          background: 'transparent',
                          border: '1px dashed var(--accent-color)',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          color: 'var(--accent-color)'
                        }}
                      >
                        {project.progressRate}%
                      </button>
                    </td>
                    <td style={{ padding: '1.2rem' }}>
                      <span style={{ 
                        background: 'var(--neumorphic-dark)', padding: '0.4rem 0.8rem', 
                        borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600,
                        boxShadow: 'var(--shadow-in)'
                      }}>
                        {getPhaseLabel(project.currentPhase)}
                      </span>
                    </td>
                    <td style={{ padding: '1.2rem', fontSize: '0.9rem' }}>
                      {project.hearingSubmitted ? (
                        <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>提出済</span>
                      ) : (
                        <span style={{ opacity: 0.4 }}>未</span>
                      )}
                    </td>
                    <td style={{ padding: '1.2rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                        
                        {/* Data Export Buttons */}
                        {project.hearingSubmitted && (
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button 
                              onClick={() => exportAsCSV(project)}
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', border: '1px solid var(--neu-border)' }}
                            >
                              CSV
                            </button>
                            <button 
                              onClick={() => exportAsJSON(project)}
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', border: '1px solid var(--neu-border)' }}
                            >
                              JSON
                            </button>
                          </div>
                        )}

                        <button 
                          onClick={() => navigate(`/admin/project/${project.id}`)}
                          style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                        >
                          詳細
                        </button>
                        
                        {project.currentPhase !== "Phase 5" && (
                          <button 
                            onClick={() => advancePhase(project.id, project.currentPhase)}
                            style={{ 
                              padding: '0.5rem 1rem', fontSize: '0.8rem', 
                              background: 'var(--accent-color)', color: '#fff',
                              boxShadow: '0 4px 10px rgba(184, 156, 109, 0.3)',
                              border: 'none'
                            }}
                          >
                            進む
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 新規プロジェクト作成モーダル */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <div className="neumorphic-panel" style={{
            width: '450px',
            padding: '2.5rem',
            position: 'relative',
          }}>
            <h3 className="font-mincho" style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 600 }}>新規プロジェクト作成</h3>
            
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="createProject" />
              
              <div style={{ marginBottom: '1.2rem' }}>
                <label className="font-gothic" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
                  クライアントのメールアドレス
                </label>
                <input
                  type="email"
                  name="clientEmail"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  required
                  placeholder="client@example.com"
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    borderRadius: '8px',
                    border: 'var(--neu-border)',
                    background: 'var(--neumorphic-dark)',
                    color: 'var(--text-color)',
                    boxShadow: 'var(--shadow-in)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.2rem' }}>
                <label className="font-gothic" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
                  プロジェクトタイトル
                </label>
                <input
                  type="text"
                  name="projectTitle"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  required
                  placeholder="例: コーポレートサイト制作"
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    borderRadius: '8px',
                    border: 'var(--neu-border)',
                    background: 'var(--neumorphic-dark)',
                    color: 'var(--text-color)',
                    boxShadow: 'var(--shadow-in)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label className="font-gothic" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
                  初回面談予約上限（回数）
                </label>
                <input
                  type="number"
                  name="bookingLimit"
                  value={bookingLimit}
                  onChange={(e) => setBookingLimit(parseInt(e.target.value, 10) || 3)}
                  min="1"
                  max="10"
                  required
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    borderRadius: '8px',
                    border: 'var(--neu-border)',
                    background: 'var(--neumorphic-dark)',
                    color: 'var(--text-color)',
                    boxShadow: 'var(--shadow-in)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {(fetcher.data as any)?.error && (
                <div style={{ color: '#dc3545', marginBottom: '1.2rem', fontSize: '0.9rem', textAlign: 'center' }}>
                  {(fetcher.data as any).error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '0.6rem 1.2rem',
                    background: 'transparent',
                    border: 'var(--neu-border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: 'var(--text-color)',
                  }}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.6rem 1.5rem',
                    background: 'var(--accent-color)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  作成する
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}
    </div>
  );
}
