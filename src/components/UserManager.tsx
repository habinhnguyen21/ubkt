import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { User } from '../types';

interface Props {
  currentUser: User;
  onClose: () => void;
}

type ModalMode = 'create' | 'edit' | 'reset_password' | 'delete' | null;

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  BIEN_TAP: 'Biên tập viên',
  XEM: 'Chỉ xem',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#ef4444',
  BIEN_TAP: '#3b82f6',
  XEM: '#6b7280',
};

export const CHUC_DANH_UBKT_OPTIONS = [
  'Chủ nhiệm UBKT',
  'Phó Chủ nhiệm UBKT',
  'Uỷ viên UBKT',
  'Chuyên viên UBKT',
  'Khác',
] as const;

export default function UserManager({ currentUser, onClose }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form state
  const [formTenDangNhap, setFormTenDangNhap] = useState('');
  const [formHoTen, setFormHoTen] = useState('');
  const [formMatKhau, setFormMatKhau] = useState('');
  const [formVaiTro, setFormVaiTro] = useState('XEM');
  const [formChucDanh, setFormChucDanh] = useState<string>('Chuyên viên UBKT');
  const [formTrangThai, setFormTrangThai] = useState(1);
  const [formNewPw, setFormNewPw] = useState('');
  const [formNewPw2, setFormNewPw2] = useState('');
  const [showPw, setShowPw] = useState(false);

  const isAdmin = currentUser.vai_tro === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await api.getAllUsers();
      setUsers(list);
    } catch (e: unknown) {
      setError((e as Error).message || 'Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = users.filter(
    (u) =>
      u.ho_ten.toLowerCase().includes(search.toLowerCase()) ||
      u.ten_dang_nhap.toLowerCase().includes(search.toLowerCase()) ||
      (u.chuc_danh && u.chuc_danh.toLowerCase().includes(search.toLowerCase())),
  );

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  // ── Mở modal ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setFormTenDangNhap('');
    setFormHoTen('');
    setFormMatKhau('');
    setFormVaiTro('XEM');
    setFormChucDanh('Chuyên viên UBKT');
    setFormNewPw('');
    setFormNewPw2('');
    setShowPw(false);
    setModalMode('create');
    setError('');
  };

  const openEdit = (u: User) => {
    setSelectedUser(u);
    setFormHoTen(u.ho_ten);
    setFormVaiTro(u.vai_tro as string);
    setFormChucDanh(u.chuc_danh || 'Chuyên viên UBKT');
    setFormTrangThai(u.trang_thai);
    setModalMode('edit');
    setError('');
  };

  const openReset = (u: User) => {
    setSelectedUser(u);
    setFormNewPw('');
    setFormNewPw2('');
    setShowPw(false);
    setModalMode('reset_password');
    setError('');
  };

  const openDelete = (u: User) => {
    setSelectedUser(u);
    setModalMode('delete');
    setError('');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedUser(null);
    setError('');
  };

  // ── Hành động ─────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!formTenDangNhap.trim()) return setError('Tên đăng nhập không được để trống');
    if (!formHoTen.trim()) return setError('Họ tên không được để trống');
    if (formMatKhau.length < 8) return setError('Mật khẩu phải có ít nhất 8 ký tự');
    setLoading(true);
    setError('');
    try {
      await api.createUser(
        {
          ten_dang_nhap: formTenDangNhap.trim(),
          ho_ten: formHoTen.trim(),
          mat_khau: formMatKhau,
          vai_tro: formVaiTro,
          chuc_danh: formChucDanh,
        },
        currentUser.id,
        currentUser.ho_ten,
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
      }
      await load();
      closeModal();
      showSuccess(`Đã tạo tài khoản "${formTenDangNhap}" thành công. Người dùng sẽ phải đổi mật khẩu khi đăng nhập lần đầu.`);
    } catch (e: unknown) {
      setError((e as Error).message || 'Tạo tài khoản thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    if (!formHoTen.trim()) return setError('Họ tên không được để trống');
    setLoading(true);
    setError('');
    try {
      await api.updateUser(
        {
          user_id: selectedUser.id,
          ho_ten: formHoTen.trim(),
          vai_tro: formVaiTro,
          trang_thai: formTrangThai,
          chuc_danh: formChucDanh,
        },
        currentUser.id,
        currentUser.ho_ten,
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
      }
      await load();
      closeModal();
      showSuccess('Đã cập nhật thông tin tài khoản thành công');
    } catch (e: unknown) {
      setError((e as Error).message || 'Cập nhật thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!selectedUser) return;
    if (formNewPw.length < 8) return setError('Mật khẩu mới phải có ít nhất 8 ký tự');
    if (formNewPw !== formNewPw2) return setError('Xác nhận mật khẩu không khớp');
    setLoading(true);
    setError('');
    try {
      await api.resetUserPassword(
        { user_id: selectedUser.id, mat_khau_moi: formNewPw },
        currentUser.id,
        currentUser.ho_ten,
      );
      await load();
      closeModal();
      showSuccess(`Đã đặt lại mật khẩu cho "${selectedUser.ho_ten}". Họ sẽ phải đổi mật khẩu khi đăng nhập lần tiếp theo.`);
    } catch (e: unknown) {
      setError((e as Error).message || 'Đặt lại mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setLoading(true);
    setError('');
    try {
      await api.deleteUser(selectedUser.id, currentUser.id, currentUser.ho_ten);
      await load();
      closeModal();
      showSuccess(`Đã xóa tài khoản "${selectedUser.ho_ten}"`);
    } catch (e: unknown) {
      setError((e as Error).message || 'Xóa tài khoản thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        {/* Header */}
        <div style={styles.panelHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>👥</span>
            <div>
              <div style={styles.panelTitle}>Quản lý Tài khoản</div>
              <div style={styles.panelSubtitle}>Cấp phát, chỉnh sửa và đặt lại mật khẩu tài khoản</div>
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Toast */}
        {success && (
          <div style={styles.toast}>
            <span>✅</span> {success}
          </div>
        )}

        {/* Toolbar */}
        <div style={styles.toolbar}>
          <div style={styles.searchWrap}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              id="user-search"
              style={styles.searchInput}
              placeholder="Tìm theo tên đăng nhập hoặc họ tên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isAdmin && (
            <button id="btn-create-user" style={styles.btnPrimary} onClick={openCreate}>
              + Thêm tài khoản
            </button>
          )}
        </div>

        {/* Table */}
        <div style={styles.tableWrap}>
          {loading && !modalMode ? (
            <div style={styles.loadingMsg}>Đang tải...</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Họ và Tên</th>
                  <th style={styles.th}>Chức danh UBKT</th>
                  <th style={styles.th}>Tên đăng nhập</th>
                  <th style={styles.th}>Vai trò</th>
                  <th style={styles.th}>Trạng thái</th>
                  <th style={styles.th}>Bảo mật</th>
                  {isAdmin && <th style={{ ...styles.th, textAlign: 'center' }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, idx) => (
                  <tr key={u.id} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ ...styles.avatar, background: u.vai_tro === 'ADMIN' ? '#7c3aed' : u.vai_tro === 'BIEN_TAP' ? '#1d4ed8' : '#374151' }}>
                          {u.ho_ten.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500, color: '#f1f5f9' }}>{u.ho_ten}</span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          background:
                            u.chuc_danh === 'Chủ nhiệm UBKT'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : u.chuc_danh === 'Phó Chủ nhiệm UBKT'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : u.chuc_danh === 'Uỷ viên UBKT'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : 'rgba(148, 163, 184, 0.12)',
                          color:
                            u.chuc_danh === 'Chủ nhiệm UBKT'
                              ? '#f87171'
                              : u.chuc_danh === 'Phó Chủ nhiệm UBKT'
                              ? '#fbbf24'
                              : u.chuc_danh === 'Uỷ viên UBKT'
                              ? '#60a5fa'
                              : '#cbd5e1',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        🎖️ {u.chuc_danh || 'Chuyên viên UBKT'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, color: '#94a3b8', fontFamily: 'monospace' }}>{u.ten_dang_nhap}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, background: ROLE_COLORS[u.vai_tro as string] + '22', color: ROLE_COLORS[u.vai_tro as string], border: `1px solid ${ROLE_COLORS[u.vai_tro as string]}44` }}>
                        {ROLE_LABELS[u.vai_tro as string] ?? u.vai_tro}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...(u.trang_thai === 1 ? styles.badgeActive : styles.badgeLocked) }}>
                        {u.trang_thai === 1 ? '● Hoạt động' : '⊘ Tạm khóa'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {u.must_change_password ? (
                        <span style={{ ...styles.badge, background: '#78350f22', color: '#fbbf24', border: '1px solid #fbbf2444' }}>
                          ⚠ Chưa đổi MK
                        </span>
                      ) : (
                        <span style={{ color: '#4ade80', fontSize: 13 }}>✓ Bình thường</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            id={`btn-edit-user-${u.id}`}
                            style={styles.actionBtn}
                            title="Chỉnh sửa thông tin"
                            onClick={() => openEdit(u)}
                          >✏️</button>
                          <button
                            id={`btn-reset-pw-${u.id}`}
                            style={{ ...styles.actionBtn, background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}
                            title="Đặt lại mật khẩu"
                            onClick={() => openReset(u)}
                          >🔑</button>
                          {u.id !== currentUser.id && (
                            <button
                              id={`btn-delete-user-${u.id}`}
                              style={{ ...styles.actionBtn, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                              title="Xóa tài khoản"
                              onClick={() => openDelete(u)}
                            >🗑️</button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} style={{ ...styles.td, textAlign: 'center', color: '#64748b', padding: '32px' }}>
                      Không tìm thấy tài khoản nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div style={styles.footer}>
          Tổng cộng: <strong style={{ color: '#e2e8f0' }}>{filtered.length}</strong> tài khoản
          {!isAdmin && <span style={{ color: '#64748b', marginLeft: 16 }}>⚠ Bạn không có quyền chỉnh sửa tài khoản</span>}
        </div>
      </div>

      {/* ── MODAL: Tạo tài khoản ──────────────────────────────────────────── */}
      {modalMode === 'create' && (
        <ModalBox title="Thêm Tài khoản Mới" onClose={closeModal} onConfirm={handleCreate} confirmLabel="Tạo tài khoản" loading={loading} error={error}>
          <FormField label="Tên đăng nhập *">
            <input id="input-create-username" style={styles.input} value={formTenDangNhap} onChange={(e) => setFormTenDangNhap(e.target.value)} placeholder="Ví dụ: nguyen.van.a" autoFocus />
          </FormField>
          <FormField label="Họ và tên *">
            <input id="input-create-fullname" style={styles.input} value={formHoTen} onChange={(e) => setFormHoTen(e.target.value)} placeholder="Ví dụ: Nguyễn Văn A" />
          </FormField>
          <FormField label="Chức danh UBKT *">
            <select
              id="select-create-chucdanh"
              style={styles.select}
              value={formChucDanh}
              onChange={(e) => setFormChucDanh(e.target.value)}
            >
              {CHUC_DANH_UBKT_OPTIONS.map((cd) => (
                <option key={cd} value={cd}>{cd}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Mật khẩu ban đầu *">
            <div style={{ position: 'relative' }}>
              <input
                id="input-create-password"
                style={styles.input}
                type={showPw ? 'text' : 'password'}
                value={formMatKhau}
                onChange={(e) => setFormMatKhau(e.target.value)}
                placeholder="Ít nhất 8 ký tự"
              />
              <button style={styles.eyeBtn} onClick={() => setShowPw(!showPw)}>{showPw ? '🙈' : '👁️'}</button>
            </div>
            <div style={styles.hint}>Người dùng sẽ bắt buộc đổi mật khẩu khi đăng nhập lần đầu</div>
          </FormField>
          <FormField label="Vai trò">
            <select id="select-create-role" style={styles.select} value={formVaiTro} onChange={(e) => setFormVaiTro(e.target.value)}>
              <option value="XEM">Chỉ xem</option>
              <option value="BIEN_TAP">Biên tập viên</option>
              <option value="ADMIN">Quản trị viên</option>
            </select>
          </FormField>
        </ModalBox>
      )}

      {/* ── MODAL: Sửa thông tin ──────────────────────────────────────────── */}
      {modalMode === 'edit' && selectedUser && (
        <ModalBox title={`Chỉnh sửa: ${selectedUser.ho_ten}`} onClose={closeModal} onConfirm={handleEdit} confirmLabel="Lưu thay đổi" loading={loading} error={error}>
          <FormField label="Tên đăng nhập">
            <input style={{ ...styles.input, opacity: 0.5 }} value={selectedUser.ten_dang_nhap} disabled />
          </FormField>
          <FormField label="Họ và tên *">
            <input id="input-edit-fullname" style={styles.input} value={formHoTen} onChange={(e) => setFormHoTen(e.target.value)} autoFocus />
          </FormField>
          <FormField label="Chức danh UBKT *">
            <select
              id="select-edit-chucdanh"
              style={styles.select}
              value={formChucDanh}
              onChange={(e) => setFormChucDanh(e.target.value)}
            >
              {CHUC_DANH_UBKT_OPTIONS.map((cd) => (
                <option key={cd} value={cd}>{cd}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Vai trò">
            <select id="select-edit-role" style={styles.select} value={formVaiTro} onChange={(e) => setFormVaiTro(e.target.value)} disabled={selectedUser.id === currentUser.id}>
              <option value="XEM">Chỉ xem</option>
              <option value="BIEN_TAP">Biên tập viên</option>
              <option value="ADMIN">Quản trị viên</option>
            </select>
          </FormField>
          <FormField label="Trạng thái">
            <select id="select-edit-status" style={styles.select} value={formTrangThai} onChange={(e) => setFormTrangThai(Number(e.target.value))} disabled={selectedUser.id === currentUser.id}>
              <option value={1}>Hoạt động</option>
              <option value={0}>Tạm khóa</option>
            </select>
            {selectedUser.id === currentUser.id && <div style={styles.hint}>Không thể thay đổi vai trò/trạng thái của chính mình</div>}
          </FormField>
        </ModalBox>
      )}

      {/* ── MODAL: Đặt lại mật khẩu ──────────────────────────────────────── */}
      {modalMode === 'reset_password' && selectedUser && (
        <ModalBox title={`Đặt lại MK: ${selectedUser.ho_ten}`} onClose={closeModal} onConfirm={handleReset} confirmLabel="Đặt lại mật khẩu" loading={loading} error={error} confirmColor="#f59e0b">
          <div style={styles.warningBox}>
            ⚠ Mật khẩu cũ sẽ bị vô hiệu hóa ngay lập tức. Người dùng sẽ phải dùng mật khẩu mới để đăng nhập và được yêu cầu đổi mật khẩu lần đầu.
          </div>
          <FormField label="Mật khẩu mới *">
            <div style={{ position: 'relative' }}>
              <input
                id="input-reset-pw1"
                style={styles.input}
                type={showPw ? 'text' : 'password'}
                value={formNewPw}
                onChange={(e) => setFormNewPw(e.target.value)}
                placeholder="Ít nhất 8 ký tự"
                autoFocus
              />
              <button style={styles.eyeBtn} onClick={() => setShowPw(!showPw)}>{showPw ? '🙈' : '👁️'}</button>
            </div>
          </FormField>
          <FormField label="Xác nhận mật khẩu mới *">
            <input
              id="input-reset-pw2"
              style={{ ...styles.input, borderColor: formNewPw2 && formNewPw !== formNewPw2 ? '#ef4444' : undefined }}
              type="password"
              value={formNewPw2}
              onChange={(e) => setFormNewPw2(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
            />
          </FormField>
        </ModalBox>
      )}

      {/* ── MODAL: Xóa ───────────────────────────────────────────────────── */}
      {modalMode === 'delete' && selectedUser && (
        <ModalBox title="Xác nhận Xóa Tài khoản" onClose={closeModal} onConfirm={handleDelete} confirmLabel="Xóa tài khoản" loading={loading} error={error} confirmColor="#ef4444">
          <div style={styles.warningBox}>
            ⚠ Thao tác này không thể hoàn tác. Tài khoản sẽ bị xóa khỏi hệ thống.
          </div>
          <div style={{ color: '#e2e8f0', marginTop: 12, lineHeight: 1.6 }}>
            Bạn có chắc chắn muốn xóa tài khoản:<br />
            <strong style={{ color: '#f1f5f9', fontSize: 16 }}>"{selectedUser.ho_ten}"</strong>
            <span style={{ color: '#94a3b8' }}> ({selectedUser.ten_dang_nhap})</span>?
          </div>
        </ModalBox>
      )}
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────────
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ModalBox({
  title,
  onClose,
  onConfirm,
  confirmLabel,
  loading,
  error,
  children,
  confirmColor = '#3b82f6',
}: {
  title: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  loading: boolean;
  error: string;
  children: React.ReactNode;
  confirmColor?: string;
}) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 16 }}>{title}</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {children}
          {error && <div style={styles.errorBox}>{error}</div>}
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.btnSecondary} onClick={onClose} disabled={loading}>Hủy</button>
          <button
            style={{ ...styles.btnPrimary, background: confirmColor, minWidth: 140 }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '⏳ Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(6px)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  panel: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    width: '100%',
    maxWidth: 900,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  panelTitle: { fontSize: 18, fontWeight: 700, color: '#f1f5f9' },
  panelSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    fontSize: 18,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 6,
    transition: 'color 0.2s',
  },
  toast: {
    margin: '12px 24px 0',
    padding: '12px 16px',
    background: 'rgba(74,222,128,0.15)',
    border: '1px solid rgba(74,222,128,0.3)',
    borderRadius: 8,
    color: '#4ade80',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  searchWrap: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: { position: 'absolute', left: 12, fontSize: 14, pointerEvents: 'none' },
  searchInput: {
    width: '100%',
    padding: '9px 12px 9px 36px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  },
  btnPrimary: {
    padding: '9px 18px',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
    whiteSpace: 'nowrap',
    transition: 'opacity 0.2s',
  },
  btnSecondary: {
    padding: '9px 18px',
    background: 'rgba(255,255,255,0.08)',
    color: '#cbd5e1',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
    transition: 'opacity 0.2s',
  },
  tableWrap: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 24px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '14px 12px',
    color: '#64748b',
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    position: 'sticky',
    top: 0,
    background: '#0f172a',
  },
  td: {
    padding: '13px 12px',
    color: '#cbd5e1',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    verticalAlign: 'middle',
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
  },
  badgeActive: {
    background: 'rgba(74,222,128,0.15)',
    color: '#4ade80',
    border: '1px solid rgba(74,222,128,0.3)',
  },
  badgeLocked: {
    background: 'rgba(239,68,68,0.15)',
    color: '#f87171',
    border: '1px solid rgba(239,68,68,0.3)',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  actionBtn: {
    padding: '5px 9px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    transition: 'background 0.2s',
  },
  footer: {
    padding: '14px 24px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    color: '#64748b',
    fontSize: 13,
  },
  loadingMsg: {
    textAlign: 'center',
    padding: '40px',
    color: '#64748b',
  },
  // Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    background: '#1e293b',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    width: '100%',
    maxWidth: 460,
    boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  modalBody: { padding: '20px' },
  modalFooter: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    padding: '16px 20px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    background: '#0f172a',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  errorBox: {
    marginTop: 12,
    padding: '10px 14px',
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8,
    color: '#f87171',
    fontSize: 13,
  },
  warningBox: {
    padding: '12px 14px',
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: 8,
    color: '#fbbf24',
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 12,
  },
  hint: {
    marginTop: 5,
    fontSize: 12,
    color: '#64748b',
  },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    padding: 0,
  },
};
