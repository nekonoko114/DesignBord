import { useState } from "react";
import { Outlet, NavLink, useNavigate, Navigate } from "react-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { CustomCursor } from "../components/CustomCursor";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

export default function AdminLayout() {
  return (
    <AuthProvider>
      <AdminLayoutContent />
    </AuthProvider>
  );
}

function AdminLayoutContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("ログアウトエラー:", error);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", minHeight: "100vh",
        alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-color)"
      }}>
        <div style={{ width: "28px", height: "28px", border: "2px solid rgba(184, 156, 109, 0.1)", borderTopColor: "var(--accent-color)", borderRadius: "50%", animation: "spin 1.2s infinite" }} />
      </div>
    );
  }

  // 管理者権限チェック (環境変数に設定したメールアドレスと一致するか確認)
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  if (currentUser.email !== adminEmail) {
    // 管理者ではない場合はクライアントのダッシュボードへリダイレクト
    return <Navigate to="/client/dashboard" replace />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)', overflowX: 'hidden' }}>
      <CustomCursor />
      
      {/* Admin Sidebar */}
      <aside style={{ 
        width: isSidebarOpen ? '260px' : '90px', 
        padding: isSidebarOpen ? '2.5rem 1.5rem' : '2.5rem 1rem', 
        borderRight: 'var(--neu-border)', 
        backgroundColor: 'var(--bg-color)',
        boxShadow: 'var(--shadow-out)', 
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        transition: 'var(--transition-smooth)',
        position: 'relative'
      }}>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          style={{
            position: 'absolute', right: '-16px', top: '3rem', width: '32px', height: '32px', padding: 0,
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-color)', border: 'var(--neu-border)', boxShadow: 'var(--shadow-out)',
            color: 'var(--accent-color)', cursor: 'pointer', zIndex: 20
          }}
        >
          {isSidebarOpen ? '❮' : '❯'}
        </button>

        <div style={{ marginBottom: '3rem', display: 'flex', flexDirection: 'column', alignItems: isSidebarOpen ? 'flex-start' : 'center', overflow: 'hidden' }}>
          <h1 className="font-mincho" style={{ 
            fontSize: isSidebarOpen ? '1.3rem' : '1.1rem', 
            fontWeight: 700, margin: 0, color: 'var(--text-color)', whiteSpace: 'nowrap'
          }}>
            {isSidebarOpen ? 'Admin Portal' : 'AP'}
          </h1>
          {isSidebarOpen && (
            <p style={{ opacity: 0.5, fontSize: '0.7rem', letterSpacing: '0.05em', marginTop: '0.3rem', fontFamily: 'var(--font-gothic)' }}>管理者ダッシュボード</p>
          )}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1 }}>
          <AdminNavItem to="/admin/dashboard" label="プロジェクト一覧" icon="📁" isOpen={isSidebarOpen} />
          {/* <AdminNavItem to="/admin/clients" label="クライアント管理" icon="👥" isOpen={isSidebarOpen} /> */}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: isSidebarOpen ? 'flex-start' : 'center', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              minWidth: '40px', height: '40px', borderRadius: '50%', background: 'var(--text-color)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '600'
            }}>
              AD
            </div>
            {isSidebarOpen && (
              <div style={{ fontFamily: 'var(--font-gothic)', whiteSpace: 'nowrap' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-color)' }}>Administrator</div>
                <div onClick={handleLogout} style={{ opacity: 0.6, fontSize: '0.75rem', marginTop: '0.2rem', cursor: 'pointer' }} className="admin-logout-btn">ログアウト</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: isSidebarOpen ? '3rem 4rem' : '3rem 3rem', overflowY: 'auto', maxHeight: '100vh', transition: 'var(--transition-smooth)' }}>
        <Outlet />
      </main>
      <style>{`
        .admin-logout-btn:hover { color: #dc3545; opacity: 1 !important; }
      `}</style>
    </div>
  );
}

function AdminNavItem({ to, label, icon, isOpen }: { to: string; label: string; icon: string; isOpen: boolean }) {
  return (
    <NavLink 
      to={to}
      title={!isOpen ? label : undefined}
      style={({ isActive }) => ({
        padding: isOpen ? '1.2rem 1.5rem' : '1.2rem',
        borderRadius: '16px',
        textDecoration: 'none',
        color: isActive ? 'var(--accent-color)' : 'var(--text-color)',
        fontWeight: isActive ? 600 : 400,
        fontFamily: 'var(--font-gothic)',
        fontSize: '0.95rem',
        letterSpacing: '0.05em',
        backgroundColor: isActive ? 'var(--bg-color)' : 'transparent',
        boxShadow: isActive ? 'var(--shadow-in)' : 'none',
        border: isActive ? 'var(--neu-border)' : '1px solid transparent',
        transition: 'var(--transition-smooth)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isOpen ? 'flex-start' : 'center',
        gap: '1rem',
        whiteSpace: 'nowrap'
      })}
    >
      {({ isActive }) => (
        <>
          <span style={{ fontSize: '1.2rem', opacity: isActive ? 1 : 0.7 }}>{icon}</span>
          {isOpen && <span style={{ opacity: isActive ? 1 : 0.8 }}>{label}</span>}
        </>
      )}
    </NavLink>
  );
}
