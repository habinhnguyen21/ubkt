import React, { useState } from 'react';
import { api } from '../services/api';
import { validatePasswordPolicy } from '../utils/passwordCrypto';
import type { User } from '../types';
import { KeyRound, ShieldCheck, AlertCircle, X } from 'lucide-react';
import { auth, usernameToAuthEmail } from '../services/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { sessionStore } from '../utils/sessionStore';


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

    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới và mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);

    try {
      // Trước khi đổi mật khẩu: nếu auth.currentUser đang null, tự động xác thực / tạo phiên Firebase Auth
      if (!auth.currentUser && user?.ten_dang_nhap) {
        const authEmail = usernameToAuthEmail(user.ten_dang_nhap);
        try {
          await signInWithEmailAndPassword(auth, authEmail, oldPassword);
        } catch (signInErr: any) {
          const code = signInErr?.code || '';
          if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
            try {
              await createUserWithEmailAndPassword(auth, authEmail, oldPassword);
            } catch (createErr: any) {
              if (createErr?.code === 'auth/email-already-in-use') {
                throw new Error('Mật khẩu hiện tại không chính xác');
              }
            }
          }
        }
      }

      await api.changePassword({
        user_id: user.id,
        mat_khau_cu: oldPassword,
        mat_khau_moi: newPassword,
      });

      const updatedUser: User = {
        ...user,
        must_change_password: false,
      };
      sessionStore.setCurrentUser(updatedUser);

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/80 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-red-800 p-4 sm:p-5 text-white flex items-center justify-between border-b-2 border-amber-500 shrink-0">
          <div className="flex items-center space-x-2.5">
            <KeyRound className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 shrink-0" />
            <div>
              <h2 className="text-sm sm:text-lg font-bold leading-tight">
                {isMandatory ? 'YÊU CẦU ĐỔI MẬT KHẨU KHỞI TẠO' : 'ĐỔI MẬT KHẨU TÀI KHOẢN'}
              </h2>
              <p className="text-[11px] sm:text-xs text-red-200">
                Đồng chí: <strong>{user.ho_ten}</strong> ({user.ten_dang_nhap})
              </p>
            </div>
          </div>
          {!isMandatory && onClose && (
            <button
              onClick={onClose}
              className="text-red-200 hover:text-white w-11 h-11 flex items-center justify-center rounded-md transition cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
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
              className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600 text-base sm:text-sm"
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
              placeholder="Tối thiểu 8 ký tự, có chữ hoa, chữ thường, số"
              className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600 text-base sm:text-sm"
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
              className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600 text-base sm:text-sm"
            />
          </div>

          <div className="pt-3 flex items-center justify-end space-x-3 sticky bottom-0 bg-white py-2 border-t border-slate-100 z-10">
            {!isMandatory && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 min-h-[44px] border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 font-medium transition cursor-pointer"
              >
                Hủy bỏ
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 min-h-[44px] bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm font-semibold shadow transition disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
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
