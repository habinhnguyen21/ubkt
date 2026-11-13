import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { api } from './services/api';
import type { AppInfo, User } from './types';
import { AppLayout } from './components/AppLayout';
import { Dashboard } from './components/Dashboard';
import { LoginModal } from './components/LoginModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { LockScreen } from './components/LockScreen';
import { DonViManager } from './components/DonViManager';
import { ChuongTrinhManager } from './components/ChuongTrinhManager';
import { LichThangManager } from './components/LichThangManager';
import { KhoPdfManager } from './components/KhoPdfManager';
import { AuditLogModal } from './components/AuditLogModal';
import UserManager from './components/UserManager';
import { HoSoDiaBanManager } from './components/HoSoDiaBanManager';
import { DonThuManager } from './components/DonThuManager';
import { CloudSyncModal } from './components/CloudSyncModal';
import { VersionConflictModal } from './components/VersionConflictModal';
import { cloudSyncService } from './services/cloudSyncService';
import { centralDataService } from './services/centralDataService';
import { auth, db as firestoreDb } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { isSameData } from './utils/syncUtils';
import { sessionStore, SESSION_IDLE_TIMEOUT_MS } from './utils/sessionStore';

const ThongKeManager = lazy(() => import('./components/ThongKeManager'));
const BaoCaoManager = lazy(() => import('./components/BaoCaoManager'));

type TabKey = 'tong_quan' | 'don_vi' | 'phan_cong' | 'chuong_trinh' | 'ho_so_dia_ban' | 'don_thu' | 'lich_thang' | 'kho_pdf' | 'thong_ke' | 'bao_cao';

const HASH_TO_TAB: Record<string, TabKey> = {
  '#tong-quan': 'tong_quan',
  '#tong_quan': 'tong_quan',
  '#don-vi': 'don_vi',
  '#don_vi': 'don_vi',
  '#phan-cong': 'phan_cong',
  '#phan_cong': 'phan_cong',
  '#chuong-trinh': 'chuong_trinh',
  '#chuong_trinh': 'chuong_trinh',
  '#ho-so-dia-ban': 'ho_so_dia_ban',
  '#ho_so_dia_ban': 'ho_so_dia_ban',
  '#don-thu': 'don_thu',
  '#don_thu': 'don_thu',
  '#lich-thang': 'lich_thang',
  '#lich_thang': 'lich_thang',
  '#kho-pdf': 'kho_pdf',
  '#kho_pdf': 'kho_pdf',
  '#thong-ke': 'thong_ke',
  '#thong_ke': 'thong_ke',
  '#bao-cao': 'bao_cao',
  '#bao_cao': 'bao_cao',
};

export { SESSION_IDLE_TIMEOUT_MS };

// Khởi tạo trạng thái môi trường chính thức
if (typeof window !== 'undefined') {
  try {
    const isCleaned = localStorage.getItem('ubkt_prod_clean_done');
    if (!isCleaned) {
      localStorage.setItem('ubkt_prod_clean_done', 'true');
    }
  } catch {
    // ignore
  }
}

export function App() {
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [showUserManager, setShowUserManager] = useState(false);
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
  const [isSessionLocked, setIsSessionLocked] = useState<boolean>(() => sessionStore.isSessionLocked());

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const fromHash = HASH_TO_TAB[window.location.hash.toLowerCase()];
      if (fromHash) return fromHash;
    }
    const saved = localStorage.getItem('ubkt_active_tab');
    const validTabs: TabKey[] = ['tong_quan', 'don_vi', 'phan_cong', 'chuong_trinh', 'ho_so_dia_ban', 'don_thu', 'lich_thang', 'kho_pdf', 'thong_ke', 'bao_cao'];
    if (saved && validTabs.includes(saved as TabKey)) {
      return saved as TabKey;
    }
    return 'tong_quan';
  });

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    localStorage.setItem('ubkt_active_tab', tab);
    const hashMap: Record<TabKey, string> = {
      tong_quan: '#tong-quan',
      don_vi: '#don-vi',
      phan_cong: '#phan-cong',
      chuong_trinh: '#chuong-trinh',
      ho_so_dia_ban: '#ho-so-dia-ban',
      don_thu: '#don-thu',
      lich_thang: '#lich-thang',
      kho_pdf: '#kho-pdf',
      thong_ke: '#thong-ke',
      bao_cao: '#bao-cao',
    };
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname + (hashMap[tab] || ''));
    }
  }, []);

  // Kiểm tra điều hướng trực tiếp bằng URL (Hash, Query Param, Path)
  const checkUrlRouting = useCallback((user: User | null) => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    const isRequestingPhanCong =
      hash.includes('phan-cong') ||
      hash.includes('phan_cong') ||
      search.includes('tab=phan_cong') ||
      search.includes('tab=phan-cong') ||
      search.includes('sub=phan_cong') ||
      search.includes('sub=phan-cong') ||
      pathname.endsWith('/phan-cong') ||
      pathname.endsWith('/phan_cong');

    if (isRequestingPhanCong) {
      if (!user) return;

      if (user.vai_tro === 'ADMIN') {
        setActiveTab('phan_cong');
      } else {
        // BIÊN TẬP VIÊN: TỪ CHỐI TRUY CẬP TRỰC TIẾP
        setActiveTab('don_vi');
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname + '#don-vi');
        } else {
          window.location.hash = '#don-vi';
        }
        setAccessDeniedMessage('Từ chối truy cập: Tài khoản Biên tập viên không có quyền truy cập trực tiếp phân hệ Phân công quản lý.');
        setTimeout(() => setAccessDeniedMessage(null), 5000);
      }
      return;
    }

    const targetTab = HASH_TO_TAB[hash];
    if (targetTab) {
      if (targetTab === 'phan_cong') {
        if (user?.vai_tro === 'ADMIN') {
          setActiveTab('phan_cong');
        } else {
          setActiveTab('don_vi');
        }
      } else {
        setActiveTab(targetTab);
      }
    }
  }, []);

  useEffect(() => {
    checkUrlRouting(currentUser);
    const handleHash = () => checkUrlRouting(currentUser);
    window.addEventListener('hashchange', handleHash);
    window.addEventListener('popstate', handleHash);
    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('popstate', handleHash);
    };
  }, [currentUser, checkUrlRouting]);

  const fetchAppInfo = useCallback(async () => {
    try {
      const info = await api.getAppInfo();
      setAppInfo((prev) => (isSameData(prev, info) ? prev : info));
    } catch (err) {
      // Giữ nguyên dữ liệu cũ khi lỗi
      console.warn('Lỗi lấy thông tin hệ thống:', err);
    }
  }, []);

  useEffect(() => {
    fetchAppInfo();
    const handleDataSynced = () => {
      fetchAppInfo();
    };
    window.addEventListener('ubkt_data_synced', handleDataSynced);

    let cleanupRealtime = () => {};

    // Khởi tạo bộ lắng nghe xác thực Firebase Auth và đồng bộ Firestore
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      cleanupRealtime();
      if (firebaseUser) {
        // 1. Kiểm tra hết hạn tuyệt đối (12 giờ)
        if (sessionStore.isSessionExpired()) {
          console.warn('[App] Phiên đăng nhập đã hết hạn tuyệt đối 12 giờ.');
          sessionStore.clearSession();
          await signOut(auth).catch(() => {});
          setCurrentUser(null);
          setIsSessionLocked(false);
          setIsAuthChecking(false);
          return;
        }

        // 2. Không tin riêng dữ liệu trong storage: Firebase UID phải khớp với ID bản ghi trong storage
        const storedUser = sessionStore.getCurrentUser();
        if (!storedUser || storedUser.id !== firebaseUser.uid) {
          console.warn('[App] Không tìm thấy phiên hoặc Firebase UID không khớp với tài khoản trong storage! Buộc đăng xuất.');
          sessionStore.clearSession();
          await signOut(auth).catch(() => {});
          setCurrentUser(null);
          setIsSessionLocked(false);
          setIsAuthChecking(false);
          return;
        }

        // 3. Xác thực vai trò và trạng thái chống can thiệp từ DevTools
        let verifiedUser: User = storedUser;
        try {
          const userDocSnap = await getDoc(doc(firestoreDb, 'users', firebaseUser.uid));
          if (userDocSnap.exists()) {
            const cloudUser = userDocSnap.data() as User;
            if (cloudUser.trang_thai === 0) {
              console.warn('[App] Tài khoản đang bị tạm khóa.');
              sessionStore.clearSession();
              await signOut(auth).catch(() => {});
              setCurrentUser(null);
              setIsSessionLocked(false);
              setIsAuthChecking(false);
              return;
            }
            if (storedUser.vai_tro !== cloudUser.vai_tro) {
              console.warn('[App] Phát hiện sai lệch vai trò giữa storage và máy chủ! Buộc đăng xuất.');
              sessionStore.clearSession();
              await signOut(auth).catch(() => {});
              setCurrentUser(null);
              setIsSessionLocked(false);
              setIsAuthChecking(false);
              return;
            }
            verifiedUser = { ...storedUser, ...cloudUser, id: firebaseUser.uid };
            sessionStore.setCurrentUser(verifiedUser);
          }
        } catch (fetchErr) {
          console.warn('[App] Không thể kiểm tra vai trò người dùng từ Firestore:', fetchErr);
        }

        // 4. Kiểm tra thời gian không thao tác (idle timeout > 15 phút)
        if (sessionStore.isIdleTimedOut() || sessionStore.isSessionLocked()) {
          sessionStore.setSessionLocked(true);
          setIsSessionLocked(true);
        } else {
          sessionStore.recordActivity(true);
        }

        setCurrentUser(verifiedUser);
        setIsAuthChecking(false);

        cleanupRealtime = centralDataService.initRealtimeSync();
        centralDataService.ensureProductionSeed().catch((err) => {
          console.warn('[App] Lỗi kiểm tra seed dữ liệu gốc:', err);
        });
        cloudSyncService.startAutoSync();
        cloudSyncService.performTwoWaySync(true).catch((err) => {
          console.warn('[App] Lỗi đồng bộ đám mây ban đầu:', err);
        });
      } else {
        // Firebase không có phiên đăng nhập hợp lệ -> Xóa sạch storage
        sessionStore.clearSession();
        setCurrentUser(null);
        setIsSessionLocked(false);
        setIsAuthChecking(false);
        cloudSyncService.stopAutoSync();
      }
    });

    return () => {
      window.removeEventListener('ubkt_data_synced', handleDataSynced);
      cloudSyncService.stopAutoSync();
      cleanupRealtime();
      unsubAuth();
    };
  }, [fetchAppInfo]);

  // Lắng nghe sự kiện điều hướng tab giữa các phân hệ (vd: link từ Chương trình nhiệm kỳ sang Hồ sơ địa bàn)
  useEffect(() => {
    const handleNav = (e: Event) => {
      const ce = e as CustomEvent<{ tab: TabKey; donViId?: string }>;
      if (ce.detail?.tab) {
        handleTabChange(ce.detail.tab);
      }
    };
    window.addEventListener('ubkt_navigate', handleNav);
    return () => window.removeEventListener('ubkt_navigate', handleNav);
  }, [handleTabChange]);

  const handleLockSession = useCallback(() => {
    setIsSessionLocked(true);
    sessionStore.setSessionLocked(true);
  }, []);

  const handleUnlockSession = useCallback(() => {
    setIsSessionLocked(false);
    sessionStore.setSessionLocked(false);
    sessionStore.recordActivity(true);
  }, []);

  // Tự động khóa phiên làm việc (LockScreen) sau SESSION_IDLE_TIMEOUT_MS (15 phút) không có thao tác chuột/bàn phím/chạm
  useEffect(() => {
    if (!currentUser || isSessionLocked) return;

    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const resetIdleTimer = () => {
      sessionStore.recordActivity();
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        handleLockSession();
      }, SESSION_IDLE_TIMEOUT_MS);
    };

    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (sessionStore.isIdleTimedOut()) {
        handleLockSession();
      } else {
        resetIdleTimer();
      }
    };

    const activityEvents: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
    ];

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, resetIdleTimer, { passive: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    resetIdleTimer();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, resetIdleTimer);
      });
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [currentUser, isSessionLocked, handleLockSession]);

  const handleLoginSuccess = (user: User, token: string, rememberMe = false) => {
    sessionStore.saveSession(user, token, rememberMe);
    setCurrentUser(user);
    setIsSessionLocked(false);
    fetchAppInfo();
    checkUrlRouting(user);
  };

  const handleLogout = useCallback(() => {
    centralDataService.stopRealtimeSync();
    cloudSyncService.stopAutoSync();
    signOut(auth).catch(() => {});
    api.logout().catch(() => {});
    sessionStore.clearSession();
    setCurrentUser(null);
    setIsSessionLocked(false);
    if (typeof window !== 'undefined' && window.location.hash) {
      window.location.hash = '';
    }
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await cloudSyncService.performTwoWaySync(false);
      await fetchAppInfo();
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Render nội dung theo tab ─────────────────────────────────────────────
  function renderContent() {
    if (!currentUser) return null;
    switch (activeTab) {
      case 'tong_quan':
        return <Dashboard currentUser={currentUser} appInfo={appInfo} />;
      case 'don_vi':
        return (
          <DonViManager
            user={currentUser}
            onDataChanged={fetchAppInfo}
            mode="to_chuc"
          />
        );
      case 'phan_cong':
        return (
          <DonViManager
            user={currentUser}
            onDataChanged={fetchAppInfo}
            mode="phan_cong"
          />
        );
      case 'chuong_trinh':
        return <ChuongTrinhManager user={currentUser} onDataChanged={fetchAppInfo} />;
      case 'ho_so_dia_ban':
        return <HoSoDiaBanManager user={currentUser} />;
      case 'don_thu':
        return <DonThuManager user={currentUser} onDataChanged={fetchAppInfo} />;
      case 'lich_thang':
        return <LichThangManager user={currentUser} />;
      case 'kho_pdf':
        return <KhoPdfManager user={currentUser} onDataChanged={fetchAppInfo} />;
      case 'thong_ke':
        return (
          <Suspense
            fallback={
              <div className="w-full py-20 flex flex-col items-center justify-center gap-3 text-slate-500 font-sans">
                <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold">Đang nạp phân hệ Thống kê...</p>
              </div>
            }
          >
            <ThongKeManager user={currentUser} />
          </Suspense>
        );
      case 'bao_cao':
        return (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center p-12 text-slate-500 space-y-3">
                <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold">Đang nạp phân hệ Báo cáo...</p>
              </div>
            }
          >
            <BaoCaoManager user={currentUser} />
          </Suspense>
        );
      default:
        return <Dashboard currentUser={currentUser} appInfo={appInfo} />;
    }
  }

  return (
    <>
      {/* Thông báo từ chối truy cập nếu Biên tập viên mở trực tiếp URL cấm */}
      {accessDeniedMessage && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: '#fee2e2', border: '1.5px solid #ef4444',
          color: '#991b1b', padding: '12px 18px', borderRadius: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)', fontSize: 13,
          fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span>⛔</span>
          <span>{accessDeniedMessage}</span>
          <button
            onClick={() => setAccessDeniedMessage(null)}
            style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: 16, marginLeft: 8 }}
          >
            ✕
          </button>
        </div>
      )}
      {/* Màn hình kiểm tra phiên lúc khởi động */}
      {isAuthChecking && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8fafc',
            fontFamily: "'Segoe UI', sans-serif",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: '3.5px solid #e2e8f0',
              borderTopColor: '#c8282c',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              marginBottom: 14,
            }}
          />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#64748b', margin: 0 }}>
            Đang kiểm tra phiên làm việc...
          </p>
        </div>
      )}

      {/* Nếu chưa đăng nhập → chỉ hiện màn hình đăng nhập */}
      {!isAuthChecking && !currentUser && (
        <LoginModal onLoginSuccess={handleLoginSuccess} />
      )}

      {/* Ứng dụng chính sau đăng nhập */}
      {currentUser && (
        <AppLayout
          currentUser={currentUser}
          appInfo={appInfo}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          onLockSession={handleLockSession}
          onChangePassword={() => setShowChangePasswordModal(true)}
          onOpenAuditLogs={() => setShowAuditLogs(true)}
          onOpenUserManager={() => setShowUserManager(true)}
          onOpenCloudSync={() => setShowCloudSyncModal(true)}
          isSyncing={isSyncing}
          onRefresh={handleManualSync}
        >
          {renderContent()}
        </AppLayout>
      )}

      {/* Màn hình tự động khóa phiên sau 15 phút không thao tác */}
      {currentUser && isSessionLocked && (
        <LockScreen
          user={currentUser}
          onUnlock={handleUnlockSession}
          onLogout={handleLogout}
        />
      )}

      {/* Modal đổi mật khẩu */}
      {currentUser && (currentUser.must_change_password || showChangePasswordModal) && (
        <ChangePasswordModal
          user={currentUser}
          isMandatory={currentUser.must_change_password}
          onSuccess={() => {
            const updated = { ...currentUser, must_change_password: false };
            setCurrentUser(updated);
            sessionStore.setCurrentUser(updated);
            setShowChangePasswordModal(false);
            fetchAppInfo();
          }}
          onClose={
            currentUser.must_change_password ? undefined : () => setShowChangePasswordModal(false)
          }
        />
      )}

      {/* Modal Nhật ký */}
      {showAuditLogs && (
        <AuditLogModal onClose={() => setShowAuditLogs(false)} />
      )}

      {/* Modal Quản lý người dùng */}
      {showUserManager && currentUser && (
        <UserManager
          currentUser={currentUser}
          onClose={() => {
            setShowUserManager(false);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
            }
          }}
        />
      )}

      {/* Modal Đồng bộ Đám mây Cloud */}
      <CloudSyncModal
        isOpen={showCloudSyncModal}
        onClose={() => setShowCloudSyncModal(false)}
        onSynced={fetchAppInfo}
      />

      {/* Modal xử lý xung đột phiên bản khi ghi (Optimistic Concurrency Control) */}
      <VersionConflictModal />
    </>
  );
}

export default App;
