import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import type { ChuongTrinhKtGs, LoaiHinhKtGs, TrangThaiKtGs, User } from '../types';
import {
  Calendar,
  FileText,
  Info,
  ChevronRight,
} from 'lucide-react';

interface LichThangManagerProps {
  user: User;
  onNavigateToProgram?: (programId: string) => void;
}

export const LichThangManager: React.FC<LichThangManagerProps> = ({ user: _user }) => {
  const [list, setList] = useState<ChuongTrinhKtGs[]>([]);
  const [_loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const programs = await api.getAllChuongTrinh();
      setList(programs);
    } catch (err) {
      console.error('Lỗi tải dữ liệu lịch KT-GS:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Danh sách các năm có trong hệ thống
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(2026);
    years.add(new Date().getFullYear());
    list.forEach((item) => years.add(item.nam));
    return Array.from(years).sort((a, b) => b - a);
  }, [list]);

  // Kiểm tra xem một cuộc KT-GS có giao với tháng M trong năm được chọn hay không
  const isOverlappingMonth = (item: ChuongTrinhKtGs, month: number, year: number) => {
    if (item.nam !== year) return false;

    // Nếu không có ngày bắt đầu và kết thúc cụ thể, nhưng thuộc năm này
    if (!item.ngay_bat_dau && !item.ngay_ket_thuc) {
      return false;
    }

    const mStr = String(month).padStart(2, '0');
    // Ngày đầu tháng: YYYY-MM-01
    const startOfMonth = `${year}-${mStr}-01`;
    // Ngày cuối tháng
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const endOfMonth = `${year}-${mStr}-${String(lastDayOfMonth).padStart(2, '0')}`;

    const itemStart = item.ngay_bat_dau || item.ngay_ket_thuc || startOfMonth;
    const itemEnd = item.ngay_ket_thuc || item.ngay_bat_dau || endOfMonth;

    // Giao nhau khi itemStart <= endOfMonth && itemEnd >= startOfMonth
    return itemStart <= endOfMonth && itemEnd >= startOfMonth;
  };

  // Tính số lượng cho 12 tháng
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    return months.map((month) => {
      const events = list.filter((item) => isOverlappingMonth(item, month, selectedYear));
      return {
        month,
        count: events.length,
        events,
      };
    });
  }, [list, selectedYear]);

  // Sự kiện của tháng đang chọn
  const activeMonthData = useMemo(() => {
    if (!selectedMonth) return null;
    return monthlyData.find((m) => m.month === selectedMonth) || null;
  }, [monthlyData, selectedMonth]);

  const renderLoaiHinhBadge = (loai?: LoaiHinhKtGs | null) => {
    if (!loai) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
          Toàn khóa
        </span>
      );
    }
    if (loai === 'KIEM_TRA') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
          Kiểm tra
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
        Giám sát
      </span>
    );
  };

  const renderTrangThaiBadge = (status: TrangThaiKtGs) => {
    switch (status) {
      case 'CHUA_THUC_HIEN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-300">
            Chưa thực hiện
          </span>
        );
      case 'DANG_THUC_HIEN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-300">
            Đang thực hiện
          </span>
        );
      case 'DA_HOAN_THANH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
            Đã hoàn thành
          </span>
        );
      case 'QUA_HAN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-100 text-rose-800 border border-rose-300">
            Quá hạn
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Lịch theo tháng
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Các cuộc kiểm tra, giám sát theo ngày bắt đầu và kết thúc trong năm {selectedYear}.
          </p>
        </div>

        {/* Bộ chọn năm */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <label htmlFor="year-select" className="text-xs font-semibold text-slate-600">
            Năm
          </label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(Number(e.target.value));
              setSelectedMonth(null);
            }}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] cursor-pointer"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── LƯỚI 12 THÁNG (CHUẨN THEO MẪU ẢNH) ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {monthlyData.map(({ month, count }) => {
          const isSelected = selectedMonth === month;
          const hasEvents = count > 0;

          return (
            <div
              key={month}
              onClick={() => setSelectedMonth(isSelected ? null : month)}
              className={`bg-white rounded-xl border p-5 transition cursor-pointer select-none relative ${
                isSelected
                  ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md bg-blue-50/20'
                  : 'border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Tháng {month} / {selectedYear}
                </h3>
                {hasEvents && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {count} cuộc
                  </span>
                )}
              </div>

              <div className="mt-2.5">
                <div className={`text-3xl font-extrabold tracking-tight ${hasEvents ? 'text-slate-900' : 'text-slate-900'}`}>
                  {count}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  cuộc có thời gian giao với tháng này
                </p>
              </div>

              {isSelected && (
                <div className="mt-3 pt-2 border-t border-blue-200/60 flex items-center justify-between text-xs font-semibold text-blue-700">
                  <span>Đang xem chi tiết</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── KHU VỰC CHI TIẾT SỰ KIỆN KHI CHỌN MỘT THÁNG ────────────────── */}
      {selectedMonth !== null && activeMonthData && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-blue-700" />
              <h2 className="text-base font-bold text-slate-900">
                Chi tiết Tháng {selectedMonth} / {selectedYear}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                {activeMonthData.count} cuộc
              </span>
            </div>
            <button
              onClick={() => setSelectedMonth(null)}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1 rounded hover:bg-slate-100 cursor-pointer"
            >
              Đóng xem chi tiết
            </button>
          </div>

          {activeMonthData.count === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm flex flex-col items-center justify-center space-y-2">
              <Info className="w-8 h-8 text-slate-300" />
              <p>Chưa có cuộc kiểm tra hoặc giám sát nào có lịch trong Tháng {selectedMonth} / {selectedYear}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700 border-collapse">
                <thead className="bg-slate-50 text-xs text-slate-600 font-semibold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">STT</th>
                    <th className="py-2.5 px-3 w-28">Loại hình</th>
                    <th className="py-2.5 px-3 w-44">Chủ thể thực hiện</th>
                    <th className="py-2.5 px-4 w-52">Đối tượng</th>
                    <th className="py-2.5 px-4 min-w-[240px]">Nội dung KT-GS</th>
                    <th className="py-2.5 px-3 w-40">Thời gian thực tế</th>
                    <th className="py-2.5 px-3 w-28 text-center">Trạng thái</th>
                    <th className="py-2.5 px-3 w-28 text-center">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeMonthData.events.map((ev, idx) => (
                    <tr key={ev.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3">{renderLoaiHinhBadge(ev.loai_hinh)}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800 text-xs">
                        {ev.chu_the}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 text-xs">
                        {ev.doi_tuong}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 leading-relaxed">
                        <p className="line-clamp-2" title={ev.noi_dung}>
                          {ev.noi_dung}
                        </p>
                        {ev.so_van_ban && (
                          <span className="inline-block text-[11px] text-slate-400 mt-0.5">
                            Số VB: {ev.so_van_ban}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
                        <div className="space-y-0.5">
                          {ev.ngay_bat_dau && <div>Từ: {ev.ngay_bat_dau}</div>}
                          {ev.ngay_ket_thuc && <div>Đến: {ev.ngay_ket_thuc}</div>}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {renderTrangThaiBadge(ev.trang_thai)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {ev.file_pdf_ten ? (
                          <div
                            className="inline-flex items-center space-x-1 text-xs text-blue-700 hover:text-blue-900 cursor-pointer"
                            title={ev.file_pdf_ten}
                          >
                            <FileText className="w-3.5 h-3.5 text-red-600" />
                            <span className="truncate max-w-[80px]">{ev.file_pdf_ten}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LichThangManager;
