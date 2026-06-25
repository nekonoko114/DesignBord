import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { CustomCursor } from "../components/CustomCursor";
import { requireUserRole } from "../utils/auth.server";
import { useClerk, useUser } from "@clerk/react-router";
import type { Route } from "./+types/admin";

export async function loader(args: Route.LoaderArgs) {
  await requireUserRole(args, ["admin"]);
  return {};
}

export default function AdminLayout() {
  return (
    <AuthProvider>
      <AdminLayoutContent />
    </AuthProvider>
  );
}

function AdminLayoutContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { signOut } = useClerk();
  const { user } = useUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut(() => navigate("/login"));
  };

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
            {isSidebarOpen ? 'DesignBoard Admin' : 'DBA'}
          </h1>
          {isSidebarOpen && (
            <p style={{ opacity: 0.5, fontSize: '0.7rem', letterSpacing: '0.05em', marginTop: '0.3rem', fontFamily: 'var(--font-gothic)' }}>管理者ポータル</p>
          )}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1 }}>
          <AdminNavItem to="/admin/dashboard" label="プロジェクト一覧" icon="📁" isOpen={isSidebarOpen} />
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: isSidebarOpen ? 'flex-start' : 'center', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {user?.imageUrl ? (
              <img 
                src={user.imageUrl} 
                alt="Avatar" 
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: 'var(--neu-border)', boxShadow: 'var(--shadow-out)' }} 
              />
            ) : (
              <div style={{ 
                minWidth: '40px', height: '40px', borderRadius: '50%', background: 'var(--text-color)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '600'
              }}>
                {user?.firstName?.substring(0, 2).toUpperCase() || "AD"}
              </div>
            )}
            {isSidebarOpen && (
              <div style={{ fontFamily: 'var(--font-gothic)', whiteSpace: 'nowrap' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-color)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.fullName || user?.primaryEmailAddress?.emailAddress || "管理者"}
                </div>
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

