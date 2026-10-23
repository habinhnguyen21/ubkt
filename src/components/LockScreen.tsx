import React, { useState } from 'react';
import { api } from '../services/api';
import type { User } from '../types';
import { Lock, ShieldAlert, LogOut, ArrowRight } from 'lucide-react';


interface LockScreenProps {
  user: User;
  onUnlock: () => void;
  onLogout: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ user, onUnlock, onLogout }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.login({
        ten_dang_nhap: user.ten_dang_nhap,
        mat_khau: password,
      });
      onUnlock();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Mật khẩu không đúng, vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl text-white animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-full bg-red-950 border-2 border-amber-400 mx-auto mb-4 flex items-center justify-center shadow-lg">
          <Lock className="w-8 h-8 text-amber-400" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-white mb-1">
          MÀN HÌNH ĐÃ KHÓA
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Bảo mật thông tin công tác kiểm tra, giám sát
        </p>

        <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700 mb-6 text-left flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-red-700 text-white font-bold flex items-center justify-center text-sm shadow">
            {user.ho_ten.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs text-slate-400">Đang đăng nhập:</p>
            <p className="text-sm font-semibold text-slate-100 truncate">{user.ho_ten}</p>
            <p className="text-[11px] text-amber-400 font-mono">@{user.ten_dang_nhap}</p>
          </div>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4">
          {error && (
            <div className="p-2.5 bg-red-950/60 border border-red-800 text-red-300 rounded-lg text-xs flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <input
              type="password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu để mở khóa"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-center"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-sm rounded-lg shadow transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? 'Đang xác thực...' : 'Mở khóa làm việc'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-center">
          <button
            onClick={onLogout}
            className="text-xs text-slate-400 hover:text-red-400 flex items-center space-x-1 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất tài khoản</span>
          </button>
        </div>
      </div>
    </div>
  );
};
