import React, { useState } from 'react';
import { api } from '../services/api';
import type { User } from '../types';
import { KeyRound, ShieldCheck, AlertCircle, X } from 'lucide-react';


interface ChangePasswordModalProps {
  user: User;
  isMandatory: boolean;
  onSuccess: () => void;
  onClose?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  user,
  isMandatory,
  onSuccess,
  onClose,
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới và mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);

    try {
      await api.changePassword({
        user_id: user.id,
        mat_khau_cu: oldPassword,
        mat_khau_moi: newPassword,
      });
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-red-800 p-5 text-white flex items-center justify-between border-b-2 border-amber-500">
          <div className="flex items-center space-x-2.5">
            <KeyRound className="w-6 h-6 text-amber-300" />
            <div>
              <h2 className="text-lg font-bold">
                {isMandatory ? 'YÊU CẦU ĐỔI MẬT KHẨU KHỞI TẠO' : 'ĐỔI MẬT KHẨU TÀI KHOẢN'}
              </h2>
              <p className="text-xs text-red-200">
                Đồng chí: <strong>{user.ho_ten}</strong> ({user.ten_dang_nhap})
              </p>
            </div>
          </div>
          {!isMandatory && onClose && (
            <button
              onClick={onClose}
              className="text-red-200 hover:text-white p-1 rounded-md transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isMandatory && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-700 mt-0.5" />
              <span>
                Theo quy định an toàn thông tin ngành Đảng, bạn bắt buộc phải thay đổi mật khẩu mặc định trước khi sử dụng các chức năng quản lý.
              </span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Mật khẩu hiện tại
            </label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Nhập mật khẩu hiện tại"
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Mật khẩu mới
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Xác nhận mật khẩu mới
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600 text-sm"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            {!isMandatory && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 font-medium transition cursor-pointer"
              >
                Hủy bỏ
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm font-semibold shadow transition disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{loading ? 'Đang lưu...' : 'Cập nhật Mật khẩu'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
