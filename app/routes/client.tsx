import { useState } from "react";
import { Outlet, NavLink, useNavigate, Navigate } from "react-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { CustomCursor } from "../components/CustomCursor";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

function ClientLayoutContent() {
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
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg-color)",
        gap: "1.5rem"
      }}>
        <h1 className="kinetic-text" style={{ fontSize: "1.8rem", fontWeight: 600, letterSpacing: "0.15em", margin: 0 }}>
          DesignBoard
        </h1>
        <div style={{
          width: "28px",
          height: "28px",
          border: "2px solid rgba(184, 156, 109, 0.1)",
          borderTopColor: "var(--accent-color)",
          borderRadius: "50%",
          animation: "spin 1.2s cubic-bezier(0.5, 0.1, 0.15, 1) infinite"
        }} />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const userDisplayName = currentUser.email ? currentUser.email.split("@")[0] : "お客様";

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)', overflowX: 'hidden' }}>
      <CustomCursor />
      
      {/* SaaS Sidebar */}
      <aside style={{ 
        width: isSidebarOpen ? '280px' : '90px', 
        padding: isSidebarOpen ? '2.5rem 2rem' : '2.5rem 1rem', 
        borderRight: 'var(--neu-border)', 
        boxShadow: '4px 0 20px rgba(0,0,0,0.03)', 
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        transition: 'var(--transition-smooth)',
        position: 'relative'
      }}>
        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          style={{
            position: 'absolute',
            right: '-16px',
            top: '3rem',
            width: '32px',
            height: '32px',
            padding: 0,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-color)',
            border: 'var(--neu-border)',
            boxShadow: 'var(--shadow-out)',
            color: 'var(--accent-color)',
            cursor: 'pointer',
            zIndex: 20
          }}
        >
          {isSidebarOpen ? '❮' : '❯'}
        </button>

        <div style={{ marginBottom: '3.5rem', display: 'flex', flexDirection: 'column', alignItems: isSidebarOpen ? 'flex-start' : 'center', overflow: 'hidden' }}>
          <h1 className="kinetic-text" style={{ 
            fontSize: isSidebarOpen ? '1.5rem' : '1.2rem', 
            fontWeight: 600, margin: 0, letterSpacing: '0.1em',
            whiteSpace: 'nowrap'
          }}>
            {isSidebarOpen ? 'DesignBoard' : 'DB'}
          </h1>
          {isSidebarOpen && (
            <p style={{ opacity: 0.6, fontSize: '0.75rem', letterSpacing: '0.15em', marginTop: '0.5rem', fontFamily: 'var(--font-gothic)', whiteSpace: 'nowrap' }}>クライアントポータル</p>
          )}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, alignItems: isSidebarOpen ? 'stretch' : 'center' }}>
          <NavItem to="/client/dashboard" label="ダッシュボード" icon="📊" isOpen={isSidebarOpen} />
          <NavItem to="/client/discovery" label="ヒアリングボード" icon="📋" isOpen={isSidebarOpen} />
          <NavItem to="/client/content-hub" label="原稿ご提出" icon="📝" isOpen={isSidebarOpen} />
          <NavItem to="/client/review" label="デザインレビュー" icon="✨" isOpen={isSidebarOpen} />
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '2.5rem', borderTop: 'var(--neu-border)', display: 'flex', justifyContent: isSidebarOpen ? 'flex-start' : 'center', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              minWidth: '44px', height: '44px', borderRadius: '50%', 
              background: 'var(--bg-color)', 
              boxShadow: 'var(--shadow-out)',
              border: 'var(--neu-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              color: 'var(--accent-color)', fontWeight: '600', fontFamily: 'var(--font-mincho)'
            }}>
              客
            </div>
            {isSidebarOpen && (
              <div style={{ fontFamily: 'var(--font-gothic)', whiteSpace: 'nowrap' }}>
                <div style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-color)' }}>{userDisplayName} 様</div>
                <div onClick={handleLogout} style={{ opacity: 0.5, fontSize: '0.75rem', marginTop: '0.2rem', cursor: 'pointer', transition: 'var(--transition-smooth)' }} className="logout-btn">ログアウト</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: isSidebarOpen ? '4rem 5rem' : '4rem 3rem', overflowY: 'auto', maxHeight: '100vh', position: 'relative', transition: 'var(--transition-smooth)' }}>
        <Outlet />
      </main>
      <style>{`
        .logout-btn:hover { color: var(--accent-color); opacity: 1 !important; }
      `}</style>
    </div>
  );
}

export default function ClientLayout() {
  return (
    <AuthProvider>
      <ClientLayoutContent />
    </AuthProvider>
  );
}

function NavItem({ to, label, icon, isOpen }: { to: string; label: string; icon: string; isOpen: boolean }) {
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
