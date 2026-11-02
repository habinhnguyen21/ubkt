import type {
  ChuongTrinhKtGs,
  DonThu,
  DonVi,
  PhanCongDiaBan,
  User,
  LoaiHinhKtGs,
} from '../types';
import { isTaskOverdue, computeDashboardStats } from './dashboardStats';
import { getUserUnitIds, parseDateLoose } from '../utils/reminders';

export { isTaskOverdue, computeDashboardStats };

export interface ReportFilter {
  nam?: number | 'ALL';
  tuNgay?: string; // YYYY-MM-DD
  denNgay?: string; // YYYY-MM-DD
  donViId?: string | 'ALL';
  loaiHinh?: LoaiHinhKtGs | 'ALL';
  ngayChot?: string | Date; // Ngày chốt số liệu
}

export interface KpiSummary {
  tongChuongTrinh: number;
  soKiemTra: number;
  soGiamSat: number;
  daHoanThanh: number;
  dangThucHien: number;
  chuaThucHien: number;
  quaHan: number;
  tyLeHoanThanh: number; // 0 - 100
  tongDonThu: number;
  donThuDangXuLy: number;
  donThuDaHoanThanh: number;
  donThuQuaHan: number;
}

export interface MonthStat {
  thang: number;
  label: string;
  kiemTra: number;
  giamSat: number;
  daHoanThanh: number;
  tong: number;
}

export interface SliceStat {
  key: string;
  label: string;
  count: number;
  percent: number;
  color?: string;
}

export interface UnitStatRow {
  donViId: string;
  tenDonVi: string;
  maDonVi: string | null;
  loaiDonVi: string;
  soKiemTra: number;
  soGiamSat: number;
  daHoanThanh: number;
  dangThucHien: number;
  chuaThucHien: number;
  quaHan: number;
  tong: number;
  tyLeHoanThanh: number;
}

export interface OfficerStatRow {
  userId: string;
  hoTen: string;
  chucDanh: string;
  vaiTro: string;
  soDonViPhuTrach: number;
  soChuongTrinh: number;
  soDonThu: number;
  soQuaHan: number;
}

export interface DonThuReportStats {
  tongSoDon: number;
  daHoanThanh: number;
  dangXuLy: number;
  quaHan: number;
  theoTrangThai: SliceStat[];
  theoLinhVuc: SliceStat[];
  theoHuongXuLy: SliceStat[];
  theoLoaiDon: SliceStat[];
  danhSachDonThu: DonThu[];
}

export interface YearComparisonRow {
  metric: string;
  yearA: number;
  yearB: number;
  diff: number;
  percentChange: number | null;
}

export interface ComprehensiveReportData {
  kpi: KpiSummary;
  theoNamThang: MonthStat[];
  theoLoaiHinh: SliceStat[];
  theoTrangThai: SliceStat[];
  theoLinhVuc: SliceStat[];
  theoDonVi: UnitStatRow[];
  theoCanBo: OfficerStatRow[];
  donThuStats: DonThuReportStats;
  soSanhHaiNam: YearComparisonRow[];
  filteredChuongTrinh: ChuongTrinhKtGs[];
  filteredDonThu: DonThu[];
  availableYears: number[];
  availableUnits: DonVi[];
}

/**
 * Chuẩn hóa chuỗi ngày YYYY-MM-DD
 */
export function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Trích xuất ngày đại diện của chương trình (YYYY-MM-DD)
 */
export function getTaskDateStr(task: ChuongTrinhKtGs): string | null {
  if (task.ngay_bat_dau) return task.ngay_bat_dau.slice(0, 10);
  if (task.ngay_ban_hanh) return task.ngay_ban_hanh.slice(0, 10);
  if (task.ngay_ket_thuc) return task.ngay_ket_thuc.slice(0, 10);
  if (task.created_at) return task.created_at.slice(0, 10);
  if (task.nam) return `${task.nam}-01-01`;
  return null;
}

/**
 * Trích xuất ngày đại diện của đơn thư (YYYY-MM-DD)
 */
export function getComplaintDateStr(complaint: DonThu): string | null {
  if (complaint.ngay_tiep_nhan) return complaint.ngay_tiep_nhan.slice(0, 10);
  return null;
}

/**
 * Kiểm tra xem đơn thư có quá hạn hay không tại mốc ngày cho trước
 */
export function isComplaintOverdue(complaint: DonThu, refDate: Date = new Date()): boolean {
  if (complaint.trang_thai === 'Đã hoàn thành') {
    return false;
  }
  if (complaint.trang_thai === 'Quá hạn') {
    return true;
  }
  if (!complaint.ngay_tiep_nhan) return false;
  const receiveDate = parseDateLoose(complaint.ngay_tiep_nhan);
  if (!receiveDate) return false;

  const deadline = new Date(receiveDate.getTime());
  deadline.setDate(deadline.getDate() + (complaint.thoi_han_quy_dinh || 30));
  deadline.setHours(23, 59, 59, 999);

  return refDate.getTime() > deadline.getTime();
}

/**
 * Lọc dữ liệu theo phân quyền (ADMIN/XEM thấy tất cả, BIEN_TAP chỉ thấy đơn vị được phân công)
 */
export function filterDataByPermission(
  chuongTrinhList: ChuongTrinhKtGs[],
  donThuList: DonThu[],
  phanCongList: PhanCongDiaBan[],
  currentUser: User | null
): {
  allowedChuongTrinh: ChuongTrinhKtGs[];
  allowedDonThu: DonThu[];
} {
  if (!currentUser || currentUser.vai_tro === 'ADMIN' || currentUser.vai_tro === 'XEM') {
    return {
      allowedChuongTrinh: chuongTrinhList || [],
      allowedDonThu: donThuList || [],
    };
  }

  // BIEN_TAP: Lấy các đơn vị được phân công
  const assignedUnitIds = getUserUnitIds(currentUser, phanCongList || []);
  const userNameLower = (currentUser.ho_ten || '').trim().toLowerCase();

  const allowedChuongTrinh = (chuongTrinhList || []).filter((ct) => {
    if (!ct) return false;
    // Kiểm tra don_vi_id hoặc các trường ID liên kết
    if (ct.don_vi_id && assignedUnitIds.has(ct.don_vi_id)) return true;
    if (ct.chu_the_don_vi_id && assignedUnitIds.has(ct.chu_the_don_vi_id)) return true;
    if (ct.chi_dang_bo_id && assignedUnitIds.has(ct.chi_dang_bo_id)) return true;
    if (ct.doi_tuong_don_vi_id && assignedUnitIds.has(ct.doi_tuong_don_vi_id)) return true;
    return false;
  });

  const allowedDonThu = (donThuList || []).filter((dt) => {
    if (!dt) return false;
    // Cán bộ phụ trách khớp tên
    if (dt.can_bo_phu_trach && dt.can_bo_phu_trach.trim().toLowerCase().includes(userNameLower)) {
      return true;
    }
    return false;
  });

  return { allowedChuongTrinh, allowedDonThu };
}

/**
 * Lọc danh sách chương trình theo tiêu chí thời gian, loại hình, đơn vị và ngày chốt
 */
export function filterChuongTrinh(
  list: ChuongTrinhKtGs[],
  filters: ReportFilter
): ChuongTrinhKtGs[] {
  const ngayChotStr = filters.ngayChot
    ? typeof filters.ngayChot === 'string'
      ? filters.ngayChot.slice(0, 10)
      : formatYmd(filters.ngayChot)
    : null;

  return (list || []).filter((item) => {
    if (!item) return false;

    // 1. Ngày chốt: Loại bỏ các bản ghi phát sinh sau ngày chốt
    const itemDateStr = getTaskDateStr(item);
    if (ngayChotStr && itemDateStr && itemDateStr > ngayChotStr) {
      return false;
    }

    // 2. Lọc theo năm
    if (filters.nam && filters.nam !== 'ALL') {
      const targetYear = Number(filters.nam);
      const itemYear = item.nam || (itemDateStr ? parseInt(itemDateStr.slice(0, 4), 10) : null);
      if (itemYear !== targetYear) return false;
    }

    // 3. Ranh giới ngày (Từ ngày - Đến ngày)
    if (filters.tuNgay && itemDateStr) {
      if (itemDateStr < filters.tuNgay) return false;
    }
    if (filters.denNgay && itemDateStr) {
      if (itemDateStr > filters.denNgay) return false;
    }

    // 4. Lọc theo đơn vị
    if (filters.donViId && filters.donViId !== 'ALL') {
      if (filters.donViId === 'UNASSIGNED') {
        if (item.don_vi_id) return false;
      } else {
        if (item.don_vi_id !== filters.donViId) return false;
      }
    }

    // 5. Lọc theo loại hình
    if (filters.loaiHinh && filters.loaiHinh !== 'ALL') {
      if (item.loai_hinh !== filters.loaiHinh) return false;
    }

    return true;
  });
}

/**
 * Lọc danh sách đơn thư theo tiêu chí
 */
export function filterDonThu(
  list: DonThu[],
  filters: ReportFilter
): DonThu[] {
  const ngayChotStr = filters.ngayChot
    ? typeof filters.ngayChot === 'string'
      ? filters.ngayChot.slice(0, 10)
      : formatYmd(filters.ngayChot)
    : null;

  return (list || []).filter((item) => {
    if (!item) return false;

    const dateStr = getComplaintDateStr(item);

    // Ngày chốt
    if (ngayChotStr && dateStr && dateStr > ngayChotStr) {
      return false;
    }

    // Lọc theo năm tiếp nhận
    if (filters.nam && filters.nam !== 'ALL') {
      const targetYear = Number(filters.nam);
      const itemYear = dateStr ? parseInt(dateStr.slice(0, 4), 10) : null;
      if (itemYear !== targetYear) return false;
    }

    // Ranh giới ngày
    if (filters.tuNgay && dateStr) {
      if (dateStr < filters.tuNgay) return false;
    }
    if (filters.denNgay && dateStr) {
      if (dateStr > filters.denNgay) return false;
    }

    return true;
  });
}

/**
 * Hàm THUẦN tính toán toàn bộ số liệu thống kê báo cáo
 */
export function generateComprehensiveReport(params: {
  chuongTrinhList: ChuongTrinhKtGs[];
  donThuList: DonThu[];
  donViList: DonVi[];
  phanCongList: PhanCongDiaBan[];
  userList: User[];
  currentUser: User | null;
  filters: ReportFilter;
}): ComprehensiveReportData {
  const {
    chuongTrinhList,
    donThuList,
    donViList,
    phanCongList,
    userList,
    currentUser,
    filters,
  } = params;

  // 1. Phân quyền truy cập
  const { allowedChuongTrinh, allowedDonThu } = filterDataByPermission(
    chuongTrinhList,
    donThuList,
    phanCongList,
    currentUser
  );

  // 2. Lọc theo bộ lọc người dùng
  const filteredChuongTrinh = filterChuongTrinh(allowedChuongTrinh, filters);
  const filteredDonThu = filterDonThu(allowedDonThu, filters);

  const refDate = filters.ngayChot
    ? typeof filters.ngayChot === 'string'
      ? new Date(filters.ngayChot)
      : filters.ngayChot
    : new Date();

  // 3. Thẻ KPI tổng hợp
  let soKiemTra = 0;
  let soGiamSat = 0;
  let daHoanThanh = 0;
  let dangThucHien = 0;
  let chuaThucHien = 0;
  let quaHan = 0;

  for (const ct of filteredChuongTrinh) {
    if (ct.loai_hinh === 'KIEM_TRA') soKiemTra++;
    else if (ct.loai_hinh === 'GIAM_SAT') soGiamSat++;

    if (isTaskOverdue(ct)) {
      quaHan++;
    }

    if (ct.trang_thai === 'DA_HOAN_THANH') daHoanThanh++;
    else if (ct.trang_thai === 'DANG_THUC_HIEN') dangThucHien++;
    else chuaThucHien++;
  }

  const tongChuongTrinh = filteredChuongTrinh.length;
  const tyLeHoanThanh = tongChuongTrinh > 0 ? Math.round((daHoanThanh / tongChuongTrinh) * 100) : 0;

  let donThuDaHoanThanh = 0;
  let donThuDangXuLy = 0;
  let donThuQuaHan = 0;

  for (const dt of filteredDonThu) {
    if (dt.trang_thai === 'Đã hoàn thành') {
      donThuDaHoanThanh++;
    } else {
      donThuDangXuLy++;
    }
    if (isComplaintOverdue(dt, refDate)) {
      donThuQuaHan++;
    }
  }

  const kpi: KpiSummary = {
    tongChuongTrinh,
    soKiemTra,
    soGiamSat,
    daHoanThanh,
    dangThucHien,
    chuaThucHien,
    quaHan,
    tyLeHoanThanh,
    tongDonThu: filteredDonThu.length,
    donThuDangXuLy,
    donThuDaHoanThanh,
    donThuQuaHan,
  };

  // 4. Thống kê theo 12 tháng
  const monthMap: Record<number, MonthStat> = {};
  for (let m = 1; m <= 12; m++) {
    monthMap[m] = {
      thang: m,
      label: `Tháng ${m}`,
      kiemTra: 0,
      giamSat: 0,
      daHoanThanh: 0,
      tong: 0,
    };
  }

  for (const ct of filteredChuongTrinh) {
    const dStr = getTaskDateStr(ct);
    if (dStr) {
      const monthNum = parseInt(dStr.slice(5, 7), 10);
      if (monthNum >= 1 && monthNum <= 12) {
        monthMap[monthNum].tong++;
        if (ct.loai_hinh === 'KIEM_TRA') monthMap[monthNum].kiemTra++;
        if (ct.loai_hinh === 'GIAM_SAT') monthMap[monthNum].giamSat++;
        if (ct.trang_thai === 'DA_HOAN_THANH') monthMap[monthNum].daHoanThanh++;
      }
    }
  }
  const theoNamThang = Object.values(monthMap);

  // 5. Thống kê theo loại hình (KIEM_TRA / GIAM_SAT / KHAC)
  const theoLoaiHinh: SliceStat[] = [
    {
      key: 'KIEM_TRA',
      label: 'Kiểm tra',
      count: soKiemTra,
      percent: tongChuongTrinh > 0 ? Math.round((soKiemTra / tongChuongTrinh) * 100) : 0,
      color: '#2563eb',
    },
    {
      key: 'GIAM_SAT',
      label: 'Giám sát',
      count: soGiamSat,
      percent: tongChuongTrinh > 0 ? Math.round((soGiamSat / tongChuongTrinh) * 100) : 0,
      color: '#10b981',
    },
  ];
  const countKhac = tongChuongTrinh - (soKiemTra + soGiamSat);
  if (countKhac > 0) {
    theoLoaiHinh.push({
      key: 'KHAC',
      label: 'Khác',
      count: countKhac,
      percent: Math.round((countKhac / tongChuongTrinh) * 100),
      color: '#94a3b8',
    });
  }

  // 6. Thống kê theo trạng thái
  const theoTrangThai: SliceStat[] = [
    {
      key: 'DA_HOAN_THANH',
      label: 'Đã hoàn thành',
      count: daHoanThanh,
      percent: tongChuongTrinh > 0 ? Math.round((daHoanThanh / tongChuongTrinh) * 100) : 0,
      color: '#10b981',
    },
    {
      key: 'DANG_THUC_HIEN',
      label: 'Đang thực hiện',
      count: dangThucHien,
      percent: tongChuongTrinh > 0 ? Math.round((dangThucHien / tongChuongTrinh) * 100) : 0,
      color: '#3b82f6',
    },
    {
      key: 'CHUA_THUC_HIEN',
      label: 'Chưa thực hiện',
      count: chuaThucHien,
      percent: tongChuongTrinh > 0 ? Math.round((chuaThucHien / tongChuongTrinh) * 100) : 0,
      color: '#eab308',
    },
  ];

  // 7. Thống kê theo lĩnh vực
  const linhVucCounts: Record<string, number> = {};
  for (const ct of filteredChuongTrinh) {
    const lv = (ct.linh_vuc || 'Chưa phân loại').trim();
    linhVucCounts[lv] = (linhVucCounts[lv] || 0) + 1;
  }
  const theoLinhVuc: SliceStat[] = Object.entries(linhVucCounts)
    .map(([key, count]) => ({
      key,
      label: key,
      count,
      percent: tongChuongTrinh > 0 ? Math.round((count / tongChuongTrinh) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // 8. Thống kê theo đơn vị
  // Yêu cầu quan trọng: "Chương trình không có don_vi_id thì gom vào dòng 'Chưa gắn đơn vị' để tổng vẫn khớp."
  const unitMap: Record<string, UnitStatRow> = {};
  const activeDonViList = (donViList || []).filter((d) => !d.deleted_at);

  for (const d of activeDonViList) {
    unitMap[d.id] = {
      donViId: d.id,
      tenDonVi: d.ten,
      maDonVi: d.ma || null,
      loaiDonVi: d.loai,
      soKiemTra: 0,
      soGiamSat: 0,
      daHoanThanh: 0,
      dangThucHien: 0,
      chuaThucHien: 0,
      quaHan: 0,
      tong: 0,
      tyLeHoanThanh: 0,
    };
  }

  // Row cho bản ghi chưa gắn đơn vị
  const unassignedRow: UnitStatRow = {
    donViId: 'UNASSIGNED',
    tenDonVi: 'Chưa gắn đơn vị',
    maDonVi: null,
    loaiDonVi: 'KHAC',
    soKiemTra: 0,
    soGiamSat: 0,
    daHoanThanh: 0,
    dangThucHien: 0,
    chuaThucHien: 0,
    quaHan: 0,
    tong: 0,
    tyLeHoanThanh: 0,
  };

  for (const ct of filteredChuongTrinh) {
    const targetRow = (ct.don_vi_id && unitMap[ct.don_vi_id]) ? unitMap[ct.don_vi_id] : unassignedRow;
    targetRow.tong++;
    if (ct.loai_hinh === 'KIEM_TRA') targetRow.soKiemTra++;
    else if (ct.loai_hinh === 'GIAM_SAT') targetRow.soGiamSat++;

    if (ct.trang_thai === 'DA_HOAN_THANH') targetRow.daHoanThanh++;
    else if (ct.trang_thai === 'DANG_THUC_HIEN') targetRow.dangThucHien++;
    else targetRow.chuaThucHien++;

    if (isTaskOverdue(ct)) targetRow.quaHan++;
  }

  // Tính tỷ lệ hoàn thành cho mỗi đơn vị
  const allUnitRows: UnitStatRow[] = Object.values(unitMap).map((row) => ({
    ...row,
    tyLeHoanThanh: row.tong > 0 ? Math.round((row.daHoanThanh / row.tong) * 100) : 0,
  }));

  if (unassignedRow.tong > 0) {
    unassignedRow.tyLeHoanThanh =
      unassignedRow.tong > 0 ? Math.round((unassignedRow.daHoanThanh / unassignedRow.tong) * 100) : 0;
    allUnitRows.push(unassignedRow);
  }

  // Sắp xếp: các đơn vị có số lượng chương trình nhiều xếp trước
  const theoDonVi = allUnitRows.sort((a, b) => b.tong - a.tong || a.tenDonVi.localeCompare(b.tenDonVi));

  // 9. Thống kê theo cán bộ phụ trách
  const officerMap: Record<string, OfficerStatRow> = {};
  for (const u of userList || []) {
    officerMap[u.id] = {
      userId: u.id,
      hoTen: u.ho_ten || u.ten_dang_nhap,
      chucDanh: String(u.chuc_danh || 'Cán bộ'),
      vaiTro: u.vai_tro,
      soDonViPhuTrach: 0,
      soChuongTrinh: 0,
      soDonThu: 0,
      soQuaHan: 0,
    };
  }

  // Đếm số đơn vị phụ trách và chương trình thuộc đơn vị đó
  const userAssignedUnits: Record<string, Set<string>> = {};
  for (const pc of phanCongList || []) {
    if (!pc || pc.trang_thai === 'DA_CHUYEN_GIAO') continue;
    if (!userAssignedUnits[pc.user_id]) userAssignedUnits[pc.user_id] = new Set();
    for (const uid of pc.don_vi_ids || []) {
      userAssignedUnits[pc.user_id].add(uid);
    }
  }

  for (const [uid, unitSet] of Object.entries(userAssignedUnits)) {
    if (officerMap[uid]) {
      officerMap[uid].soDonViPhuTrach = unitSet.size;
      for (const ct of filteredChuongTrinh) {
        if (ct.don_vi_id && unitSet.has(ct.don_vi_id)) {
          officerMap[uid].soChuongTrinh++;
          if (isTaskOverdue(ct)) officerMap[uid].soQuaHan++;
        }
      }
    }
  }

  // Đếm số đơn thư giao cho từng cán bộ
  for (const dt of filteredDonThu) {
    const cbName = (dt.can_bo_phu_trach || '').trim().toLowerCase();
    if (!cbName) continue;
    for (const u of userList || []) {
      const uName = (u.ho_ten || '').trim().toLowerCase();
      if (uName && (cbName.includes(uName) || uName.includes(cbName))) {
        if (officerMap[u.id]) {
          officerMap[u.id].soDonThu++;
          if (isComplaintOverdue(dt, refDate)) {
            officerMap[u.id].soQuaHan++;
          }
        }
      }
    }
  }

  const theoCanBo = Object.values(officerMap).sort(
    (a, b) => b.soChuongTrinh + b.soDonThu - (a.soChuongTrinh + a.soDonThu)
  );

  // 10. Thống kê đơn thư chi tiết
  const dtTrangThaiCounts: Record<string, number> = {};
  const dtLinhVucCounts: Record<string, number> = {};
  const dtHuongXuLyCounts: Record<string, number> = {};
  const dtLoaiDonCounts: Record<string, number> = {};

  const trangThaiLabels: Record<string, string> = {
    TIEP_NHAN: 'Mới tiếp nhận',
    DANG_XU_LY: 'Đang xử lý',
    DA_XU_LY: 'Đã hoàn thành',
    CHUYEN_CO_QUAN_KHAC: 'Chuyển CQ khác',
    LUU_THEO_DOI: 'Lưu theo dõi',
  };

  for (const dt of filteredDonThu) {
    const tt = dt.trang_thai || 'TIEP_NHAN';
    dtTrangThaiCounts[tt] = (dtTrangThaiCounts[tt] || 0) + 1;

    const lv = dt.linh_vuc || 'Khác';
    dtLinhVucCounts[lv] = (dtLinhVucCounts[lv] || 0) + 1;

    const hxl = dt.huong_xu_ly || 'Khác';
    dtHuongXuLyCounts[hxl] = (dtHuongXuLyCounts[hxl] || 0) + 1;

    const ld = dt.loai_don || 'Khác';
    dtLoaiDonCounts[ld] = (dtLoaiDonCounts[ld] || 0) + 1;
  }

  const donThuStats: DonThuReportStats = {
    tongSoDon: filteredDonThu.length,
    daHoanThanh: donThuDaHoanThanh,
    dangXuLy: donThuDangXuLy,
    quaHan: donThuQuaHan,
    theoTrangThai: Object.entries(dtTrangThaiCounts).map(([k, count]) => ({
      key: k,
      label: trangThaiLabels[k] || k,
      count,
      percent: filteredDonThu.length > 0 ? Math.round((count / filteredDonThu.length) * 100) : 0,
    })),
    theoLinhVuc: Object.entries(dtLinhVucCounts).map(([k, count]) => ({
      key: k,
      label: k,
      count,
      percent: filteredDonThu.length > 0 ? Math.round((count / filteredDonThu.length) * 100) : 0,
    })),
    theoHuongXuLy: Object.entries(dtHuongXuLyCounts).map(([k, count]) => ({
      key: k,
      label: k,
      count,
      percent: filteredDonThu.length > 0 ? Math.round((count / filteredDonThu.length) * 100) : 0,
    })),
    theoLoaiDon: Object.entries(dtLoaiDonCounts).map(([k, count]) => ({
      key: k,
      label: k,
      count,
      percent: filteredDonThu.length > 0 ? Math.round((count / filteredDonThu.length) * 100) : 0,
    })),
    danhSachDonThu: filteredDonThu,
  };

  // 11. So sánh hai năm (Năm A vs Năm B)
  const currentYearNum = typeof filters.nam === 'number' ? filters.nam : new Date().getFullYear();
  const prevYearNum = currentYearNum - 1;

  const ctYearA = allowedChuongTrinh.filter((c) => c.nam === currentYearNum);
  const ctYearB = allowedChuongTrinh.filter((c) => c.nam === prevYearNum);

  const dtYearA = allowedDonThu.filter((d) => d.ngay_tiep_nhan && d.ngay_tiep_nhan.startsWith(String(currentYearNum)));
  const dtYearB = allowedDonThu.filter((d) => d.ngay_tiep_nhan && d.ngay_tiep_nhan.startsWith(String(prevYearNum)));

  const buildMetricComparison = (
    metric: string,
    valA: number,
    valB: number
  ): YearComparisonRow => {
    const diff = valA - valB;
    const percentChange = valB > 0 ? Math.round((diff / valB) * 100) : null;
    return { metric, yearA: valA, yearB: valB, diff, percentChange };
  };

  const soSanhHaiNam: YearComparisonRow[] = [
    buildMetricComparison('Tổng số cuộc KT-GS', ctYearA.length, ctYearB.length),
    buildMetricComparison(
      'Số cuộc kiểm tra',
      ctYearA.filter((c) => c.loai_hinh === 'KIEM_TRA').length,
      ctYearB.filter((c) => c.loai_hinh === 'KIEM_TRA').length
    ),
    buildMetricComparison(
      'Số cuộc giám sát',
      ctYearA.filter((c) => c.loai_hinh === 'GIAM_SAT').length,
      ctYearB.filter((c) => c.loai_hinh === 'GIAM_SAT').length
    ),
    buildMetricComparison(
      'Đã hoàn thành',
      ctYearA.filter((c) => c.trang_thai === 'DA_HOAN_THANH').length,
      ctYearB.filter((c) => c.trang_thai === 'DA_HOAN_THANH').length
    ),
    buildMetricComparison(
      'Tổng số đơn thư',
      dtYearA.length,
      dtYearB.length
    ),
    buildMetricComparison(
      'Đơn thư đã giải quyết',
      dtYearA.filter((d) => d.trang_thai === 'Đã hoàn thành').length,
      dtYearB.filter((d) => d.trang_thai === 'Đã hoàn thành').length
    ),
  ];

  // 12. Danh sách các năm có sẵn để hiển thị bộ lọc
  const yearsSet = new Set<number>();
  yearsSet.add(new Date().getFullYear());
  for (const c of chuongTrinhList || []) {
    if (c.nam) yearsSet.add(c.nam);
  }
  const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

  return {
    kpi,
    theoNamThang,
    theoLoaiHinh,
    theoTrangThai,
    theoLinhVuc,
    theoDonVi,
    theoCanBo,
    donThuStats,
    soSanhHaiNam,
    filteredChuongTrinh,
    filteredDonThu,
    availableYears,
    availableUnits: activeDonViList,
  };
}
