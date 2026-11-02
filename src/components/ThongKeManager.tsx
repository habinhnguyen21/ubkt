import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Landmark,
  ClipboardCheck,
  Eye,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Filter,
  RefreshCw,
  RotateCcw,
  Users,
  TrendingUp,
  Inbox,
  X,
  Search,
} from 'lucide-react';
import { api } from '../services/api';
import { reconcileById, captureActiveInput, restoreActiveInput } from '../utils/syncUtils';
import type {
  ChuongTrinhKtGs,
  DonThu,
  DonVi,
  PhanCongDiaBan,
  User,
  LoaiHinhKtGs,
} from '../types';
import {
  generateComprehensiveReport,
  type ReportFilter,
  type UnitStatRow,
} from '../services/reportService';

interface ThongKeManagerProps {
  user: User;
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export const ThongKeManager: React.FC<ThongKeManagerProps> = ({ user }) => {
  // 1. Raw Data State
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [chuongTrinhList, setChuongTrinhList] = useState<ChuongTrinhKtGs[]>([]);
  const [donThuList, setDonThuList] = useState<DonThu[]>([]);
  const [phanCongList, setPhanCongList] = useState<PhanCongDiaBan[]>([]);
  const [userList, setUserList] = useState<User[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const hasInitialLoadedRef = useRef(false);

  // 2. Filter State
  const currentYear = new Date().getFullYear();
  const [filterNam, setFilterNam] = useState<number | 'ALL'>(currentYear);
  const [filterTuNgay, setFilterTuNgay] = useState<string>('');
  const [filterDenNgay, setFilterDenNgay] = useState<string>('');
  const [filterDonViId, setFilterDonViId] = useState<string | 'ALL'>('ALL');
  const [filterLoaiHinh, setFilterLoaiHinh] = useState<LoaiHinhKtGs | 'ALL'>('ALL');
  const [filterNgayChot, setFilterNgayChot] = useState<string>('');

  // Tab bảng chi tiết
  const [activeTableTab, setActiveTableTab] = useState<'DON_VI' | 'CAN_BO' | 'SO_SANH' | 'DON_THU'>('DON_VI');
  const [trendChartType, setTrendChartType] = useState<'BAR' | 'LINE'>('BAR');
  const [pieMode, setPieMode] = useState<'TRANG_THAI' | 'LOAI_HINH'>('TRANG_THAI');

  // Modal xem danh sách chi tiết khi bấm vào chart / lát biểu đồ
  const [drillDownModal, setDrillDownModal] = useState<{
    isOpen: boolean;
    title: string;
    items: ChuongTrinhKtGs[];
    complaintItems?: DonThu[];
  }>({
    isOpen: false,
    title: '',
    items: [],
  });

  const [drillDownSearch, setDrillDownSearch] = useState('');

  // 3. Load Data
  const loadData = useCallback(async (isRefresh = false, silent = false) => {
    const isFirstLoad = !hasInitialLoadedRef.current;
    if (!silent) {
      if (isRefresh) setIsRefreshing(true);
      else if (isFirstLoad) setLoading(true);
    }

    try {
      const [units, tasks, complaints, assignments, users] = await Promise.all([
        api.getAllDonVi().catch(() => []),
        api.getAllChuongTrinh().catch(() => []),
        api.getAllDonThu().catch(() => []),
        api.getPhanCongDiaBan().catch(() => []),
        api.getAllUsers().catch(() => []),
      ]);

      const snap = captureActiveInput();
      setDonViList((prev) => reconcileById(prev, Array.isArray(units) ? units : [], (u) => u.id));
      setChuongTrinhList((prev) => reconcileById(prev, Array.isArray(tasks) ? tasks : [], (t) => t.id));
      setDonThuList((prev) => reconcileById(prev, Array.isArray(complaints) ? complaints : [], (c) => c.id));
      setPhanCongList((prev) => (Array.isArray(assignments) ? assignments : prev));
      setUserList((prev) => (Array.isArray(users) ? users : prev));

      hasInitialLoadedRef.current = true;
      restoreActiveInput(snap);
    } catch (err) {
      console.warn('Lỗi tải dữ liệu thống kê:', err);
    } finally {
      if (!silent) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData(false, false);
    const handleSync = () => loadData(false, true);
    window.addEventListener('ubkt_data_synced', handleSync);
    return () => window.removeEventListener('ubkt_data_synced', handleSync);
  }, [loadData]);

  // 4. Compute Comprehensive Report Data
  const reportFilter: ReportFilter = useMemo(
    () => ({
      nam: filterNam,
      tuNgay: filterTuNgay || undefined,
      denNgay: filterDenNgay || undefined,
      donViId: filterDonViId,
      loaiHinh: filterLoaiHinh,
      ngayChot: filterNgayChot || undefined,
    }),
    [filterNam, filterTuNgay, filterDenNgay, filterDonViId, filterLoaiHinh, filterNgayChot]
  );

  const reportData = useMemo(() => {
    return generateComprehensiveReport({
      chuongTrinhList,
      donThuList,
      donViList,
      phanCongList,
      userList,
      currentUser: user,
      filters: reportFilter,
    });
  }, [chuongTrinhList, donThuList, donViList, phanCongList, userList, user, reportFilter]);

  // Reset filters
  const handleResetFilters = () => {
    setFilterNam(currentYear);
    setFilterTuNgay('');
    setFilterDenNgay('');
    setFilterDonViId('ALL');
    setFilterLoaiHinh('ALL');
    setFilterNgayChot('');
  };

  // Helper mở drilldown modal
  const openDrillDown = (title: string, items: ChuongTrinhKtGs[], complaintItems?: DonThu[]) => {
    setDrillDownSearch('');
    setDrillDownModal({
      isOpen: true,
      title,
      items,
      complaintItems,
    });
  };

  // Click vào cột tháng
  const handleMonthBarClick = (data: any) => {
    if (!data || !data.activePayload || !data.activePayload.length) return;
    const clickedMonth = data.activePayload[0].payload;
    const monthNum = clickedMonth.thang;
    const matching = reportData.filteredChuongTrinh.filter((c) => {
      const dStr = c.ngay_bat_dau || c.ngay_ban_hanh || c.ngay_ket_thuc || (c.created_at ? c.created_at.slice(0, 10) : null);
      if (!dStr) return false;
      return parseInt(dStr.slice(5, 7), 10) === monthNum;
    });
    openDrillDown(`Danh sách chương trình trong Tháng ${monthNum} (${matching.length} bản ghi)`, matching);
  };

  // Click vào lát trạng thái
  const handleTrangThaiSliceClick = (entry: any) => {
    if (!entry) return;
    const matching = reportData.filteredChuongTrinh.filter((c) => c.trang_thai === entry.key);
    openDrillDown(`Chương trình KT-GS: ${entry.label} (${matching.length} bản ghi)`, matching);
  };

  // Click vào lát loại hình
  const handleLoaiHinhSliceClick = (entry: any) => {
    if (!entry) return;
    const matching = reportData.filteredChuongTrinh.filter((c) => c.loai_hinh === entry.key);
    openDrillDown(`Chương trình KT-GS: ${entry.label} (${matching.length} bản ghi)`, matching);
  };

  // Click vào lát đơn thư
  const handleDonThuSliceClick = (entry: any, type: 'TRANG_THAI' | 'HUONG_XU_LY') => {
    if (!entry) return;
    const matching = reportData.filteredDonThu.filter((d) =>
      type === 'TRANG_THAI' ? d.trang_thai === entry.key : d.huong_xu_ly === entry.key
    );
    openDrillDown(`Đơn thư: ${entry.label} (${matching.length} bản ghi)`, [], matching);
  };

  // Click vào hàng đơn vị trong bảng
  const handleUnitClick = (unitRow: UnitStatRow) => {
    const matching = reportData.filteredChuongTrinh.filter((c) => {
      if (unitRow.donViId === 'UNASSIGNED') return !c.don_vi_id;
      return c.don_vi_id === unitRow.donViId;
    });
    openDrillDown(`Chương trình của ${unitRow.tenDonVi} (${matching.length} bản ghi)`, matching);
  };

  // Lọc tìm kiếm trong Drilldown Modal
  const filteredModalPrograms = useMemo(() => {
    if (!drillDownSearch.trim()) return drillDownModal.items;
    const q = drillDownSearch.toLowerCase();
    return drillDownModal.items.filter(
      (c) =>
        (c.ten_chuong_trinh && c.ten_chuong_trinh.toLowerCase().includes(q)) ||
        (c.noi_dung && c.noi_dung.toLowerCase().includes(q)) ||
        (c.ten_don_vi && c.ten_don_vi.toLowerCase().includes(q)) ||
        (c.chu_the && c.chu_the.toLowerCase().includes(q)) ||
        (c.so_van_ban && c.so_van_ban.toLowerCase().includes(q))
    );
  }, [drillDownModal.items, drillDownSearch]);

  const filteredModalComplaints = useMemo(() => {
    if (!drillDownModal.complaintItems) return [];
    if (!drillDownSearch.trim()) return drillDownModal.complaintItems;
    const q = drillDownSearch.toLowerCase();
    return drillDownModal.complaintItems.filter(
      (d) =>
        (d.ma_don && d.ma_don.toLowerCase().includes(q)) ||
        (d.doi_tuong_lien_quan && d.doi_tuong_lien_quan.toLowerCase().includes(q)) ||
        (d.linh_vuc && d.linh_vuc.toLowerCase().includes(q)) ||
        (d.can_bo_phu_trach && d.can_bo_phu_trach.toLowerCase().includes(q))
    );
  }, [drillDownModal.complaintItems, drillDownSearch]);

  if (loading) {
    return (
      <div className="w-full py-20 flex flex-col items-center justify-center gap-3 text-slate-500 font-sans">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold">Đang tổng hợp số liệu báo cáo thống kê...</p>
      </div>
    );
  }

  const { kpi } = reportData;

  return (
    <div className="w-full space-y-4 font-sans pb-10">
      {/* ── 1. BỘ LỌC THỐNG KÊ ── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Bộ lọc báo cáo & thống kê</h2>
              <p className="text-[11px] text-slate-500">
                Lọc dữ liệu kiểm tra, giám sát và đơn thư theo thời gian, đơn vị và loại hình
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Làm mới dữ liệu từ máy chủ"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Đang tải...' : 'Làm mới'}</span>
            </button>
            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Đặt lại</span>
            </button>
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-3">
          {/* Lọc Năm */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Năm</label>
            <select
              value={filterNam}
              onChange={(e) => setFilterNam(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
            >
              <option value="ALL">Tất cả các năm</option>
              {reportData.availableYears.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          {/* Từ ngày */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Từ ngày</label>
            <input
              type="date"
              value={filterTuNgay}
              onChange={(e) => setFilterTuNgay(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
            />
          </div>

          {/* Đến ngày */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Đến ngày</label>
            <input
              type="date"
              value={filterDenNgay}
              onChange={(e) => setFilterDenNgay(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
            />
          </div>

          {/* Đơn vị */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Đơn vị</label>
            <select
              value={filterDonViId}
              onChange={(e) => setFilterDonViId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
            >
              <option value="ALL">Toàn bộ đơn vị</option>
              <option value="UNASSIGNED">(Chưa gắn đơn vị)</option>
              {reportData.availableUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.ten}
                </option>
              ))}
            </select>
          </div>

          {/* Loại hình */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Loại hình</label>
            <select
              value={filterLoaiHinh}
              onChange={(e) => setFilterLoaiHinh(e.target.value as LoaiHinhKtGs | 'ALL')}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
            >
              <option value="ALL">Tất cả loại hình</option>
              <option value="KIEM_TRA">Kiểm tra</option>
              <option value="GIAM_SAT">Giám sát</option>
            </select>
          </div>

          {/* Ngày chốt số liệu */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Ngày chốt số liệu</label>
            <input
              type="date"
              value={filterNgayChot}
              onChange={(e) => setFilterNgayChot(e.target.value)}
              placeholder="Hôm nay"
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* ── 2. THẺ CHỈ TIÊU KPI CHÍNH (6 CARDS) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Tổng số cuộc */}
        <div
          onClick={() =>
            openDrillDown(`Tất cả chương trình KT-GS (${reportData.filteredChuongTrinh.length})`, reportData.filteredChuongTrinh)
          }
          className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs hover:border-blue-400 hover:shadow-sm transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Tổng cuộc KT-GS</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-800">{kpi.tongChuongTrinh}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Bấm xem danh sách</p>
        </div>

        {/* Card 2: Kiểm tra */}
        <div
          onClick={() => {
            const items = reportData.filteredChuongTrinh.filter((c) => c.loai_hinh === 'KIEM_TRA');
            openDrillDown(`Các cuộc Kiểm tra (${items.length})`, items);
          }}
          className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs hover:border-blue-400 hover:shadow-sm transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Kiểm tra</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-blue-600">{kpi.soKiemTra}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {kpi.tongChuongTrinh > 0 ? `${Math.round((kpi.soKiemTra / kpi.tongChuongTrinh) * 100)}% tổng số` : '0%'}
          </p>
        </div>

        {/* Card 3: Giám sát */}
        <div
          onClick={() => {
            const items = reportData.filteredChuongTrinh.filter((c) => c.loai_hinh === 'GIAM_SAT');
            openDrillDown(`Các cuộc Giám sát (${items.length})`, items);
          }}
          className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs hover:border-emerald-400 hover:shadow-sm transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Giám sát</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-600">{kpi.soGiamSat}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {kpi.tongChuongTrinh > 0 ? `${Math.round((kpi.soGiamSat / kpi.tongChuongTrinh) * 100)}% tổng số` : '0%'}
          </p>
        </div>

        {/* Card 4: Tỷ lệ hoàn thành */}
        <div
          onClick={() => {
            const items = reportData.filteredChuongTrinh.filter((c) => c.trang_thai === 'DA_HOAN_THANH');
            openDrillDown(`Các cuộc đã hoàn thành (${items.length})`, items);
          }}
          className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs hover:border-emerald-400 hover:shadow-sm transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Đã hoàn thành</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-700">{kpi.daHoanThanh}</div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, kpi.tyLeHoanThanh)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Tỷ lệ: {kpi.tyLeHoanThanh}%</p>
        </div>

        {/* Card 5: Quá hạn */}
        <div
          onClick={() => {
            const items = reportData.filteredChuongTrinh.filter((c) => c.trang_thai === 'QUA_HAN' || (c.ngay_ket_thuc && new Date(c.ngay_ket_thuc) < new Date() && c.trang_thai !== 'DA_HOAN_THANH'));
            openDrillDown(`Nhiệm vụ KT-GS quá hạn (${items.length})`, items);
          }}
          className={`bg-white rounded-xl border p-3.5 shadow-xs hover:shadow-sm transition cursor-pointer ${
            kpi.quaHan > 0 ? 'border-rose-200 bg-rose-50/20 hover:border-rose-400' : 'border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Quá hạn</span>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                kpi.quaHan > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl font-bold ${kpi.quaHan > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {kpi.quaHan}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {kpi.quaHan > 0 ? 'Cần đôn đốc xử lý' : 'Đúng tiến độ'}
          </p>
        </div>

        {/* Card 6: Đơn thư tiếp nhận */}
        <div
          onClick={() =>
            openDrillDown(`Danh sách đơn thư tiếp nhận (${reportData.filteredDonThu.length})`, [], reportData.filteredDonThu)
          }
          className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs hover:border-blue-400 hover:shadow-sm transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Đơn thư</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-purple-700">{kpi.tongDonThu}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Đang xử lý: {kpi.donThuDangXuLy} | Quá hạn: {kpi.donThuQuaHan}
          </p>
        </div>
      </div>

      {/* ── 3. KHỐI BIỂU ĐỒ TRỰC QUAN (CỘT + ĐƯỜNG + TRÒN) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Biểu đồ 1: Cột theo 12 tháng (Kiểm tra vs Giám sát) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-800">
                Diễn biến nhiệm vụ KT-GS theo các tháng trong năm
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setTrendChartType('BAR')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                    trendChartType === 'BAR' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Cột
                </button>
                <button
                  type="button"
                  onClick={() => setTrendChartType('LINE')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                    trendChartType === 'LINE' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Đường
                </button>
              </div>
              <span className="text-[11px] text-slate-400 italic hidden sm:inline">Bấm vào cột/điểm để xem chi tiết</span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {trendChartType === 'BAR' ? (
                <BarChart
                  data={reportData.theoNamThang}
                  onClick={handleMonthBarClick}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="kiemTra" name="Kiểm tra" fill="#2563eb" radius={[4, 4, 0, 0]} cursor="pointer" />
                  <Bar dataKey="giamSat" name="Giám sát" fill="#10b981" radius={[4, 4, 0, 0]} cursor="pointer" />
                  <Bar dataKey="daHoanThanh" name="Đã hoàn thành" fill="#06b6d4" radius={[4, 4, 0, 0]} cursor="pointer" />
                </BarChart>
              ) : (
                <LineChart
                  data={reportData.theoNamThang}
                  onClick={handleMonthBarClick}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line type="monotone" dataKey="kiemTra" name="Kiểm tra" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="giamSat" name="Giám sát" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="daHoanThanh" name="Đã hoàn thành" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Biểu đồ 2: Tròn Trạng thái thực hiện / Loại hình */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-800">
                {pieMode === 'TRANG_THAI' ? 'Cơ cấu Trạng thái' : 'Cơ cấu Loại hình'}
              </h3>
            </div>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px]">
              <button
                type="button"
                onClick={() => setPieMode('TRANG_THAI')}
                className={`px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
                  pieMode === 'TRANG_THAI' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Trạng thái
              </button>
              <button
                type="button"
                onClick={() => setPieMode('LOAI_HINH')}
                className={`px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
                  pieMode === 'LOAI_HINH' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Loại hình
              </button>
            </div>
          </div>

          <div className="h-48 w-full flex-1">
            {kpi.tongChuongTrinh === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Không có dữ liệu phù hợp
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieMode === 'TRANG_THAI' ? reportData.theoTrangThai : reportData.theoLoaiHinh}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    innerRadius={35}
                    paddingAngle={3}
                    cursor="pointer"
                    onClick={pieMode === 'TRANG_THAI' ? handleTrangThaiSliceClick : handleLoaiHinhSliceClick}
                  >
                    {(pieMode === 'TRANG_THAI' ? reportData.theoTrangThai : reportData.theoLoaiHinh).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any, item: any) => [
                      `${value} (${item.payload.percent}%)`,
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. BIỂU ĐỒ PHÂN BỐ LĨNH VỰC VÀ ĐƠN THƯ ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Biểu đồ Cột theo Lĩnh vực KT-GS */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-800">Phân bố theo Lĩnh vực nghiệp vụ</h3>
            </div>
            <span className="text-[11px] text-slate-400">Số cuộc KT-GS</span>
          </div>

          <div className="h-56 w-full">
            {reportData.theoLinhVuc.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Chưa có dữ liệu lĩnh vực
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={reportData.theoLinhVuc.slice(0, 7)}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={110}
                    tick={{ fontSize: 11, fill: '#334155' }}
                  />
                  <Tooltip
                    formatter={(val: any) => [`${val} cuộc`, 'Số lượng']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" name="Số cuộc" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Biểu đồ Tròn: Đơn thư theo hướng xử lý */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs font-bold text-slate-800">Cơ cấu Đơn thư theo Hướng xử lý</h3>
            </div>
            <span className="text-[11px] text-slate-400 italic">Bấm vào lát</span>
          </div>

          <div className="h-56 w-full flex-1">
            {reportData.filteredDonThu.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Không có đơn thư trong kỳ báo cáo
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reportData.donThuStats.theoHuongXuLy}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={30}
                    paddingAngle={3}
                    cursor="pointer"
                    onClick={(entry) => handleDonThuSliceClick(entry, 'HUONG_XU_LY')}
                  >
                    {reportData.donThuStats.theoHuongXuLy.map((_entry, index) => (
                      <Cell key={`cell-dt-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any, item: any) => [
                      `${value} (${item.payload.percent}%)`,
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── 5. BẢNG CHI TIẾT DỮ LIỆU ĐA CHIỀU (TABS) ── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 pt-2 overflow-x-auto">
          <button
            onClick={() => setActiveTableTab('DON_VI')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTableTab === 'DON_VI'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Tiến độ theo Đơn vị ({reportData.theoDonVi.length})</span>
          </button>

          <button
            onClick={() => setActiveTableTab('CAN_BO')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTableTab === 'CAN_BO'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Theo Cán bộ phụ trách ({reportData.theoCanBo.length})</span>
          </button>

          <button
            onClick={() => setActiveTableTab('SO_SANH')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTableTab === 'SO_SANH'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>So sánh 2 năm</span>
          </button>

          <button
            onClick={() => setActiveTableTab('DON_THU')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTableTab === 'DON_THU'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Thống kê Đơn thư ({reportData.filteredDonThu.length})</span>
          </button>
        </div>

        {/* Tab 1: Tiến độ theo đơn vị */}
        {activeTableTab === 'DON_VI' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">STT</th>
                  <th className="py-2.5 px-3">Mã đơn vị</th>
                  <th className="py-2.5 px-3">Tên đơn vị / Tổ chức</th>
                  <th className="py-2.5 px-3 text-center">Kiểm tra</th>
                  <th className="py-2.5 px-3 text-center">Giám sát</th>
                  <th className="py-2.5 px-3 text-center">Đã hoàn thành</th>
                  <th className="py-2.5 px-3 text-center">Đang làm</th>
                  <th className="py-2.5 px-3 text-center">Quá hạn</th>
                  <th className="py-2.5 px-3 text-center font-bold">Tổng số</th>
                  <th className="py-2.5 px-3 text-center">Tỷ lệ HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {reportData.theoDonVi.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Không có đơn vị nào
                    </td>
                  </tr>
                ) : (
                  reportData.theoDonVi.map((u, idx) => (
                    <tr
                      key={u.donViId}
                      onClick={() => handleUnitClick(u)}
                      className="hover:bg-blue-50/50 transition cursor-pointer"
                    >
                      <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                        {u.maDonVi || '—'}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span>{u.tenDonVi}</span>
                          {u.donViId === 'UNASSIGNED' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-normal">
                              Chưa gắn
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center text-blue-600 font-medium">{u.soKiemTra}</td>
                      <td className="py-2 px-3 text-center text-emerald-600 font-medium">{u.soGiamSat}</td>
                      <td className="py-2 px-3 text-center text-emerald-700 font-semibold">{u.daHoanThanh}</td>
                      <td className="py-2 px-3 text-center text-slate-600">{u.dangThucHien}</td>
                      <td className="py-2 px-3 text-center">
                        {u.quaHan > 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-700 font-bold">
                            {u.quaHan}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-900 bg-slate-50/50">
                        {u.tong}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`font-semibold ${
                            u.tyLeHoanThanh >= 80
                              ? 'text-emerald-600'
                              : u.tyLeHoanThanh >= 50
                              ? 'text-blue-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {u.tyLeHoanThanh}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {/* Dòng tổng cộng */}
              <tfoot className="bg-slate-50 text-slate-900 font-bold border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 text-right">
                    Tổng cộng:
                  </td>
                  <td className="py-2.5 px-3 text-center text-blue-600">{kpi.soKiemTra}</td>
                  <td className="py-2.5 px-3 text-center text-emerald-600">{kpi.soGiamSat}</td>
                  <td className="py-2.5 px-3 text-center text-emerald-700">{kpi.daHoanThanh}</td>
                  <td className="py-2.5 px-3 text-center text-slate-600">{kpi.dangThucHien}</td>
                  <td className="py-2.5 px-3 text-center text-rose-600">{kpi.quaHan}</td>
                  <td className="py-2.5 px-3 text-center text-blue-700 font-black">{kpi.tongChuongTrinh}</td>
                  <td className="py-2.5 px-3 text-center text-emerald-700">{kpi.tyLeHoanThanh}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Tab 2: Theo cán bộ phụ trách */}
        {activeTableTab === 'CAN_BO' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">STT</th>
                  <th className="py-2.5 px-3">Họ và tên cán bộ</th>
                  <th className="py-2.5 px-3">Chức danh / Vai trò</th>
                  <th className="py-2.5 px-3 text-center">Số ĐV phụ trách</th>
                  <th className="py-2.5 px-3 text-center">Số cuộc KT-GS</th>
                  <th className="py-2.5 px-3 text-center">Đơn thư phụ trách</th>
                  <th className="py-2.5 px-3 text-center">Quá hạn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {reportData.theoCanBo.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Chưa có dữ liệu cán bộ
                    </td>
                  </tr>
                ) : (
                  reportData.theoCanBo.map((c, idx) => (
                    <tr key={c.userId} className="hover:bg-slate-50/80 transition">
                      <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{c.hoTen}</td>
                      <td className="py-2 px-3 text-slate-500">
                        {c.chucDanh} ({c.vaiTro})
                      </td>
                      <td className="py-2 px-3 text-center font-medium text-slate-700">
                        {c.soDonViPhuTrach}
                      </td>
                      <td className="py-2 px-3 text-center font-semibold text-blue-600">
                        {c.soChuongTrinh}
                      </td>
                      <td className="py-2 px-3 text-center font-semibold text-purple-600">
                        {c.soDonThu}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {c.soQuaHan > 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-700 font-bold">
                            {c.soQuaHan}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: So sánh 2 năm */}
        {activeTableTab === 'SO_SANH' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">STT</th>
                  <th className="py-2.5 px-3">Chỉ tiêu thống kê</th>
                  <th className="py-2.5 px-3 text-center">
                    Năm {typeof filterNam === 'number' ? filterNam : currentYear}
                  </th>
                  <th className="py-2.5 px-3 text-center">
                    Năm {(typeof filterNam === 'number' ? filterNam : currentYear) - 1}
                  </th>
                  <th className="py-2.5 px-3 text-center">Chênh lệch</th>
                  <th className="py-2.5 px-3 text-center">Tăng / Giảm (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {reportData.soSanhHaiNam.map((row, idx) => (
                  <tr key={row.metric} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{row.metric}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-blue-600">{row.yearA}</td>
                    <td className="py-2.5 px-3 text-center font-medium text-slate-600">{row.yearB}</td>
                    <td className="py-2.5 px-3 text-center font-semibold">
                      {row.diff > 0 ? (
                        <span className="text-emerald-600">+{row.diff}</span>
                      ) : row.diff < 0 ? (
                        <span className="text-rose-600">{row.diff}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {row.percentChange !== null ? (
                        <span
                          className={`font-semibold ${
                            row.percentChange > 0
                              ? 'text-emerald-600'
                              : row.percentChange < 0
                              ? 'text-rose-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {row.percentChange > 0 ? `+${row.percentChange}%` : `${row.percentChange}%`}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Thống kê đơn thư */}
        {activeTableTab === 'DON_THU' && (
          <div className="overflow-x-auto p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Bảng nhỏ theo Trạng thái */}
              <div className="border border-slate-200 rounded-lg p-3">
                <h4 className="text-xs font-bold text-slate-700 mb-2">Theo Trạng thái xử lý</h4>
                <div className="space-y-1.5 text-xs">
                  {reportData.donThuStats.theoTrangThai.map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-600">{item.label}</span>
                      <span className="font-bold text-slate-800">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bảng nhỏ theo Lĩnh vực */}
              <div className="border border-slate-200 rounded-lg p-3">
                <h4 className="text-xs font-bold text-slate-700 mb-2">Theo Lĩnh vực đơn thư</h4>
                <div className="space-y-1.5 text-xs">
                  {reportData.donThuStats.theoLinhVuc.map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-600">{item.label}</span>
                      <span className="font-bold text-slate-800">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bảng nhỏ theo Loại đơn */}
              <div className="border border-slate-200 rounded-lg p-3">
                <h4 className="text-xs font-bold text-slate-700 mb-2">Theo Loại đơn</h4>
                <div className="space-y-1.5 text-xs">
                  {reportData.donThuStats.theoLoaiDon.map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-600">{item.label}</span>
                      <span className="font-bold text-slate-800">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Danh sách các đơn thư trong kỳ */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 font-bold text-slate-700 text-xs border-b border-slate-200 flex items-center justify-between">
                <span>Danh sách đơn thư ({reportData.filteredDonThu.length})</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Quá hạn: {reportData.donThuStats.quaHan} đơn
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/50 text-slate-500 font-medium border-b border-slate-100">
                    <tr>
                      <th className="py-2 px-3">Mã đơn</th>
                      <th className="py-2 px-3">Ngày nhận</th>
                      <th className="py-2 px-3">Lĩnh vực</th>
                      <th className="py-2 px-3">Người/Đối tượng</th>
                      <th className="py-2 px-3">Cán bộ phụ trách</th>
                      <th className="py-2 px-3">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {reportData.filteredDonThu.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          Không có đơn thư nào trong kỳ
                        </td>
                      </tr>
                    ) : (
                      reportData.filteredDonThu.map((dt) => (
                        <tr key={dt.id} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 font-semibold text-blue-600">{dt.ma_don}</td>
                          <td className="py-2 px-3 text-slate-500">{dt.ngay_tiep_nhan}</td>
                          <td className="py-2 px-3">{dt.linh_vuc}</td>
                          <td className="py-2 px-3">{dt.doi_tuong_lien_quan}</td>
                          <td className="py-2 px-3 font-medium">{dt.can_bo_phu_trach}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                              {dt.trang_thai}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 6. MODAL XEM CHI TIẾT KHI BẤM VÀO BIỂU ĐỒ HOẶC THẺ CHỈ TIÊU (DRILL-DOWN) ── */}
      {drillDownModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">{drillDownModal.title}</h3>
              </div>
              <button
                onClick={() => setDrillDownModal({ isOpen: false, title: '', items: [] })}
                className="w-7 h-7 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="px-5 py-2.5 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm nhanh theo nội dung, số văn bản, tên đơn vị..."
                  value={drillDownSearch}
                  onChange={(e) => setDrillDownSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {drillDownModal.complaintItems && drillDownModal.complaintItems.length > 0 ? (
                // Hiển thị danh sách đơn thư
                <div className="space-y-2">
                  {filteredModalComplaints.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-lg border border-slate-200 bg-white hover:border-blue-300 transition"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-blue-600">{c.ma_don}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                          {c.trang_thai}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 font-medium">Đối tượng: {c.doi_tuong_lien_quan}</p>
                      <div className="flex items-center gap-4 text-[11px] text-slate-500 mt-2">
                        <span>Lĩnh vực: {c.linh_vuc}</span>
                        <span>Cán bộ: {c.can_bo_phu_trach}</span>
                        <span>Ngày nhận: {c.ngay_tiep_nhan}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredModalPrograms.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Không tìm thấy bản ghi nào phù hợp
                </div>
              ) : (
                // Hiển thị danh sách chương trình KT-GS
                <div className="space-y-2.5">
                  {filteredModalPrograms.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-blue-300 transition flex items-start gap-3"
                    >
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              item.loai_hinh === 'KIEM_TRA'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {item.loai_hinh === 'KIEM_TRA' ? 'KIỂM TRA' : 'GIÁM SÁT'}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                              item.trang_thai === 'DA_HOAN_THANH'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.trang_thai === 'DANG_THUC_HIEN'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.trang_thai === 'DA_HOAN_THANH'
                              ? 'Đã hoàn thành'
                              : item.trang_thai === 'DANG_THUC_HIEN'
                              ? 'Đang thực hiện'
                              : 'Chưa thực hiện'}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 leading-snug">
                          {item.ten_chuong_trinh || item.noi_dung}
                        </h4>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-2">
                          <span className="flex items-center gap-1">
                            <Landmark className="w-3.5 h-3.5 text-slate-400" />
                            Đơn vị: {item.ten_don_vi || 'Chưa gắn đơn vị'}
                          </span>
                          {item.so_van_ban && <span>Số VB: {item.so_van_ban}</span>}
                          {item.ngay_bat_dau && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {item.ngay_bat_dau} {item.ngay_ket_thuc ? `→ ${item.ngay_ket_thuc}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>
                Hiển thị {drillDownModal.complaintItems ? filteredModalComplaints.length : filteredModalPrograms.length} bản ghi
              </span>
              <button
                onClick={() => setDrillDownModal({ isOpen: false, title: '', items: [] })}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThongKeManager;
