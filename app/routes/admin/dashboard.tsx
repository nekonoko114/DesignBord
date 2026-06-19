import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router";
import type { ProjectData } from "../../contexts/AuthContext";

interface ProjectWithId extends ProjectData {
  id: string; // user UID
  userEmail?: string;
}

export default function AdminDashboard() {
  const [projects, setProjects] = useState<ProjectWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAllProjects = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "projects"));
        const projectsData: ProjectWithId[] = [];
        querySnapshot.forEach((doc) => {
          projectsData.push({ id: doc.id, ...doc.data() } as ProjectWithId);
        });
        setProjects(projectsData);
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllProjects();
  }, []);

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

  const advancePhase = async (projectId: string, currentPhase: string) => {
    if (!window.confirm("フェーズを進めますか？クライアントのダッシュボードに即座に反映されます。")) return;
    
    const phases = ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "Phase 5"];
    const currentIndex = phases.indexOf(currentPhase);
    if (currentIndex < 0 || currentIndex >= phases.length - 1) return;
    
    const nextPhase = phases[currentIndex + 1];
    
    try {
      await setDoc(doc(db, "projects", projectId), {
        currentPhase: nextPhase,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // ローカルのStateも更新
      setProjects(prev => prev.map(p => 
        p.id === projectId ? { ...p, currentPhase: nextPhase } : p
      ));
    } catch (e) {
      console.error("Error updating phase:", e);
      alert("フェーズの更新に失敗しました。");
    }
  };

  if (loading) {
    return <div>プロジェクト一覧を読み込み中...</div>;
  }

  return (
    <div style={{ maxWidth: '1000px' }}>
      <header style={{ marginBottom: '3rem' }}>
        <h2 className="font-mincho" style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--text-color)', margin: 0 }}>
          プロジェクト一覧
        </h2>
        <p className="font-gothic" style={{ opacity: 0.6, marginTop: '0.5rem' }}>全クライアントの進行状況を管理します。</p>
      </header>

      <div className="neumorphic-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }} className="font-gothic">
          <thead>
            <tr style={{ background: 'var(--neumorphic-dark)', borderBottom: 'var(--neu-border)' }}>
              <th style={{ padding: '1.2rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-color)' }}>クライアント (UID)</th>
              <th style={{ padding: '1.2rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-color)' }}>現在のフェーズ</th>
              <th style={{ padding: '1.2rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-color)' }}>ヒアリング提出</th>
              <th style={{ padding: '1.2rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-color)' }}>原稿提出</th>
              <th style={{ padding: '1.2rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-color)', textAlign: 'right' }}>アクション</th>
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
              projects.map(project => (
                <tr key={project.id} style={{ borderBottom: 'var(--neu-border)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '1.2rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{project.planName}</div>
                    <div style={{ opacity: 0.5, fontSize: '0.75rem', marginTop: '0.2rem' }}>UID: {project.id.slice(0,8)}...</div>
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
                    {project.hearingSubmitted ? <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>✓ 完了</span> : <span style={{ opacity: 0.4 }}>未</span>}
                  </td>
                  <td style={{ padding: '1.2rem', fontSize: '0.9rem' }}>
                    {project.contentSubmitted ? <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>✓ 完了</span> : <span style={{ opacity: 0.4 }}>未</span>}
                  </td>
                  <td style={{ padding: '1.2rem', textAlign: 'right', display: 'flex', gap: '0.8rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <button 
                      onClick={() => navigate(`/admin/project/${project.id}`)}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                    >
                      詳細・データ確認
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
                        次のフェーズへ
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
