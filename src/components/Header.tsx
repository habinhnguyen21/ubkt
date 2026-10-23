import React from 'react';
import type { User } from '../types';
import { Lock, LogOut, KeyRound, History, Building2, HelpCircle, Users } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onLockScreen: () => void;
  onChangePassword: () => void;
  onOpenAuditLogs: () => void;
  onOpenGuide?: () => void;
  onOpenUserManager: () => void;
  currentTab: 'don_vi' | 'chuong_trinh' | 'kiem_tra';
  setCurrentTab: (tab: 'don_vi' | 'chuong_trinh' | 'kiem_tra') => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onLockScreen,
  onChangePassword,
  onOpenAuditLogs,
  onOpenGuide,
  onOpenUserManager,
  currentTab,
  setCurrentTab,
}) => {

  return (
    <header className="bg-red-800 text-white shadow-md border-b-2 border-amber-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Tên ứng dụng */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-red-950 border border-amber-400 flex items-center justify-center shadow-inner">
              <span className="text-amber-400 font-black text-xl select-none">★</span>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                ỦY BAN KIỂM TRA ĐẢNG ỦY
              </div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                Quản lý Chương trình Kiểm tra, Giám sát của Đảng
              </h1>
            </div>
          </div>

          {/* Navigation Tabs */}
          {user && (
            <nav className="hidden md:flex space-x-1">
              <button
                onClick={() => setCurrentTab('don_vi')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${
                  currentTab === 'don_vi'
                    ? 'bg-red-900 text-amber-300 shadow-sm border border-amber-500/30'
                    : 'text-red-100 hover:bg-red-700/60'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Cơ cấu Tổ chức Đơn vị
              </button>
            </nav>
          )}

          {/* User Section & Actions */}
          {user && (
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs text-red-200">Đồng chí</span>
                <span className="text-sm font-semibold text-white leading-none">
                  {user.ho_ten}
                </span>
                <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-red-900/80 px-1.5 py-0.5 rounded self-end">
                  {user.vai_tro}
                </span>
              </div>

              <div className="flex items-center space-x-1 border-l border-red-700/80 pl-3">
                <button
                  onClick={onOpenGuide}
                  title="Hướng dẫn sử dụng"
                  className="px-2.5 py-1 text-xs font-semibold text-amber-300 hover:text-white bg-red-900/60 hover:bg-red-900 rounded-md transition flex items-center gap-1 cursor-pointer mr-1 border border-amber-400/30"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Hướng dẫn</span>
                </button>
                <button
                  id="btn-open-user-manager"
                  onClick={onOpenUserManager}
                  title="Quản lý tài khoản"
                  className="p-1.5 text-red-100 hover:text-amber-300 hover:bg-red-700/60 rounded-md transition cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                </button>
                <button
                  onClick={onOpenAuditLogs}
                  title="Nhật ký hoạt động"
                  className="p-1.5 text-red-100 hover:text-amber-300 hover:bg-red-700/60 rounded-md transition cursor-pointer"
                >
                  <History className="w-4 h-4" />
                </button>
                <button
                  onClick={onChangePassword}
                  title="Đổi mật khẩu"
                  className="p-1.5 text-red-100 hover:text-amber-300 hover:bg-red-700/60 rounded-md transition cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
                <button
                  onClick={onLockScreen}
                  title="Khóa màn hình tạm thời"
                  className="p-1.5 text-red-100 hover:text-amber-300 hover:bg-red-700/60 rounded-md transition cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                </button>
                <button
                  onClick={onLogout}
                  title="Đăng xuất"
                  className="p-1.5 text-red-100 hover:text-red-200 hover:bg-red-900/80 rounded-md transition ml-1 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </header>
  );
};
