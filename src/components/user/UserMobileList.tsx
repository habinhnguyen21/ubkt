import React, { useState, useEffect } from 'react';
import { MoreVertical, Edit2, Key, Trash2, RefreshCw } from 'lucide-react';
import type { User } from '../../types';

export interface UserMobileListProps {
  users: User[];
  currentUser: User;
  isAdmin: boolean;
  onEdit: (user: User) => void;
  onResetPassword: (user: User) => void;
  onDelete: (user: User) => void;
  onSyncUid?: (user: User) => void;
  roleLabels: Record<string, string>;
  roleColors: Record<string, string>;
}

export const UserMobileList: React.FC<UserMobileListProps> = ({
  users,
  currentUser,
  isAdmin,
  onEdit,
  onResetPassword,
  onDelete,
  onSyncUid,
  roleLabels,
  roleColors,
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeMenuId) return;
    const handleOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [activeMenuId]);

  if (users.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-800/40 rounded-xl border border-slate-700/60">
        Không tìm thấy tài khoản nào
      </div>
    );
  }

  return (
    <div className="space-y-3 font-sans">
      {users.map((u) => {
        const isMenuOpen = activeMenuId === u.id;
        const roleColor = roleColors[u.vai_tro as string] || '#94a3b8';
        const roleLabel = roleLabels[u.vai_tro as string] || u.vai_tro;

        return (
          <div
            key={u.id}
            className="p-3.5 rounded-xl border border-slate-700/60 bg-slate-800/60 backdrop-blur-xs space-y-2.5 shadow-sm text-slate-200"
          >
            {/* Hàng 1: Avatar, Họ tên & Menu ba chấm */}
            <div className="flex items-start justify-between gap-2 relative">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0"
                  style={{
                    background:
                      u.vai_tro === 'ADMIN'
                        ? '#7c3aed'
                        : u.vai_tro === 'BIEN_TAP'
                        ? '#1d4ed8'
                        : '#374151',
                  }}
                >
                  {u.ho_ten.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white leading-snug truncate">
                    {u.ho_ten}
                  </div>
                  <div className="text-xs font-mono text-slate-400 truncate">
                    @{u.ten_dang_nhap}
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(isMenuOpen ? null : u.id);
                    }}
                    className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
                    aria-label="Thao tác"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {isMenuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-10 z-50 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 py-1.5 w-48 animate-in fade-in zoom-in-95 duration-150"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuId(null);
                          onEdit(u);
                        }}
                        className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-slate-200 hover:bg-slate-700 flex items-center space-x-2 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Chỉnh sửa thông tin</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuId(null);
                          onResetPassword(u);
                        }}
                        className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-amber-300 hover:bg-slate-700 flex items-center space-x-2 cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5 text-amber-400" />
                        <span>Đặt lại mật khẩu</span>
                      </button>

                      {onSyncUid && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onSyncUid(u);
                          }}
                          className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-sky-300 hover:bg-slate-700 flex items-center space-x-2 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                          <span>Đồng bộ Firebase UID</span>
                        </button>
                      )}

                      {u.id !== currentUser.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onDelete(u);
                          }}
                          className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-rose-400 hover:bg-rose-950/40 flex items-center space-x-2 cursor-pointer border-t border-slate-700"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          <span>Xóa tài khoản</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hàng 2: Chức danh UBKT */}
            <div className="pt-1 border-t border-slate-700/50 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-700/40 border border-slate-600/50 text-slate-200">
                🎖️ {u.chuc_danh || 'Chuyên viên UBKT'}
              </span>

              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                style={{
                  background: `${roleColor}22`,
                  color: roleColor,
                  borderColor: `${roleColor}44`,
                }}
              >
                {roleLabel}
              </span>

              {u.firebaseUid || (u.id && u.id.length >= 20) ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-950/40 text-emerald-300 border border-emerald-500/30">
                  ● Đã kích hoạt UID
                </span>
              ) : (
                <div className="inline-flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-950/40 text-rose-300 border border-rose-500/30">
                    ⚠ Chưa có UID
                  </span>
                  {isAdmin && onSyncUid && (
                    <button
                      type="button"
                      onClick={() => onSyncUid(u)}
                      className="px-2 py-0.5 text-[10px] bg-blue-600 hover:bg-blue-700 text-white rounded font-medium cursor-pointer"
                    >
                      Kích hoạt ngay
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Hàng 3: Trạng thái & Bảo mật */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-700/50 text-slate-400">
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: u.trang_thai === 1 ? '#4ade80' : '#f87171' }}
                />
                <span className={u.trang_thai === 1 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                  {u.trang_thai === 1 ? 'Hoạt động' : 'Tạm khóa'}
                </span>
              </span>

              {u.must_change_password ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/40 text-amber-300 border border-amber-500/40">
                  ⚠ Chưa đổi MK
                </span>
              ) : (
                <span className="text-emerald-400 text-[11px] font-medium">✓ MK bình thường</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
