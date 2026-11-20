import React, { useState, useEffect } from 'react';
import type { AppInfo, User } from '../types';
import logoUbkt from '../assets/logo-ubkt.jpg';
import { cloudSyncService } from '../services/cloudSyncService';
import { NotificationBell } from './NotificationBell';
import { useIsMobile } from '../hooks/useIsMobile';

type TabKey =
  | 'tong_quan'
  | 'don_vi'
  | 'phan_cong'
  | 'chuong_trinh'
  | 'ho_so_dia_ban'
  | 'don_thu'
  | 'lich_thang'
  | 'kho_pdf'
  | 'thong_ke'
  | 'bao_cao';

interface LayoutProps {
  currentUser: User;
  appInfo: AppInfo | null;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onLogout: () => void;
  onLockSession?: () => void;
  onChangePassword: () => void;
  onOpenAuditLogs: () => void;
  onOpenUserManager: () => void;
  isSyncing: boolean;
  onRefresh: () => void;
  onOpenCloudSync?: () => void;
  children: React.ReactNode;
}

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
  onLockSession,
  onChangePassword,
  onOpenAuditLogs,
  onOpenUserManager,
  isSyncing,
  onRefresh,
  onOpenCloudSync,
  children,
}: LayoutProps) {
  const isMobile = useIsMobile();
  const isAdmin = currentUser.vai_tro === 'ADMIN';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => cloudSyncService.getLastSyncedAt());

  // Lắng nghe thay đổi trạng thái đồng bộ
  useEffect(() => {
    const handleStatusChanged = (e: Event) => {
      const ce = e as CustomEvent<{ lastSyncedAt?: string }>;
      if (ce.detail?.lastSyncedAt) {
        setLastSyncTime(ce.detail.lastSyncedAt);
      } else {
        setLastSyncTime(cloudSyncService.getLastSyncedAt());
      }
    };

    window.addEventListener('ubkt_sync_status_changed', handleStatusChanged);
    return () => {
      window.removeEventListener('ubkt_sync_status_changed', handleStatusChanged);
    };
  }, []);

  // Đóng ngăn kéo khi nhấn phím Esc trên điện thoại
  useEffect(() => {
    if (!isMobile || !mobileDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobile, mobileDrawerOpen]);

  // Tự động đóng ngăn kéo khi chuyển sang kích thước máy tính
  useEffect(() => {
    if (!isMobile) {
      setMobileDrawerOpen(false);
    }
  }, [isMobile]);

  const menuItems: { key: TabKey; icon: string; label: string; badge?: number }[] =
    currentUser.vai_tro === 'ADMIN'
      ? [
          { key: 'tong_quan', icon: '⊞', label: 'Tổng quan' },
          { key: 'don_vi', icon: '🏛', label: 'Cơ cấu Tổ chức' },
          { key: 'phan_cong', icon: '👥', label: 'Phân công quản lý' },
          { key: 'chuong_trinh', icon: '📋', label: 'Chương trình KT-GS' },
          { key: 'ho_so_dia_ban', icon: '📍', label: 'Hồ sơ địa bàn' },
          { key: 'don_thu', icon: '📬', label: 'Quản lý Đơn thư' },
          { key: 'lich_thang', icon: '📅', label: 'Lịch theo tháng' },
          { key: 'kho_pdf', icon: '🗄️', label: 'Kho dữ liệu' },
          { key: 'thong_ke', icon: '📊', label: 'Thống kê' },
          { key: 'bao_cao', icon: '📄', label: 'Báo cáo' },
        ]
      : [
          { key: 'tong_quan', icon: '⊞', label: 'Tổng quan' },
          { key: 'don_vi', icon: '🏛', label: 'Cơ cấu Tổ chức' },
          { key: 'chuong_trinh', icon: '📋', label: 'Chương trình KT-GS' },
          { key: 'ho_so_dia_ban', icon: '📍', label: 'Hồ sơ địa bàn' },
          { key: 'don_thu', icon: '📬', label: 'Quản lý Đơn thư' },
          { key: 'lich_thang', icon: '📅', label: 'Lịch theo tháng' },
          { key: 'kho_pdf', icon: '🗄️', label: 'Kho dữ liệu' },
          { key: 'thong_ke', icon: '📊', label: 'Thống kê' },
        ];

  const SIDEBAR_W = sidebarCollapsed ? 60 : 220;
  const currentTabLabel = menuItems.find((m) => m.key === activeTab)?.label ?? 'Tổng quan';

  const handleSelectTab = (tab: TabKey) => {
    onTabChange(tab);
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  };

  const handleLogoClick = () => {
    try {
      localStorage.setItem('ubkt_active_tab', 'tong_quan');
    } catch {}
    onTabChange('tong_quan');
    onRefresh();
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  };

  // Render nội dung bên trong sidebar/ngăn kéo
  const renderSidebarInner = (isDrawer = false) => {
    const isCollapsed = isDrawer ? false : sidebarCollapsed;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
        {/* Logo & Header Sidebar */}
        <div
          style={{
            padding: isCollapsed ? '12px 10px' : '12px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minHeight: isDrawer ? 68 : 64,
          }}
        >
          <div
            onClick={handleLogoClick}
            title="Bấm vào logo để đồng bộ dữ liệu nền và quay về trang tổng quan"
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
                width: isCollapsed ? 38 : 42,
                height: isCollapsed ? 38 : 42,
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
                border: '2px solid rgba(245,197,24,0.7)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.30)',
                transition: 'width 0.25s, height 0.25s',
              }}
            />
            {!isCollapsed && (
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#f5c518',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    lineHeight: 1.25,
                  }}
                >
                  Phần mềm nghiệp vụ kiểm tra, giám sát
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#e2e8f0',
                    lineHeight: 1.3,
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={currentUser.ten_don_vi || appInfo?.root_unit_name || 'Đảng ủy cơ sở'}
                >
                  {currentUser.ten_don_vi || appInfo?.root_unit_name || 'Đảng ủy cơ sở'}
                </div>
              </div>
            )}
          </div>

          {/* Nút thu gọn trên Desktop hoặc nút Đóng trên Mobile Drawer */}
          {isDrawer ? (
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              aria-label="Đóng ngăn kéo"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 18,
                width: 44,
                height: 44,
                minWidth: 44,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          ) : (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                fontSize: 16,
                padding: 4,
                flexShrink: 0,
              }}
            >
              {sidebarCollapsed ? '›' : '‹'}
            </button>
          )}
        </div>

        {/* Danh sách mục Menu */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto', overflowX: 'hidden' }}>
          {menuItems.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                id={`menu-${item.key}`}
                onClick={() => handleSelectTab(item.key)}
                title={isCollapsed ? item.label : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: isCollapsed ? '10px 0' : '10px 18px',
                  minHeight: isDrawer ? 46 : isCollapsed ? 40 : 40,
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  border: 'none',
                  borderLeft: active ? '3px solid #f5c518' : '3px solid transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.70)',
                  cursor: 'pointer',
                  fontSize: isDrawer ? 14 : 13,
                  fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <span style={{ fontSize: isDrawer ? 18 : 16, flexShrink: 0 }}>{item.icon}</span>
                {!isCollapsed && <span>{item.label}</span>}
                {!isCollapsed && item.badge && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      background: '#e53e3e',
                      color: '#fff',
                      borderRadius: 10,
                      fontSize: 10,
                      padding: '1px 6px',
                      fontWeight: 700,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Thông tin người dùng ở đáy */}
        <div
          style={{
            padding: isCollapsed ? '12px 0' : '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minHeight: isDrawer ? 54 : 48,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {currentUser.ho_ten.charAt(0).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#e2e8f0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {currentUser.ho_ten}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)' }}>
                {ROLE_LABEL[currentUser.vai_tro as string] ?? currentUser.vai_tro}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100dvh',
        maxHeight: '100dvh',
        minHeight: '100vh',
        overflow: 'hidden',
        fontFamily: "'Segoe UI', 'Inter', sans-serif",
        background: '#f0f2f5',
      }}
    >
      {/* ── 1. SIDEBAR TRÊN MÁY TÍNH (Từ 768px trở lên) ────────────────── */}
      {!isMobile && (
        <aside
          style={{
            width: SIDEBAR_W,
            minWidth: SIDEBAR_W,
            background: 'linear-gradient(180deg, #1a3a5c 0%, #122d4a 100%)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.25s ease',
            overflow: 'hidden',
            zIndex: 100,
            boxShadow: '2px 0 8px rgba(0,0,0,0.25)',
          }}
        >
          {renderSidebarInner(false)}
        </aside>
      )}

      {/* ── 2. NGĂN KÉO DI ĐỘNG (Dưới 768px: Drawer đè lên nội dung) ────── */}
      {isMobile && mobileDrawerOpen && (
        <>
          {/* Lớp nền mờ che phủ phía sau */}
          <div
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(2px)',
              zIndex: 999,
              transition: 'opacity 0.25s ease',
            }}
          />

          {/* Khung ngăn kéo trượt từ trái */}
          <aside
            style={{
              position: 'fixed',
              top: 0,
              bottom: 0,
              left: 0,
              width: 'min(280px, 85vw)',
              maxWidth: 280,
              background: 'linear-gradient(180deg, #1a3a5c 0%, #122d4a 100%)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1000,
              boxShadow: '4px 0 20px rgba(0,0,0,0.40)',
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              paddingLeft: 'env(safe-area-inset-left, 0px)',
              boxSizing: 'border-box',
            }}
          >
            {renderSidebarInner(true)}
          </aside>
        </>
      )}

      {/* ── 3. VÙNG NỘI DUNG CHÍNH (MAIN AREA) ─────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Thanh trên cùng (Header) */}
        <header
          style={{
            height: isMobile ? 'calc(52px + env(safe-area-inset-top, 0px))' : 52,
            paddingTop: isMobile ? 'env(safe-area-inset-top, 0px)' : 0,
            paddingLeft: isMobile ? 'max(10px, env(safe-area-inset-left, 0px))' : 20,
            paddingRight: isMobile ? 'max(10px, env(safe-area-inset-right, 0px))' : 20,
            background: '#fff',
            borderBottom: '1px solid #e8ecf0',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 8 : 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            flexShrink: 0,
            zIndex: 50,
            boxSizing: 'border-box',
          }}
        >
          {/* Nút ☰ mở menu (Chỉ hiện trên điện thoại) */}
          {isMobile && (
            <button
              type="button"
              id="btn-mobile-menu"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Mở danh mục điều hướng"
              style={{
                width: 44,
                height: 44,
                minWidth: 44,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 22,
                color: '#1a3a5c',
                padding: 0,
                borderRadius: 8,
                flexShrink: 0,
              }}
            >
              ☰
            </button>
          )}

          {/* Tiêu đề trang / Breadcrumb */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', minWidth: 0 }}>
            {!isMobile ? (
              <>
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 800,
                    color: '#1a3a5c',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  PHẦN MỀM NGHIỆP VỤ KIỂM TRA, GIÁM SÁT
                </span>
                <span style={{ color: '#cbd5e1' }}>/</span>
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {currentTabLabel}
                </span>
              </>
            ) : (
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#1a3a5c',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={currentTabLabel}
              >
                {currentTabLabel}
              </span>
            )}
          </div>

          {/* Nút Đồng bộ Cloud Firebase */}
          {isAdmin ? (
            <button
              type="button"
              onClick={onOpenCloudSync}
              title={`Đồng bộ Đám mây Realtime (onSnapshot) - Lần cuối: ${lastSyncTime || 'Chưa rõ'}`}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: isMobile ? '0 10px' : '4px 10px',
                height: isMobile ? 44 : undefined,
                minHeight: isMobile ? 44 : undefined,
                cursor: 'pointer',
                color: '#334155',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
                minWidth: isMobile ? 44 : 175,
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.2s ease, border-color 0.2s ease',
              }}
            >
              <span style={{ fontSize: isMobile ? 16 : 13, display: 'inline-block' }}>☁️</span>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 6px rgba(16,185,129,0.8)',
                  display: 'inline-block',
                }}
              />
              {!isMobile && (
                <span>{lastSyncTime ? `Realtime Cloud · ${lastSyncTime}` : 'Realtime Cloud'}</span>
              )}
            </button>
          ) : (
            <div
              title={`Realtime Cloud - Lần cuối: ${lastSyncTime || 'Chưa rõ'}`}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: isMobile ? '0 10px' : '4px 10px',
                height: isMobile ? 44 : undefined,
                minHeight: isMobile ? 44 : undefined,
                cursor: 'default',
                color: '#334155',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
                minWidth: isMobile ? 44 : 175,
                justifyContent: 'center',
                flexShrink: 0,
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: isMobile ? 16 : 13, display: 'inline-block' }}>☁️</span>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 6px rgba(16,185,129,0.8)',
                  display: 'inline-block',
                }}
              />
              {!isMobile && (
                <span>{lastSyncTime ? `Realtime Cloud · ${lastSyncTime}` : 'Realtime Cloud'}</span>
              )}
            </div>
          )}

          {/* Trạng thái Trực tuyến / Nút Đồng bộ ngay */}
          <button
            type="button"
            onClick={onRefresh}
            title="Đồng bộ đầy đủ 2 chiều ngay lập tức với Firestore Cloud"
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 6,
              padding: isMobile ? '0 10px' : '4px 10px',
              height: isMobile ? 44 : undefined,
              minHeight: isMobile ? 44 : undefined,
              cursor: 'pointer',
              color: '#166534',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 500,
              flexShrink: 0,
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                width: isMobile ? 9 : 7,
                height: isMobile ? 9 : 7,
                borderRadius: '50%',
                background: isSyncing ? '#eab308' : '#22c55e',
                display: 'inline-block',
                boxShadow: '0 0 6px rgba(34,197,94,0.6)',
                animation: isSyncing ? 'pulse 1s infinite' : 'none',
              }}
            />
            {!isMobile && <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>}
          </button>

          {/* Chuông nhắc việc */}
          <div style={{ flexShrink: 0 }}>
            <NotificationBell
              key={currentUser.id}
              currentUser={currentUser}
              onNavigate={(tab) => handleSelectTab(tab)}
            />
          </div>

          {/* Menu người dùng */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              id="btn-user-menu"
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-label="Menu tài khoản người dùng"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: isMobile ? '4px 8px' : '5px 10px',
                height: isMobile ? 44 : undefined,
                minHeight: isMobile ? 44 : undefined,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: isMobile ? 28 : 26,
                  height: isMobile ? 28 : 26,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {currentUser.ho_ten.charAt(0).toUpperCase()}
              </div>
              {!isMobile && (
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#2d3748', lineHeight: 1.2 }}>
                    {currentUser.ho_ten}
                  </div>
                  <div style={{ fontSize: 10, color: '#718096' }}>
                    {ROLE_LABEL[currentUser.vai_tro as string]}
                  </div>
                </div>
              )}
              <span style={{ color: '#a0aec0', fontSize: 12 }}>▾</span>
            </button>

            {showUserMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '6px 0',
                  minWidth: isMobile ? 220 : 200,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  zIndex: 999,
                }}
                onMouseLeave={() => setShowUserMenu(false)}
              >
                {[
                  {
                    icon: '👥',
                    label: 'Quản lý tài khoản',
                    id: 'menu-user-manager',
                    action: onOpenUserManager,
                    adminOnly: true,
                  },
                  {
                    icon: '📜',
                    label: 'Nhật ký hoạt động',
                    id: 'menu-audit-log',
                    action: onOpenAuditLogs,
                  },
                  {
                    icon: '🔑',
                    label: 'Đổi mật khẩu',
                    id: 'menu-change-pw',
                    action: onChangePassword,
                  },
                  ...(onLockSession
                    ? [
                        {
                          icon: '🔒',
                          label: 'Khóa màn hình',
                          id: 'menu-lock-screen',
                          action: onLockSession,
                        },
                      ]
                    : []),
                  null,
                  {
                    icon: '🚪',
                    label: 'Đăng xuất',
                    id: 'menu-logout',
                    action: onLogout,
                    danger: true,
                  },
                ].map((item, i) => {
                  if (!item) {
                    return <div key={i} style={{ height: 1, background: '#f0f2f5', margin: '4px 0' }} />;
                  }
                  if ((item as { adminOnly?: boolean }).adminOnly && currentUser.vai_tro !== 'ADMIN') {
                    return null;
                  }
                  return (
                    <button
                      key={(item as { id: string }).id}
                      id={(item as { id: string }).id}
                      type="button"
                      onClick={() => {
                        (item as { action: () => void }).action();
                        setShowUserMenu(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: isMobile ? '12px 16px' : '9px 16px',
                        minHeight: isMobile ? 44 : undefined,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 13,
                        color: (item as { danger?: boolean }).danger ? '#e53e3e' : '#4a5568',
                        textAlign: 'left',
                      }}
                    >
                      <span>{(item as { icon: string }).icon}</span>
                      <span>{(item as { label: string }).label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </header>

        {/* Vùng nội dung trang (Page content) */}
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            padding: isMobile ? '10px 12px' : 20,
            minHeight: isMobile ? undefined : 560,
          }}
        >
          {children}
        </main>

        {/* Thanh trạng thái chân trang (Status bar) */}
        <div
          style={{
            height: isMobile ? 'calc(26px + env(safe-area-inset-bottom, 0px))' : 26,
            paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : 0,
            background: '#1a3a5c',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: isMobile ? 'max(12px, env(safe-area-inset-left, 0px))' : 16,
            paddingRight: isMobile ? 'max(12px, env(safe-area-inset-right, 0px))' : 16,
            gap: isMobile ? 8 : 16,
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
            {isMobile ? '📦 v1.0.0' : '📦 v1.0.0 | Phần mềm Quản lý Chương trình Kiểm tra, Giám sát của Đảng'}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: 'rgba(255,255,255,0.7)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            🏛 {appInfo?.total_don_vi ?? '--'} đơn vị {isMobile ? '' : '| 🌐 Trực tuyến (Máy chủ tập trung)'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
