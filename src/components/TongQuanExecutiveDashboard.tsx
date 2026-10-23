import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Landmark,
  ClipboardCheck,
  Eye,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';
import type { AppInfo, ChuongTrinhKtGs, DonThu, DonVi, User } from '../types';
import {
  computeDashboardStats,
  type DashboardFilterState,
} from '../services/dashboardStats';
import { DashboardFilters } from './dashboard/DashboardFilters';
import { StatCard } from './dashboard/StatCard';
import { TaskStatusDonutChart } from './dashboard/TaskStatusDonutChart';
import { CoverageGaugeChart } from './dashboard/CoverageGaugeChart';
import { RemediationGaugeChart } from './dashboard/RemediationGaugeChart';
import { AttentionAlerts } from './dashboard/AttentionAlerts';
import { OrgProgressTable } from './dashboard/OrgProgressTable';
import { OverdueTasksModal } from './dashboard/OverdueTasksModal';

interface TongQuanProps {
  currentUser?: User | null;
  appInfo?: AppInfo | null;
  onSelectAction?: (actionKey: string) => void;
}

export function TongQuanExecutiveDashboard({
  currentUser = null,
  appInfo = null,
  onSelectAction,
}: TongQuanProps) {
  // State quản lý dữ liệu gốc từ API
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [chuongTrinhList, setChuongTrinhList] = useState<ChuongTrinhKtGs[]>([]);
  const [donThuList, setDonThuList] = useState<DonThu[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal xem nhiệm vụ quá hạn
  const [showOverdueModal, setShowOverdueModal] = useState<boolean>(false);

  // Bộ lọc năm & phạm vi quản lý
  const [filters, setFilters] = useState<DashboardFilterState>({
    year: new Date().getFullYear(),
    scopeType: 'ALL',
    donViId: 'ALL',
    linhVuc: 'ALL',
  });

  // Tải dữ liệu từ backend
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setLoadError(null);

    try {
      const [units, tasks, complaints] = await Promise.all([
        api.getAllDonVi().catch(() => [] as DonVi[]),
        api.getAllChuongTrinh().catch(() => [] as ChuongTrinhKtGs[]),
        api.getAllDonThu().catch(() => [] as DonThu[]),
      ]);

      setDonViList(units);
      setChuongTrinhList(tasks);
      setDonThuList(complaints);
    } catch (err: any) {
      console.error('Lỗi nạp dữ liệu trang Tổng quan:', err);
      setLoadError(err?.message || 'Không thể tải dữ liệu tổng quan');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tính toán số liệu thống kê hoàn toàn động
  const stats = useMemo(() => {
    return computeDashboardStats(
      donViList,
      chuongTrinhList,
      donThuList,
      filters,
      currentUser,
      appInfo?.root_unit_name,
    );
  }, [donViList, chuongTrinhList, donThuList, filters, currentUser, appInfo]);

  // Đồng bộ năm mặc định nếu năm hiện tại chưa có dữ liệu và danh sách có năm khác
  useEffect(() => {
    if (stats.availableYears.length > 0 && filters.year !== 'ALL') {
      const yearExists = stats.availableYears.includes(filters.year as number);
      if (!yearExists && stats.availableYears[0]) {
        setFilters((prev) => ({ ...prev, year: stats.availableYears[0] }));
      }
    }
  }, [stats.availableYears, filters.year]);

  // Điều hướng chuyển tab trong hệ thống
  const handleNavigateTab = (tab: string, donViId?: string) => {
    window.dispatchEvent(
      new CustomEvent('ubkt_navigate', {
        detail: { tab, donViId },
      }),
    );
    if (onSelectAction) {
      onSelectAction(tab);
    }
  };

  const handleResetFilters = () => {
    setFilters({
      year: new Date().getFullYear(),
      scopeType: 'ALL',
      donViId: 'ALL',
      linhVuc: 'ALL',
    });
  };

  if (loading) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold">Đang tổng hợp số liệu theo thời gian thực...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          <span>{loadError}</span>
        </div>
        <button
          onClick={() => loadData(true)}
          className="px-3 py-1 bg-white border border-rose-300 rounded-lg font-semibold hover:bg-rose-100 transition cursor-pointer"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3.5 font-sans pb-8 animate-fadeIn">
      {/* ── BỘ LỌC NĂM VÀ ĐIỀU KIỆN THỐNG KÊ ────────────────────────── */}
      <DashboardFilters
        filters={filters}
        availableYears={stats.availableYears}
        availableUnits={stats.availableUnits}
        availableLinhVuc={stats.availableLinhVuc}
        isRefreshing={isRefreshing}
        onRefresh={() => loadData(true)}
        onChange={setFilters}
        onReset={handleResetFilters}
      />

      {/* ── BẢNG ĐIỀU KHIỂN CHÍNH (4 STAT CARDS + 3 BIỂU ĐỒ + CẢNH BÁO) ────── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-3.5 items-stretch">
        {/* KHỐI TRÁI: 4 Thẻ chỉ tiêu + 3 Biểu đồ trực quan (Chiếm 3/4 chiều ngang) */}
        <div className="xl:col-span-3 flex flex-col gap-3.5">
          {/* 4 Thẻ chỉ tiêu tổng quan - Chỉ hiển thị số liệu thuần túy (Không tương tác) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Tổng số cơ quan, tổ chức đảng */}
            <StatCard
              icon={Landmark}
              iconBgColor="bg-blue-100/70"
              iconColor="text-[#2563eb]"
              title="Tổng số cơ quan, tổ chức đảng"
              value={stats.tongCoQuan}
              subtitle="Đơn vị cần theo dõi"
            />

            {/* Card 2: Số cuộc kiểm tra */}
            <StatCard
              icon={ClipboardCheck}
              iconBgColor="bg-blue-100/70"
              iconColor="text-[#2563eb]"
              title="Số cuộc kiểm tra"
              value={stats.soCuocKiemTra}
              subtitle={filters.year === 'ALL' ? 'Toàn bộ thời gian' : `Trong năm ${filters.year}`}
            />

            {/* Card 3: Số cuộc giám sát */}
            <StatCard
              icon={Eye}
              iconBgColor="bg-blue-100/70"
              iconColor="text-[#2563eb]"
              title="Số cuộc giám sát"
              value={stats.soCuocGiamSat}
              subtitle={filters.year === 'ALL' ? 'Toàn bộ thời gian' : `Trong năm ${filters.year}`}
            />

            {/* Card 4: Tổng số nhiệm vụ được giao */}
            <StatCard
              icon={FileText}
              iconBgColor="bg-blue-100/70"
              iconColor="text-[#2563eb]"
              title="Tổng số nhiệm vụ được giao"
              value={stats.tongNhiemVu}
              subtitle={filters.year === 'ALL' ? 'Toàn bộ thời gian' : `Trong năm ${filters.year}`}
            />
          </div>

          {/* 3 Biểu đồ tiến độ & độ bao phủ - Chỉ hiển thị trực quan */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 flex-1 items-stretch">
            {/* Chart 1: Donut Tình hình thực hiện nhiệm vụ */}
            <TaskStatusDonutChart
              total={stats.tinhHinhNhiemVu.total}
              slices={stats.tinhHinhNhiemVu.slices}
            />

            {/* Chart 2: Gauge Độ bao phủ kiểm tra, giám sát */}
            <CoverageGaugeChart
              percent={stats.doBaoPhu.percent}
              daThucHien={stats.doBaoPhu.daThucHien}
              chuaThucHien={stats.doBaoPhu.chuaThucHien}
              tongCoQuan={stats.doBaoPhu.tongCoQuan}
            />

            {/* Chart 3: Gauge Kết quả khắc phục kiến nghị */}
            <RemediationGaugeChart
              percent={stats.khacPhucKienNghi.percent}
              daHoanThanh={stats.khacPhucKienNghi.daHoanThanh}
              conPhaiThucHien={stats.khacPhucKienNghi.conPhaiThucHien}
              daQuaHan={stats.khacPhucKienNghi.daQuaHan}
              tongKienNghi={stats.khacPhucKienNghi.tongKienNghi}
              hasData={stats.khacPhucKienNghi.hasData}
            />
          </div>
        </div>

        {/* KHỐI PHẢI: Điểm cần quan tâm (Cảnh báo quá hạn, đơn thư, kiến nghị) - GIỮ NGUYÊN TƯƠNG TÁC ĐỂ XỬ LÝ ĐIỂM NÓNG */}
        <div className="xl:col-span-1">
          <AttentionAlerts
            diemQuanTam={stats.diemQuanTam}
            onOpenOverdueModal={() => {
              if (stats.diemQuanTam.nhiemVuQuaHan.count > 0) {
                setShowOverdueModal(true);
              }
            }}
            onNavigateTab={handleNavigateTab}
          />
        </div>
      </div>

      {/* ── BẢNG CHI TIẾT TIẾN ĐỘ THEO ĐƠN VỊ CƠ SỞ (CHỈ THỂ HIỆN SỐ LIỆU THỐNG KÊ, KHÔNG TƯƠNG TÁC) ── */}
      <OrgProgressTable
        data={stats.tienDoTheoDonVi}
        currentYear={filters.year}
      />

      {/* ── POPUP XEM CHI TIẾT NHIỆM VỤ QUÁ HẠN NẾU CÓ ───────────────────── */}
      <OverdueTasksModal
        isOpen={showOverdueModal}
        onClose={() => setShowOverdueModal(false)}
        tasks={stats.diemQuanTam.nhiemVuQuaHan.items}
        onNavigateToTask={() => {
          handleNavigateTab('chuong_trinh');
        }}
      />
    </div>
  );
}
