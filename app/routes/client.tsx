import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { CustomCursor } from "../components/CustomCursor";
import { requireUserRole } from "../utils/auth.server";
import { useClerk } from "@clerk/react-router";
import type { Route } from "./+types/client";
import { LayoutDashboard, ClipboardList, FileText, Sparkles } from "lucide-react";

export async function loader(args: Route.LoaderArgs) {
  await requireUserRole(args, ["client"]);
  return {};
}

function ClientLayoutContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { currentUser, noProjectFound } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut(() => navigate("/login"));
  };

  const userDisplayName = currentUser ? currentUser.name : "お客様";

  if (noProjectFound) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-color)', padding: '2rem' }}>
        <CustomCursor />
        <div className="neumorphic-panel" style={{ maxWidth: '540px', width: '100%', padding: '3rem 2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            border: '2px double var(--accent-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '2rem',
            color: 'var(--accent-color)',
            fontSize: '1.2rem',
            fontFamily: 'var(--font-mincho)',
            fontWeight: 500,
            boxShadow: 'var(--shadow-out)'
          }}>
            待機
          </div>

          <h2 className="font-mincho" style={{ fontSize: '1.5rem', marginBottom: '1.2rem', color: 'var(--accent-color)', fontWeight: 600, letterSpacing: '0.1em' }}>
            プロジェクト準備中
          </h2>
          
          <p className="font-gothic" style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '2.5rem', lineHeight: '1.8', textAlign: 'left', letterSpacing: '0.05em' }}>
            ご登録ありがとうございます。現在、担当ディレクターがお客様用のプロジェクト領域およびヒアリングシートの初期セットアップを行っております。<br /><br />
            セットアップが完了いたしましたら、担当者よりメールまたはお電話にて開始のご案内を差し上げます。恐れ入りますが、今しばらくお待ちいただけますようお願い申し上げます。
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
            <button
              onClick={handleLogout}
              style={{
                flex: 1,
                padding: '0.8rem',
                fontSize: '0.85rem',
                background: 'transparent',
                border: '1px solid var(--neu-border)',
                color: 'var(--text-color)',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: 'none',
                fontFamily: 'var(--font-gothic)',
                minWidth: 'auto',
                minHeight: 'auto'
              }}
            >
              別のアカウントでサインイン
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)', overflowX: 'hidden' }}>
      <CustomCursor />
      
      {/* SaaS Sidebar */}
      <aside style={{ 
        width: isSidebarOpen ? '240px' : '80px', 
        padding: isSidebarOpen ? '2rem 1.2rem' : '2rem 0.8rem', 
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

        <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: isSidebarOpen ? 'flex-start' : 'center', overflow: 'hidden' }}>
          <h1 className="kinetic-text" style={{ 
            fontSize: isSidebarOpen ? '1.3rem' : '1.1rem', 
            fontWeight: 600, margin: 0, letterSpacing: '0.1em',
            whiteSpace: 'nowrap'
          }}>
            {isSidebarOpen ? 'DesignBoard' : 'DB'}
          </h1>
          {isSidebarOpen && (
            <p style={{ opacity: 0.6, fontSize: '0.7rem', letterSpacing: '0.15em', marginTop: '0.4rem', fontFamily: 'var(--font-gothic)', whiteSpace: 'nowrap' }}>クライアントポータル</p>
          )}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1, alignItems: isSidebarOpen ? 'stretch' : 'center' }}>
          <NavItem to="/client/dashboard" label="ダッシュボード" icon={<LayoutDashboard size={20} />} isOpen={isSidebarOpen} />
          <NavItem to="/client/discovery" label="ヒアリングボード" icon={<ClipboardList size={20} />} isOpen={isSidebarOpen} />
          <NavItem to="/client/content-hub" label="原稿ご提出" icon={<FileText size={20} />} isOpen={isSidebarOpen} />
          <NavItem to="/client/review" label="デザインレビュー" icon={<Sparkles size={20} />} isOpen={isSidebarOpen} />
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: 'var(--neu-border)', display: 'flex', justifyContent: isSidebarOpen ? 'flex-start' : 'center', overflow: 'hidden' }}>
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
      <main style={{ flex: 1, padding: isSidebarOpen ? '2rem 3rem' : '2rem 2rem', overflowY: 'auto', maxHeight: '100vh', position: 'relative', transition: 'var(--transition-smooth)' }}>
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

function NavItem({ to, label, icon, isOpen }: { to: string; label: string; icon: React.ReactNode; isOpen: boolean }) {
  return (
    <NavLink 
      to={to}
      title={!isOpen ? label : undefined}
      style={({ isActive }) => ({
        padding: isOpen ? '0.8rem 1.2rem' : '0.8rem',
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
          <span style={{ display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.7 }}>{icon}</span>
          {isOpen && <span style={{ opacity: isActive ? 1 : 0.8 }}>{label}</span>}
        </>
      )}
    </NavLink>
  );
}

