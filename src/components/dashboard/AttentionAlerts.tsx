import React from 'react';
import { AlertTriangle, AlertCircle, FileWarning, FileText, CheckCircle2 } from 'lucide-react';
import type { ComputedDashboardStats } from '../../services/dashboardStats';

interface AttentionAlertsProps {
  diemQuanTam: ComputedDashboardStats['diemQuanTam'];
  onOpenOverdueModal: () => void;
  onNavigateTab: (tab: string) => void;
}

export const AttentionAlerts: React.FC<AttentionAlertsProps> = ({
  diemQuanTam,
  onOpenOverdueModal,
  onNavigateTab,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <h3 className="font-extrabold text-xs text-slate-900 tracking-wider uppercase">
            ĐIỂM CẦN QUAN TÂM
          </h3>
        </div>

        {/* List of 4 Alert Mini-Cards */}
        <div className="space-y-3.5">
          {/* Item 1: Nhiệm vụ quá hạn */}
          <div
            onClick={onOpenOverdueModal}
            className={`flex items-center justify-between p-2.5 rounded-xl transition-all border ${
              diemQuanTam.nhiemVuQuaHan.count > 0
                ? 'bg-rose-50/50 border-rose-100 hover:bg-rose-100/60 cursor-pointer'
                : 'bg-slate-50/50 border-slate-100 cursor-default'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  diemQuanTam.nhiemVuQuaHan.count > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-200/70 text-slate-500'
                }`}
              >
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 leading-tight">Nhiệm vụ quá hạn</p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-normal truncate">
                  {diemQuanTam.nhiemVuQuaHan.note}
                </p>
              </div>
            </div>
            <span
              className={`text-base font-extrabold pl-2 shrink-0 ${
                diemQuanTam.nhiemVuQuaHan.count > 0 ? 'text-[#e11d48]' : 'text-slate-400'
              }`}
            >
              {diemQuanTam.nhiemVuQuaHan.count}
            </span>
          </div>

          {/* Item 2: Kiến nghị chưa khắc phục */}
          <div
            onClick={() => onNavigateTab('chuong_trinh')}
            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-amber-50/40 transition-all cursor-pointer border border-transparent hover:border-amber-100"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                <FileWarning className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 leading-tight">Kiến nghị chưa khắc phục</p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-normal truncate">
                  {diemQuanTam.kienNghiChuaKhacPhuc.note}
                </p>
              </div>
            </div>
            <span className="text-base font-extrabold text-[#d97706] pl-2 shrink-0">
              {diemQuanTam.kienNghiChuaKhacPhuc.count}
            </span>
          </div>

          {/* Item 3: Đơn thư đang giải quyết */}
          <div
            onClick={() => onNavigateTab('don_thu')}
            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50/40 transition-all cursor-pointer border border-transparent hover:border-blue-100"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 leading-tight">Đơn thư đang giải quyết</p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-normal truncate">
                  {diemQuanTam.donThuDangGiaiQuyet.note}
                </p>
              </div>
            </div>
            <span className="text-base font-extrabold text-[#2563eb] pl-2 shrink-0">
              {diemQuanTam.donThuDangGiaiQuyet.count}
            </span>
          </div>

          {/* Item 4: Dữ liệu báo cáo còn thiếu */}
          <div
            onClick={() => onNavigateTab('don_vi')}
            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50/40 transition-all cursor-pointer border border-transparent hover:border-purple-100"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 leading-tight">Đơn vị chưa có kế hoạch KT-GS</p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-normal truncate">
                  {diemQuanTam.duLieuBaoCaoConThieu.note}
                </p>
              </div>
            </div>
            <span className="text-base font-extrabold text-[#9333ea] pl-2 shrink-0">
              {diemQuanTam.duLieuBaoCaoConThieu.count}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 text-center">
        <span className="text-[11px] text-slate-400">Số liệu cập nhật thời gian thực từ CSDL</span>
      </div>
    </div>
  );
};
