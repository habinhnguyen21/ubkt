import React, { useState } from 'react';
import type { AppInfo, User } from '../types';
import logoUbkt from '../assets/logo-ubkt.jpg';

type TabKey = 'tong_quan' | 'don_vi' | 'chuong_trinh' | 'ho_so_dia_ban' | 'don_thu' | 'lich_thang' | 'kho_pdf' | 'thong_ke' | 'bao_cao';

interface LayoutProps {
  currentUser: User;
  appInfo: AppInfo | null;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onLogout: () => void;
  onChangePassword: () => void;
  onOpenAuditLogs: () => void;
  onOpenUserManager: () => void;
  isSyncing: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
}

const MENU_ITEMS: { key: TabKey; icon: string; label: string; badge?: number }[] = [
  { key: 'tong_quan', icon: '⊞', label: 'Tổng quan' },
  { key: 'don_vi', icon: '🏛', label: 'Cơ cấu Tổ chức' },
  { key: 'chuong_trinh', icon: '📋', label: 'Chương trình KT-GS' },
  { key: 'ho_so_dia_ban', icon: '📍', label: 'Hồ sơ địa bàn' },
  { key: 'don_thu', icon: '📬', label: 'Quản lý Đơn thư' },
  { key: 'lich_thang', icon: '📅', label: 'Lịch theo tháng' },
  { key: 'kho_pdf', icon: '🗄️', label: 'Kho dữ liệu' },
  { key: 'thong_ke', icon: '📊', label: 'Thống kê' },
  { key: 'bao_cao', icon: '📄', label: 'Báo cáo' },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  BIEN_TAP: 'Biên tập viên',
  XEM: 'Người xem',
};

export function AppLayout({
  currentUser,
  appInfo,
  activeTab,
  onTabChange,
  onLogout,
  onChangePassword,
  onOpenAuditLogs,
  onOpenUserManager,
  isSyncing,
  onRefresh,
  children,
}: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const SIDEBAR_W = sidebarCollapsed ? 60 : 220;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Segoe UI', 'Inter', sans-serif", background: '#f0f2f5' }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside style={{
        width: SIDEBAR_W,
        minWidth: SIDEBAR_W,
        background: 'linear-gradient(180deg, #1a3a5c 0%, #122d4a 100%)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s ease',
        overflow: 'hidden',
        zIndex: 100,
        boxShadow: '2px 0 8px rgba(0,0,0,0.25)',
      }}>
        {/* Logo */}
        <div style={{
          padding: sidebarCollapsed ? '12px 10px' : '12px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 64,
        }}>
          <div
            onClick={() => {
              try {
                localStorage.setItem('ubkt_active_tab', 'tong_quan');
              } catch {
                // ignore
              }
              onTabChange('tong_quan');
              window.location.reload();
            }}
            title="Bấm vào logo để tải lại trang và quay về trang tổng quan"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              flex: 1,
              minWidth: 0,
              userSelect: 'none',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <img
              src={logoUbkt}
              alt="Logo UBKT"
              style={{
                width: sidebarCollapsed ? 38 : 42,
                height: sidebarCollapsed ? 38 : 42,
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
                border: '2px solid rgba(245,197,24,0.7)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.30)',
                transition: 'width 0.25s, height 0.25s',
              }}
            />
            {!sidebarCollapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#f5c518', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.25 }}>
                  Phần mềm nghiệp vụ kiểm tra, giám sát
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={currentUser.ten_don_vi || appInfo?.root_unit_name || 'Đảng ủy cơ sở'}>
                  {currentUser.ten_don_vi || appInfo?.root_unit_name || 'Đảng ủy cơ sở'}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16, padding: 4, flexShrink: 0 }}
          >
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Menu */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto', overflowX: 'hidden' }}>
          {MENU_ITEMS.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                id={`menu-${item.key}`}
                onClick={() => onTabChange(item.key)}
                title={sidebarCollapsed ? item.label : undefined}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: 10, padding: sidebarCollapsed ? '10px 0' : '10px 18px',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  border: 'none',
                  borderLeft: active ? '3px solid #f5c518' : '3px solid transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                  cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s', textAlign: 'left', whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
                {!sidebarCollapsed && item.badge && (
                  <span style={{ marginLeft: 'auto', background: '#e53e3e', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 6px', fontWeight: 700 }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom user info */}
        <div style={{ padding: sidebarCollapsed ? '12px 0' : '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0,
          }}>
            {currentUser.ho_ten.charAt(0).toUpperCase()}
          </div>
          {!sidebarCollapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.ho_ten}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{ROLE_LABEL[currentUser.vai_tro as string] ?? currentUser.vai_tro}</div>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN AREA ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <header style={{
          height: 52, background: '#fff',
          borderBottom: '1px solid #e8ecf0',
          display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          flexShrink: 0, zIndex: 50,
        }}>
          {/* Top Title / Breadcrumb */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: '#1a3a5c', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
              PHẦN MỀM NGHIỆP VỤ KIỂM TRA, GIÁM SÁT
            </span>
            <span style={{ color: '#cbd5e1' }}>/</span>
            <span style={{ fontSize: 13, color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {MENU_ITEMS.find(m => m.key === activeTab)?.label ?? 'Tổng quan'}
            </span>
          </div>

          {/* Trạng thái Trực tuyến */}
          <button
            onClick={onRefresh}
            title="Trạng thái kết nối máy chủ trực tuyến (Click để làm mới dữ liệu)"
            style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6,
              padding: '4px 10px', cursor: 'pointer', color: '#166534', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500,
            }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: isSyncing ? '#eab308' : '#22c55e',
              display: 'inline-block',
              boxShadow: '0 0 6px rgba(34,197,94,0.6)',
              animation: isSyncing ? 'pulse 1s infinite' : 'none',
            }} />
            <span>{isSyncing ? 'Đang làm mới...' : 'Máy chủ Online'}</span>
          </button>

          {/* Notification bell */}
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: 6, fontSize: 18, color: '#718096' }}>
            🔔
            <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, background: '#e53e3e', borderRadius: '50%', border: '1.5px solid #fff' }} />
          </button>

          {/* User menu */}
          <div style={{ position: 'relative' }}>
            <button
              id="btn-user-menu"
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
                padding: '5px 10px', cursor: 'pointer',
              }}
            >
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                {currentUser.ho_ten.charAt(0).toUpperCase()}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#2d3748', lineHeight: 1.2 }}>{currentUser.ho_ten}</div>
                <div style={{ fontSize: 10, color: '#718096' }}>{ROLE_LABEL[currentUser.vai_tro as string]}</div>
              </div>
              <span style={{ color: '#a0aec0', fontSize: 12 }}>▾</span>
            </button>

            {showUserMenu && (
              <div
                style={{
                  position: 'absolute', top: '110%', right: 0,
                  background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: 10, padding: '6px 0', minWidth: 200,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 999,
                }}
                onMouseLeave={() => setShowUserMenu(false)}
              >
                {[
                  { icon: '👥', label: 'Quản lý tài khoản', id: 'menu-user-manager', action: onOpenUserManager, adminOnly: true },
                  { icon: '📜', label: 'Nhật ký hoạt động', id: 'menu-audit-log', action: onOpenAuditLogs },
                  { icon: '🔑', label: 'Đổi mật khẩu', id: 'menu-change-pw', action: onChangePassword },
                  null,
                  { icon: '🚪', label: 'Đăng xuất', id: 'menu-logout', action: onLogout, danger: true },
                ].map((item, i) => {
                  if (!item) return <div key={i} style={{ height: 1, background: '#f0f2f5', margin: '4px 0' }} />;
                  if ((item as {adminOnly?: boolean}).adminOnly && currentUser.vai_tro !== 'ADMIN') return null;
                  return (
                    <button
                      key={(item as {id: string}).id}
                      id={(item as {id: string}).id}
                      onClick={() => { (item as {action: () => void}).action(); setShowUserMenu(false); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 16px', background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: 13, color: (item as {danger?: boolean}).danger ? '#e53e3e' : '#4a5568',
                        textAlign: 'left',
                      }}
                    >
                      <span>{(item as {icon: string}).icon}</span>
                      <span>{(item as {label: string}).label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {children}
        </main>

        {/* Status bar */}
        <div style={{
          height: 26, background: '#1a3a5c', display: 'flex',
          alignItems: 'center', padding: '0 16px', gap: 16, flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
            📦 v1.0.0 &nbsp;|&nbsp; Phần mềm Quản lý Chương trình Kiểm tra, Giám sát của Đảng
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
            🏛 {appInfo?.total_don_vi ?? '--'} đơn vị &nbsp;|&nbsp; 🌐 Trực tuyến (Máy chủ tập trung)
          </span>
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
