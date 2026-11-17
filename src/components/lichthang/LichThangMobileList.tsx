import React from 'react';
import { Calendar, FileText, Building2 } from 'lucide-react';
import type { ChuongTrinhKtGs, LoaiHinhKtGs, TrangThaiKtGs } from '../../types';

export interface LichThangMobileListProps {
  events: ChuongTrinhKtGs[];
  renderLoaiHinhBadge: (loai?: LoaiHinhKtGs | null) => React.ReactNode;
  renderTrangThaiBadge: (trangThai: TrangThaiKtGs) => React.ReactNode;
}

export const LichThangMobileList: React.FC<LichThangMobileListProps> = ({
  events,
  renderLoaiHinhBadge,
  renderTrangThaiBadge,
}) => {
  return (
    <div className="space-y-3 font-sans">
      {events.map((ev, idx) => (
        <div
          key={ev.id}
          className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 transition"
        >
          {/* Hàng 1: STT & Chủ thể thực hiện */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-mono text-[10.5px] font-bold shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 leading-snug">
                  {ev.chu_the}
                </div>
                {ev.doi_tuong && (
                  <div className="text-[11.5px] text-slate-600 flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Đối tượng:</span>
                    <strong className="text-slate-800">{ev.doi_tuong}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Hàng 2: Nhãn Loại hình + Trạng thái */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            {renderLoaiHinhBadge(ev.loai_hinh)}
            {renderTrangThaiBadge((ev.trang_thai as TrangThaiKtGs) || 'CHUA_THUC_HIEN')}
            {ev.so_van_ban && (
              <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {ev.so_van_ban}
              </span>
            )}
          </div>

          {/* Hàng 3: Thời gian thực tế */}
          {(ev.ngay_bat_dau || ev.ngay_ket_thuc) && (
            <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50/70 p-2 rounded-lg border border-slate-100">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Thời gian:</span>
              <strong className="text-slate-800">
                {ev.ngay_bat_dau && ev.ngay_ket_thuc
                  ? `${ev.ngay_bat_dau} – ${ev.ngay_ket_thuc}`
                  : ev.ngay_bat_dau || ev.ngay_ket_thuc}
              </strong>
            </div>
          )}

          {/* Hàng 4: Nội dung KT-GS */}
          {ev.noi_dung && (
            <p className="text-xs text-slate-600 leading-relaxed">
              {ev.noi_dung}
            </p>
          )}

          {/* Hàng 5: Tệp đính kèm PDF nếu có */}
          {ev.file_pdf_ten && (
            <div className="pt-1 border-t border-slate-100">
              <div
                className="w-full min-h-[44px] px-3 py-2 bg-blue-50/80 hover:bg-blue-100 text-blue-800 rounded-lg border border-blue-200 flex items-center space-x-2 text-xs font-semibold cursor-pointer transition"
                title={ev.file_pdf_ten}
              >
                <FileText className="w-4 h-4 text-red-600 shrink-0" />
                <span className="truncate flex-1">{ev.file_pdf_ten}</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
