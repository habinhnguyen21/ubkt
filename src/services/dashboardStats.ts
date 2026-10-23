import type { ChuongTrinhKtGs, DonThu, DonVi, User } from '../types';

export interface DashboardFilterState {
  year: number | 'ALL';
  scopeType: 'ALL' | string; // 'ALL' or a DonViLoai like 'CHI_BO', 'DANG_BO', or specific unitId
  donViId: string | 'ALL';
  linhVuc: string | 'ALL';
}

export interface StatusSlice {
  key: string;
  label: string;
  count: number;
  percent: number;
  color: string;
}

export interface UnitProgressRow {
  donViId: string;
  ten: string;
  loai: string;
  ma: string | null;
  soKiemTra: number;
  soGiamSat: number;
  daHoanThanh: number;
  dangThucHien: number;
  chuaThucHien: number;
  quaHan: number;
  tongNhiemVu: number;
  tyLeHoanThanh: number;
}

export interface ComputedDashboardStats {
  unitName: string;
  availableYears: number[];
  availableScopes: { key: string; label: string; count: number }[];
  availableUnits: { id: string; ten: string; loai: string }[];
  availableLinhVuc: string[];
  
  // 4 Top Cards
  tongCoQuan: number;
  soCuocKiemTra: number;
  soCuocGiamSat: number;
  tongNhiemVu: number;

  // Chart 1: Donut Tình hình nhiệm vụ
  tinhHinhNhiemVu: {
    total: number;
    slices: StatusSlice[];
    daHoanThanh: { count: number; percent: number };
    dangThucHien: { count: number; percent: number };
    chuaTrienKhai: { count: number; percent: number };
    quaHan: { count: number; percent: number };
  };

  // Chart 2: Gauge Độ bao phủ
  doBaoPhu: {
    percent: number;
    daThucHien: number;
    chuaThucHien: number;
    tongCoQuan: number;
  };

  // Chart 3: Gauge Khắc phục kiến nghị
  khacPhucKienNghi: {
    percent: number;
    daHoanThanh: number;
    conPhaiThucHien: number;
    daQuaHan: number;
    tongKienNghi: number;
    hasData: boolean;
  };

  // Right Column: Điểm cần quan tâm
  diemQuanTam: {
    nhiemVuQuaHan: { count: number; note: string; items: ChuongTrinhKtGs[] };
    kienNghiChuaKhacPhuc: { count: number; note: string };
    donThuDangGiaiQuyet: { count: number; note: string };
    duLieuBaoCaoConThieu: { count: number; note: string; units: DonVi[] };
  };

  // Bảng tiến độ theo từng đơn vị
  tienDoTheoDonVi: UnitProgressRow[];
}

/**
 * Kiểm tra xem một nhiệm vụ có bị quá hạn hay không dựa trên trạng thái và ngày kết thúc
 */
export function isTaskOverdue(task: ChuongTrinhKtGs): boolean {
  if (task.trang_thai === 'QUA_HAN') return true;
  if (task.trang_thai === 'DA_HOAN_THANH') return false;
  if (task.ngay_ket_thuc) {
    const dueDate = new Date(task.ngay_ket_thuc);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  }
  return false;
}

/**
 * Tính toán toàn bộ chỉ tiêu bảng Tổng quan hoàn toàn động từ cơ sở dữ liệu
 */
export function computeDashboardStats(
  donViList: DonVi[],
  chuongTrinhList: ChuongTrinhKtGs[],
  donThuList: DonThu[],
  filters: DashboardFilterState,
  currentUser: User | null,
  configuredRootName?: string,
): ComputedDashboardStats {
  const activeUnits = (donViList || []).filter((d) => !d.deleted_at);
  const rootUnit = activeUnits.find((d) => !d.don_vi_cha_id) || activeUnits[0];

  // 1. Xác định tên đơn vị hiển thị
  const unitName =
    currentUser?.ten_don_vi ||
    configuredRootName ||
    (rootUnit ? rootUnit.ten : 'Đảng ủy cơ sở');

  // 2. Phạm vi đơn vị được phép truy cập theo tài khoản
  let accessibleUnits = activeUnits;
  if (currentUser && currentUser.vai_tro !== 'ADMIN' && currentUser.don_vi_id) {
    const userDonViId = currentUser.don_vi_id;
    const allowedIds = new Set<string>([userDonViId]);
    if (currentUser.pham_vi_quan_ly && Array.isArray(currentUser.pham_vi_quan_ly)) {
      currentUser.pham_vi_quan_ly.forEach((id) => allowedIds.add(id));
    }
    // Lấy thêm các chi bộ/đơn vị trực thuộc nếu đơn vị của user là cấp cha
    activeUnits.forEach((u) => {
      if (u.don_vi_cha_id && allowedIds.has(u.don_vi_cha_id)) {
        allowedIds.add(u.id);
      }
    });
    accessibleUnits = activeUnits.filter((u) => allowedIds.has(u.id));
  }

  const accessibleUnitIds = new Set(accessibleUnits.map((u) => u.id));

  // 3. Trích xuất danh sách các năm phát sinh trong chương trình kiểm tra, giám sát
  const yearsSet = new Set<number>();
  const currentYear = new Date().getFullYear();
  yearsSet.add(currentYear);
  (chuongTrinhList || []).forEach((c) => {
    if (c.nam && typeof c.nam === 'number') {
      yearsSet.add(c.nam);
    }
  });
  const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

  // 4. Trích xuất các danh mục phân loại khối đơn vị động từ cơ cấu tổ chức
  const typeLabels: Record<string, string> = {
    CHI_BO: 'Khối Chi bộ',
    DANG_BO: 'Khối Đảng bộ cơ sở',
    BCH: 'Ban Chấp hành',
    BTV: 'Ban Thường vụ',
    UBKT: 'Ủy ban Kiểm tra',
  };

  // Gom các loại đơn vị thực tế có trong hệ thống
  const existingTypes = Array.from(new Set(accessibleUnits.map((u) => u.loai).filter(Boolean)));
  const availableScopes: { key: string; label: string; count: number }[] = [
    { key: 'ALL', label: 'Toàn Đảng bộ', count: accessibleUnits.length },
    ...existingTypes.map((t) => ({
      key: t,
      label: typeLabels[t] || `Khối ${t}`,
      count: accessibleUnits.filter((u) => u.loai === t).length,
    })),
  ];

  // 5. Trích xuất danh mục lĩnh vực động
  const linhVucSet = new Set<string>();
  (chuongTrinhList || []).forEach((c) => {
    if (c.linh_vuc && c.linh_vuc.trim()) linhVucSet.add(c.linh_vuc.trim());
  });
  (donThuList || []).forEach((d) => {
    if (d.linh_vuc && d.linh_vuc.trim()) linhVucSet.add(d.linh_vuc.trim());
  });
  const availableLinhVuc = Array.from(linhVucSet);

  // 6. Lọc các đơn vị theo bộ lọc phạm vi
  let filteredUnits = accessibleUnits;
  if (filters.scopeType !== 'ALL') {
    filteredUnits = filteredUnits.filter((u) => u.loai === filters.scopeType);
  }
  if (filters.donViId !== 'ALL') {
    filteredUnits = filteredUnits.filter((u) => u.id === filters.donViId);
  }
  const filteredUnitIds = new Set(filteredUnits.map((u) => u.id));

  // 7. Lọc danh sách chương trình KT-GS
  let filteredTasks = (chuongTrinhList || []).filter((c) => {
    // Thuộc phạm vi quyền truy cập của người dùng
    if (c.don_vi_id && !accessibleUnitIds.has(c.don_vi_id)) {
      return false;
    }
    // Lọc theo năm
    if (filters.year !== 'ALL' && c.nam !== filters.year) {
      return false;
    }
    // Lọc theo đơn vị / khối
    if (filters.donViId !== 'ALL' && c.don_vi_id !== filters.donViId) {
      return false;
    }
    if (filters.scopeType !== 'ALL' && c.don_vi_id && !filteredUnitIds.has(c.don_vi_id)) {
      return false;
    }
    // Lọc theo lĩnh vực
    if (filters.linhVuc !== 'ALL' && c.linh_vuc !== filters.linhVuc) {
      return false;
    }
    return true;
  });

  // 8. Tính toán 4 Thẻ chỉ tiêu chính
  const tongCoQuan = filteredUnits.length;
  const soCuocKiemTra = filteredTasks.filter((t) => t.loai_hinh === 'KIEM_TRA').length;
  const soCuocGiamSat = filteredTasks.filter((t) => t.loai_hinh === 'GIAM_SAT').length;
  const tongNhiemVu = filteredTasks.length;

  // 9. Tình hình thực hiện nhiệm vụ (Status Breakdown & Donut)
  let daHoanThanhCount = 0;
  let dangThucHienCount = 0;
  let chuaTrienKhaiCount = 0;
  let quaHanCount = 0;
  const overdueTasks: ChuongTrinhKtGs[] = [];

  filteredTasks.forEach((t) => {
    const overdue = isTaskOverdue(t);
    if (overdue) {
      quaHanCount++;
      overdueTasks.push(t);
    } else if (t.trang_thai === 'DA_HOAN_THANH') {
      daHoanThanhCount++;
    } else if (t.trang_thai === 'DANG_THUC_HIEN') {
      dangThucHienCount++;
    } else {
      chuaTrienKhaiCount++;
    }
  });

  const calcPercent = (count: number, total: number) =>
    total > 0 ? Math.round((count / total) * 100) : 0;

  const slices: StatusSlice[] = [
    {
      key: 'DA_HOAN_THANH',
      label: 'Đã hoàn thành',
      count: daHoanThanhCount,
      percent: calcPercent(daHoanThanhCount, tongNhiemVu),
      color: '#10b981',
    },
    {
      key: 'DANG_THUC_HIEN',
      label: 'Đang thực hiện',
      count: dangThucHienCount,
      percent: calcPercent(dangThucHienCount, tongNhiemVu),
      color: '#2563eb',
    },
    {
      key: 'CHUA_THUC_HIEN',
      label: 'Chưa triển khai',
      count: chuaTrienKhaiCount,
      percent: calcPercent(chuaTrienKhaiCount, tongNhiemVu),
      color: '#f59e0b',
    },
    {
      key: 'QUA_HAN',
      label: 'Quá hạn',
      count: quaHanCount,
      percent: calcPercent(quaHanCount, tongNhiemVu),
      color: '#ef4444',
    },
  ];

  // 10. Độ bao phủ kiểm tra, giám sát
  // Tổ chức được coi là đã bao phủ nếu có ít nhất 1 cuộc kiểm tra hoặc giám sát trong kỳ
  const coveredUnitIds = new Set(
    filteredTasks
      .filter((t) => t.don_vi_id && (t.trang_thai === 'DA_HOAN_THANH' || t.trang_thai === 'DANG_THUC_HIEN'))
      .map((t) => t.don_vi_id as string),
  );
  const daThucHienCoQuan = filteredUnits.filter((u) => coveredUnitIds.has(u.id)).length;
  const chuaThucHienCoQuan = Math.max(0, tongCoQuan - daThucHienCoQuan);
  const percentBaoPhu = tongCoQuan > 0 ? Math.round((daThucHienCoQuan / tongCoQuan) * 100) : 0;

  // 11. Khắc phục kiến nghị & Thay đổi bổ sung
  // Thu thập các kiến nghị/điều chỉnh thực tế từ danh_sach_thay_doi_bo_sung
  let totalKienNghi = 0;
  let kienNghiHoanThanh = 0;
  let kienNghiQuaHan = 0;

  filteredTasks.forEach((t) => {
    if (t.danh_sach_thay_doi_bo_sung && Array.isArray(t.danh_sach_thay_doi_bo_sung)) {
      t.danh_sach_thay_doi_bo_sung.forEach((td) => {
        totalKienNghi++;
        // Nếu có ghi chú hoặc hoàn thành
        if (td.so_van_ban && td.ngay_ban_hanh) {
          kienNghiHoanThanh++;
        }
      });
    }
  });

  // Nếu chưa có bảng kiến nghị riêng, tính tỷ lệ hoàn thành các cuộc KT-GS đã phát hành kết luận
  const hasKienNghiData = totalKienNghi > 0;
  const kienNghiPercent = hasKienNghiData
    ? Math.round((kienNghiHoanThanh / totalKienNghi) * 100)
    : tongNhiemVu > 0
    ? Math.round((daHoanThanhCount / tongNhiemVu) * 100)
    : 0;

  // 12. Điểm cần quan tâm
  // Đơn thư đang xử lý hoặc mới tiếp nhận
  const activeDonThuCount = (donThuList || []).filter((d) => {
    return (
      d.trang_thai === 'Đang xử lý' ||
      d.trang_thai === 'Mới tiếp nhận' ||
      d.trang_thai === 'Quá hạn' ||
      !d.ngay_hoan_thanh
    );
  }).length;

  // Đơn vị chưa có dữ liệu báo cáo / chưa lập kế hoạch
  const unitsWithoutTasks = filteredUnits.filter((u) => !coveredUnitIds.has(u.id));

  // 13. Bảng tiến độ theo từng đơn vị cơ sở
  const tienDoTheoDonVi: UnitProgressRow[] = filteredUnits.map((u) => {
    const unitTasks = filteredTasks.filter((t) => t.don_vi_id === u.id);
    const kt = unitTasks.filter((t) => t.loai_hinh === 'KIEM_TRA').length;
    const gs = unitTasks.filter((t) => t.loai_hinh === 'GIAM_SAT').length;
    const done = unitTasks.filter((t) => t.trang_thai === 'DA_HOAN_THANH').length;
    const inProgress = unitTasks.filter((t) => t.trang_thai === 'DANG_THUC_HIEN' && !isTaskOverdue(t)).length;
    const notStarted = unitTasks.filter((t) => t.trang_thai === 'CHUA_THUC_HIEN' && !isTaskOverdue(t)).length;
    const overdue = unitTasks.filter((t) => isTaskOverdue(t)).length;
    const total = unitTasks.length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;

    return {
      donViId: u.id,
      ten: u.ten,
      loai: typeLabels[u.loai] || u.loai,
      ma: u.ma,
      soKiemTra: kt,
      soGiamSat: gs,
      daHoanThanh: done,
      dangThucHien: inProgress,
      chuaThucHien: notStarted,
      quaHan: overdue,
      tongNhiemVu: total,
      tyLeHoanThanh: rate,
    };
  });

  return {
    unitName,
    availableYears,
    availableScopes,
    availableUnits: accessibleUnits.map((u) => ({ id: u.id, ten: u.ten, loai: u.loai })),
    availableLinhVuc,
    tongCoQuan,
    soCuocKiemTra,
    soCuocGiamSat,
    tongNhiemVu,
    tinhHinhNhiemVu: {
      total: tongNhiemVu,
      slices,
      daHoanThanh: { count: daHoanThanhCount, percent: calcPercent(daHoanThanhCount, tongNhiemVu) },
      dangThucHien: { count: dangThucHienCount, percent: calcPercent(dangThucHienCount, tongNhiemVu) },
      chuaTrienKhai: { count: chuaTrienKhaiCount, percent: calcPercent(chuaTrienKhaiCount, tongNhiemVu) },
      quaHan: { count: quaHanCount, percent: calcPercent(quaHanCount, tongNhiemVu) },
    },
    doBaoPhu: {
      percent: percentBaoPhu,
      daThucHien: daThucHienCoQuan,
      chuaThucHien: chuaThucHienCoQuan,
      tongCoQuan,
    },
    khacPhucKienNghi: {
      percent: kienNghiPercent,
      daHoanThanh: hasKienNghiData ? kienNghiHoanThanh : daHoanThanhCount,
      conPhaiThucHien: hasKienNghiData ? Math.max(0, totalKienNghi - kienNghiHoanThanh) : Math.max(0, tongNhiemVu - daHoanThanhCount),
      daQuaHan: hasKienNghiData ? kienNghiQuaHan : quaHanCount,
      tongKienNghi: hasKienNghiData ? totalKienNghi : tongNhiemVu,
      hasData: hasKienNghiData || tongNhiemVu > 0,
    },
    diemQuanTam: {
      nhiemVuQuaHan: {
        count: quaHanCount,
        note: quaHanCount > 0 ? `${quaHanCount} nhiệm vụ cần xử lý ngay` : 'Không có nhiệm vụ quá hạn',
        items: overdueTasks,
      },
      kienNghiChuaKhacPhuc: {
        count: hasKienNghiData ? Math.max(0, totalKienNghi - kienNghiHoanThanh) : chuaTrienKhaiCount,
        note: 'Đang theo dõi đôn đốc thực hiện',
      },
      donThuDangGiaiQuyet: {
        count: activeDonThuCount,
        note: activeDonThuCount > 0 ? `${activeDonThuCount} đơn đang thụ lý giải quyết` : 'Không có đơn thư tồn đọng',
      },
      duLieuBaoCaoConThieu: {
        count: unitsWithoutTasks.length,
        note: unitsWithoutTasks.length > 0 ? `${unitsWithoutTasks.length} đơn vị chưa có kế hoạch KT-GS` : 'Đã phủ kín toàn bộ đơn vị',
        units: unitsWithoutTasks,
      },
    },
    tienDoTheoDonVi,
  };
}
