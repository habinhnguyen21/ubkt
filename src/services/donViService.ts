import type { DonVi, DonViTreeItem, LoaiHinhToChuc, TrangThaiDonVi } from '../types';

export const DEFAULT_LOAI_HINH_LIST: LoaiHinhToChuc[] = [
  { ma: 'DANG_BO', ten: 'Đảng bộ cơ sở', mo_ta: 'Đảng bộ cơ sở trực thuộc Đảng ủy cấp trên', is_active: true, thu_tu: 1 },
  { ma: 'CHI_BO', ten: 'Chi bộ trực thuộc', mo_ta: 'Chi bộ trực thuộc Đảng ủy hoặc Đảng bộ bộ phận', is_active: true, thu_tu: 2 },
  { ma: 'BCH', ten: 'Ban Chấp hành Đảng bộ', mo_ta: 'Ban Chấp hành Đảng bộ cơ sở', is_active: true, thu_tu: 3 },
  { ma: 'BTV', ten: 'Ban Thường vụ Đảng ủy', mo_ta: 'Ban Thường vụ Đảng ủy', is_active: true, thu_tu: 4 },
  { ma: 'UBKT', ten: 'Ủy ban Kiểm tra', mo_ta: 'Ủy ban Kiểm tra Đảng ủy', is_active: true, thu_tu: 5 },
];

/**
 * Xây dựng cây tổ chức đa cấp và gán cấp độ (Level 1, 2, 3...)
 */
export function buildHierarchyTree(
  units: DonVi[],
  parentId: string | null = null,
  currentLevel = 1,
): DonViTreeItem[] {
  return units
    .filter((u) => u.don_vi_cha_id === parentId && !u.deleted_at)
    .sort((a, b) => (a.thu_tu ?? 0) - (b.thu_tu ?? 0))
    .map((u) => {
      const children = buildHierarchyTree(units, u.id, currentLevel + 1);
      return {
        id: u.id,
        ten: u.ten,
        loai: u.loai,
        don_vi_cha_id: u.don_vi_cha_id,
        ma: u.ma || null,
        thu_tu: u.thu_tu ?? 0,
        ghi_chu: u.ghi_chu || null,
        trang_thai: u.trang_thai || 'DANG_HOAT_DONG',
        ngay_thanh_lap: u.ngay_thanh_lap || null,
        ngay_ket_thuc: u.ngay_ket_thuc || null,
        so_quyet_dinh: u.so_quyet_dinh || null,
        cap_do: currentLevel,
        so_luong_truc_thuoc: children.length,
        children,
      };
    });
}

/**
 * Kiểm tra xem targetId có phải là hậu duệ (con, cháu...) của parentId không
 * để ngăn chặn tạo vòng lặp trong cây tổ chức.
 */
export function isDescendantUnit(units: DonVi[], parentId: string, targetId: string): boolean {
  if (!parentId || !targetId) return false;
  if (parentId === targetId) return true;
  const directChildren = units.filter((u) => u.don_vi_cha_id === parentId && !u.deleted_at);
  for (const child of directChildren) {
    if (child.id === targetId || isDescendantUnit(units, child.id, targetId)) {
      return true;
    }
  }
  return false;
}

/**
 * Tính cấp độ (Level 1, Level 2...) của một tổ chức trong cây
 */
export function calculateUnitLevel(units: DonVi[], unitId: string): number {
  let level = 1;
  let curr = units.find((u) => u.id === unitId);
  const visited = new Set<string>();

  while (curr && curr.don_vi_cha_id && !visited.has(curr.id)) {
    visited.add(curr.id);
    const parent = units.find((u) => u.id === curr!.don_vi_cha_id);
    if (parent) {
      level++;
      curr = parent;
    } else {
      break;
    }
  }
  return level;
}

/**
 * Đề xuất mã tổ chức tự động dựa trên tên và loại hình
 */
export function suggestUnitCode(_ten: string, loai: string, existingUnits: DonVi[]): string {
  const prefixMap: Record<string, string> = {
    DANG_BO: 'DB',
    CHI_BO: 'CB',
    BCH: 'BCH',
    BTV: 'BTV',
    UBKT: 'UBKT',
  };
  const prefix = prefixMap[loai] || 'TC';

  const existingCodes = new Set(
    existingUnits
      .filter((u) => !u.deleted_at && u.ma)
      .map((u) => u.ma!.toUpperCase()),
  );

  for (let i = 1; i <= 999; i++) {
    const candidate = `${prefix}-${String(i).padStart(2, '0')}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

/**
 * Xuất danh sách tổ chức ra file CSV tương thích Excel (UTF-8 BOM)
 */
export function exportUnitsToCsv(units: DonVi[], fileName = 'Danh_sach_co_cau_to_chuc.csv') {
  const unitMap = new Map(units.map((u) => [u.id, u.ten]));

  const headers = [
    'STT',
    'Tên tổ chức',
    'Cấp trên trực tiếp',
    'Trạng thái',
    'Ghi chú',
  ];

  const rows = units.map((u, idx) => {
    const parentName = u.don_vi_cha_id ? unitMap.get(u.don_vi_cha_id) || '' : 'Tổ chức cấp cao nhất (Gốc)';
    const statusLabel =
      u.trang_thai === 'TAM_NGUNG'
        ? 'Tạm ngừng hoạt động'
        : u.trang_thai === 'CHAM_DUT'
        ? 'Đã chấm dứt hoạt động'
        : 'Đang hoạt động';

    return [
      idx + 1,
      `"${(u.ten || '').replace(/"/g, '""')}"`,
      `"${parentName.replace(/"/g, '""')}"`,
      `"${statusLabel}"`,
      `"${(u.ghi_chu || '').replace(/"/g, '""')}"`,
    ].join(',');
  });

  // UTF-8 BOM
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Tải file Excel mẫu để nhập danh sách tổ chức
 */
export function downloadUnitImportTemplate() {
  const headers = [
    'Mã tổ chức (*)',
    'Tên tổ chức (*)',
    'Loại hình (*)',
    'Mã cấp trên',
    'Ngày thành lập (YYYY-MM-DD)',
    'Số quyết định',
    'Trạng thái (DANG_HOAT_DONG/TAM_NGUNG)',
    'Ghi chú',
  ];

  const sampleRows = [
    ['CB-01', 'Chi bộ Quân sự', 'CHI_BO', 'DU-01', '2020-01-15', '05-QĐ/ĐU', 'DANG_HOAT_DONG', 'Chi bộ trực thuộc Đảng ủy'],
    ['CB-02', 'Chi bộ Công an', 'CHI_BO', 'DU-01', '2020-01-15', '06-QĐ/ĐU', 'DANG_HOAT_DONG', 'Chi bộ trực thuộc Đảng ủy'],
    ['CB-03', 'Chi bộ Khu dân cư số 1', 'CHI_BO', 'DU-01', '2020-01-15', '07-QĐ/ĐU', 'DANG_HOAT_DONG', 'Chi bộ địa bàn dân cư'],
  ];

  const content =
    '\uFEFF' +
    [
      headers.join(','),
      ...sampleRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')),
    ].join('\r\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'Mau_nhap_danh_sach_to_chuc.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Phân tích và kiểm tra tính hợp lệ dữ liệu từ file CSV/Excel mẫu
 */
export function parseAndValidateUnitCsv(
  csvText: string,
  existingUnits: DonVi[],
): {
  validItems: Array<{
    ma: string;
    ten: string;
    loai: string;
    ma_cap_tren?: string;
    don_vi_cha_id?: string;
    ngay_thanh_lap?: string;
    so_quyet_dinh?: string;
    trang_thai?: TrangThaiDonVi;
    ghi_chu?: string;
  }>;
  errors: Array<{ line: number; message: string }>;
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length <= 1) {
    return { validItems: [], errors: [{ line: 1, message: 'Tệp rỗng hoặc chỉ có dòng tiêu đề' }] };
  }

  const existingCodes = new Set(
    existingUnits.filter((u) => !u.deleted_at && u.ma).map((u) => u.ma!.toLowerCase()),
  );
  const codeToIdMap = new Map<string, string>();
  const nameToIdMap = new Map<string, string>();
  existingUnits
    .filter((u) => !u.deleted_at)
    .forEach((u) => {
      if (u.ma) codeToIdMap.set(u.ma.toLowerCase(), u.id);
      if (u.ten) nameToIdMap.set(u.ten.trim().toLowerCase(), u.id);
    });

  const validItems: any[] = [];
  const errors: Array<{ line: number; message: string }> = [];
  const fileSeenCodes = new Set<string>();

  // Helper parse csv line considering quotes
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  // Bỏ qua dòng 1 (header)
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const lineNum = i + 1;

    const ma = cols[0] || '';
    const ten = cols[1] || '';
    const loai = cols[2] || 'CHI_BO';
    const maCapTren = cols[3] || '';
    const ngayThanhLap = cols[4] || '';
    const soQuyetDinh = cols[5] || '';
    const trangThaiRaw = cols[6] || 'DANG_HOAT_DONG';
    const ghiChu = cols[7] || '';

    if (!ten) {
      errors.push({ line: lineNum, message: 'Tên tổ chức không được để trống' });
      continue;
    }

    if (ma) {
      const lowerMa = ma.toLowerCase();
      if (existingCodes.has(lowerMa)) {
        errors.push({ line: lineNum, message: `Mã tổ chức "${ma}" đã tồn tại trong CSDL` });
        continue;
      }
      if (fileSeenCodes.has(lowerMa)) {
        errors.push({ line: lineNum, message: `Mã tổ chức "${ma}" bị trùng lặp trong chính tệp tải lên` });
        continue;
      }
      fileSeenCodes.add(lowerMa);
    }

    let parentId: string | undefined = undefined;
    if (maCapTren) {
      const lowerParent = maCapTren.trim().toLowerCase();
      if (codeToIdMap.has(lowerParent)) {
        parentId = codeToIdMap.get(lowerParent);
      } else if (nameToIdMap.has(lowerParent)) {
        parentId = nameToIdMap.get(lowerParent);
      } else if (!fileSeenCodes.has(lowerParent)) {
        // Cấp trên không có trong CSDL và cũng không có ở các dòng trước trong tệp
        errors.push({ line: lineNum, message: `Mã hoặc tên cấp trên "${maCapTren}" không tồn tại` });
        continue;
      }
    }

    const trangThai: TrangThaiDonVi =
      trangThaiRaw.toUpperCase() === 'TAM_NGUNG'
        ? 'TAM_NGUNG'
        : trangThaiRaw.toUpperCase() === 'CHAM_DUT'
        ? 'CHAM_DUT'
        : 'DANG_HOAT_DONG';

    validItems.push({
      ma: ma || undefined,
      ten,
      loai,
      ma_cap_tren: maCapTren || undefined,
      don_vi_cha_id: parentId,
      ngay_thanh_lap: ngayThanhLap || undefined,
      so_quyet_dinh: soQuyetDinh || undefined,
      trang_thai: trangThai,
      ghi_chu: ghiChu || undefined,
    });
  }

  return { validItems, errors };
}
