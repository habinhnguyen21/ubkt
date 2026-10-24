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
 * Tạo mã tổ chức tự động tuần tự, khoa học, không ngẫu nhiên (tránh trùng lặp)
 * - Cấp cao nhất / Đảng bộ: DU-01, DU-02, ...
 * - Chi bộ trực thuộc: CB-01, CB-02, ..., CB-17, ...
 * - Ban chấp hành: BCH-01, ...
 * - Ban thường vụ: BTV-01, ...
 * - Cơ quan UBKT: UBKT-01, ...
 * - Khác: TC-01, TC-02, ...
 */
export function generateSequentialOrgCode(
  loai: string = 'CHI_BO',
  existingUnits: DonVi[] = [],
  isRoot: boolean = false,
): string {
  let prefix = 'CB';
  const upperLoai = (loai || '').toUpperCase();
  if (isRoot || upperLoai === 'DANG_BO') {
    prefix = 'DU';
  } else if (upperLoai === 'BCH') {
    prefix = 'BCH';
  } else if (upperLoai === 'BTV') {
    prefix = 'BTV';
  } else if (upperLoai === 'UBKT') {
    prefix = 'UBKT';
  } else if (upperLoai === 'CHI_BO') {
    prefix = 'CB';
  } else {
    prefix = 'TC';
  }

  const activeCodes = (existingUnits || [])
    .filter((u) => !u.deleted_at && u.ma)
    .map((u) => u.ma!.trim().toUpperCase());

  // Tìm số thứ tự lớn nhất hiện có cho tiền tố này
  let maxNum = 0;
  const regex = new RegExp(`^${prefix}[-_\\s]?(\\d+)$`, 'i');
  activeCodes.forEach((code) => {
    const m = code.match(regex);
    if (m) {
      const num = parseInt(m[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  const existingSet = new Set(activeCodes);
  let nextNum = maxNum + 1;
  while (true) {
    const candidate = `${prefix}-${String(nextNum).padStart(2, '0')}`;
    if (!existingSet.has(candidate)) {
      return candidate;
    }
    nextNum++;
  }
}

/**
 * Đề xuất mã tổ chức tự động tuần tự
 */
export function suggestUnitCode(_ten: string, loai: string, existingUnits: DonVi[]): string {
  return generateSequentialOrgCode(loai, existingUnits);
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
/**
 * Chuẩn hóa chuỗi để so sánh linh hoạt (bỏ khoảng trắng thừa, chuyển thường, chuẩn hóa dấu gạch ngang)
 */
export function normalizeOrgSearchText(text?: string | null): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[–—]/g, '-');
}

/**
 * Kiểm tra xem giá trị cột cấp trên có mang ý nghĩa "Không có cấp trên / Cấp cao nhất / Gốc"
 */
export function isRootParentIndicator(val?: string | null): boolean {
  if (!val) return true;
  const clean = normalizeOrgSearchText(val);
  const rootIndicators = [
    '', '-', '--', '---', '0', 'none', 'null', 'n/a', 'na',
    'goc', 'gốc', '-- gốc --', '--gốc--',
    'khong', 'không', 'khong co', 'không có', 'khong co cap tren', 'không có cấp trên',
    'root', 'tổ chức gốc', 'to chuc goc', 'cấp cao nhất', 'cap cao nhat', 'trực tiếp', 'truc tiep',
    'gốc (không có cấp trên)', 'khác', 'khac'
  ];
  return rootIndicators.includes(clean);
}

/**
 * Tìm kiếm tổ chức cấp trên một cách thông minh, hỗ trợ:
 * - Mã tổ chức (DU-01, du-01)
 * - Tên tổ chức (Đảng bộ phường Ái Quốc, Đảng ủy phường Ái Quốc)
 * - ID tổ chức
 * - Định dạng sao chép từ giao diện: "DU-01 (Đảng bộ...)" hoặc "DU-01 - Đảng bộ..."
 * - Hoán đổi linh hoạt giữa "đảng ủy" và "đảng bộ"
 * - Nhận diện cấp gốc duy nhất trên hệ thống nếu người dùng nhập "Đảng ủy" / "Đảng bộ"
 * - Nhận diện các tổ chức được khai báo trong cùng tệp tải lên
 */
export function resolveParentUnit(
  parentInput: string,
  existingUnits: DonVi[],
  fileKnownUnits?: Array<{ ma?: string; ten?: string }>,
): {
  isRoot: boolean;
  matchedUnit?: DonVi;
  matchedFromCurrentFile?: boolean;
  error?: string;
} {
  if (isRootParentIndicator(parentInput)) {
    return { isRoot: true };
  }

  const raw = parentInput.trim();
  const lower = normalizeOrgSearchText(raw);
  const activeUnits = (existingUnits || []).filter((u) => !u.deleted_at);

  // 1. Tìm trực tiếp theo ID
  const matchById = activeUnits.find((u) => u.id === raw);
  if (matchById) return { isRoot: false, matchedUnit: matchById };

  // 2. Tìm trực tiếp theo Mã
  const matchByCode = activeUnits.find((u) => u.ma && normalizeOrgSearchText(u.ma) === lower);
  if (matchByCode) return { isRoot: false, matchedUnit: matchByCode };

  // 3. Tìm trực tiếp theo Tên
  const matchByName = activeUnits.find((u) => u.ten && normalizeOrgSearchText(u.ten) === lower);
  if (matchByName) return { isRoot: false, matchedUnit: matchByName };

  // 4. Nếu người dùng copy từ UI hoặc file: "DU-01 (Tên tổ chức)" hoặc "DU-01 - Tên tổ chức" hoặc "DU-01: Tên"
  const bracketMatch = raw.match(/^([a-zA-Z0-9_\-\.]+)\s*[\(\-–—:]\s*(.*?)\)?$/);
  if (bracketMatch) {
    const extractedCode = normalizeOrgSearchText(bracketMatch[1]);
    const extractedName = normalizeOrgSearchText(bracketMatch[2]);

    const unitByExtractedCode = activeUnits.find(
      (u) => u.ma && normalizeOrgSearchText(u.ma) === extractedCode,
    );
    if (unitByExtractedCode) return { isRoot: false, matchedUnit: unitByExtractedCode };

    if (extractedName) {
      const unitByExtractedName = activeUnits.find(
        (u) => u.ten && normalizeOrgSearchText(u.ten) === extractedName,
      );
      if (unitByExtractedName) return { isRoot: false, matchedUnit: unitByExtractedName };
    }
  }

  // 5. Kiểm tra tiền tố mã tổ chức trong chuỗi: ví dụ "DU-01" xuất hiện ở đầu chuỗi
  const codePrefixMatch = activeUnits.find((u) => {
    if (!u.ma) return false;
    const cleanMa = normalizeOrgSearchText(u.ma);
    return (
      lower === cleanMa ||
      lower.startsWith(cleanMa + ' ') ||
      lower.startsWith(cleanMa + '(') ||
      lower.startsWith(cleanMa + '-')
    );
  });
  if (codePrefixMatch) return { isRoot: false, matchedUnit: codePrefixMatch };

  // 6. Hoán đổi linh hoạt giữa "đảng ủy" và "đảng bộ"
  const swapped = lower.includes('đảng ủy')
    ? lower.replace(/đảng ủy/g, 'đảng bộ')
    : lower.includes('đảng bộ')
    ? lower.replace(/đảng bộ/g, 'đảng ủy')
    : null;

  if (swapped) {
    const unitBySwappedName = activeUnits.find(
      (u) => u.ten && normalizeOrgSearchText(u.ten) === swapped,
    );
    if (unitBySwappedName) return { isRoot: false, matchedUnit: unitBySwappedName };
  }

  // 7. Nếu hệ thống chỉ có 1 tổ chức cấp cao nhất (gốc, don_vi_cha_id == null)
  // và người dùng gõ từ khóa chung như "đảng ủy", "đảng bộ", "đảng ủy cơ sở", "đảng bộ cơ sở"
  const rootUnits = activeUnits.filter((u) => !u.don_vi_cha_id);
  if (rootUnits.length === 1) {
    const root = rootUnits[0];
    const genericRootTerms = [
      'đảng ủy',
      'đảng bộ',
      'đảng ủy cơ sở',
      'đảng bộ cơ sở',
      'đảng ủy phường',
      'đảng bộ phường',
      'cấp trên',
      'đảng ủy cấp trên',
    ];
    if (
      genericRootTerms.some((term) => lower === term || lower.includes(term)) ||
      (root.ten &&
        (lower.includes(normalizeOrgSearchText(root.ten)) ||
          normalizeOrgSearchText(root.ten).includes(lower)))
    ) {
      return { isRoot: false, matchedUnit: root };
    }
  }

  // 8. Kiểm tra trong danh sách các tổ chức cùng tệp tải lên (fileKnownUnits)
  if (fileKnownUnits && fileKnownUnits.length > 0) {
    const matchInFile = fileKnownUnits.find(
      (f) =>
        (f.ma && normalizeOrgSearchText(f.ma) === lower) ||
        (f.ten && normalizeOrgSearchText(f.ten) === lower),
    );
    if (matchInFile) {
      return { isRoot: false, matchedFromCurrentFile: true };
    }
  }

  return {
    isRoot: false,
    error: `Mã hoặc tên cấp trên "${raw}" không tồn tại trên hệ thống (Hệ thống chấp nhận Mã, Tên hoặc để trống nếu là cấp gốc)`,
  };
}

/**
 * Tải file Excel mẫu để nhập danh sách tổ chức
 */
export function downloadUnitImportTemplate(existingUnits?: DonVi[]) {
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

  // Tìm tổ chức gốc hiện có để làm mẫu cấp trên chính xác
  const activeUnits = (existingUnits || []).filter((u) => !u.deleted_at);
  const rootUnit = activeUnits.find((u) => !u.don_vi_cha_id) || activeUnits[0];
  const rootCode = rootUnit?.ma || 'DU-01';
  const rootName = rootUnit?.ten || 'Đảng bộ cơ sở';

  const sampleRows = [
    [
      'DU-02',
      'Đảng bộ Khối Doanh nghiệp',
      'DANG_BO',
      '',
      '2020-01-15',
      '01-QĐ/TU',
      'DANG_HOAT_DONG',
      'Tổ chức cấp cao nhất (ĐỂ TRỐNG cột Mã cấp trên)',
    ],
    [
      'CB-MAU-01',
      'Chi bộ Quân sự',
      'CHI_BO',
      rootCode,
      '2021-03-10',
      '05-QĐ/ĐU',
      'DANG_HOAT_DONG',
      `Chi bộ trực thuộc ${rootName}`,
    ],
    [
      'CB-MAU-02',
      'Chi bộ Công an',
      'CHI_BO',
      rootCode,
      '2021-03-10',
      '06-QĐ/ĐU',
      'DANG_HOAT_DONG',
      `Chi bộ trực thuộc ${rootName}`,
    ],
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

  // Tự động nhận diện dấu phân cách: phẩy (,), chấm phẩy (;), hoặc tab (\t)
  const firstLine = lines[0] || '';
  let delimiter = ',';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  if (semiCount > commaCount && semiCount > tabCount) {
    delimiter = ';';
  } else if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = '\t';
  }

  // Helper parse csv line
  const parseLine = (line: string, delim: string): string[] => {
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
      } else if (c === delim && !inQuotes) {
        result.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim().replace(/^"|"$/g, ''));
    return result;
  };

  // PASS 1: Quét trước toàn bộ file để thu thập tất cả mã và tên tổ chức có trong file
  const fileKnownUnits: Array<{ ma?: string; ten?: string; lineNum: number }> = [];
  const parsedRows: Array<{ cols: string[]; lineNum: number }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i], delimiter);
    const lineNum = i + 1;
    parsedRows.push({ cols, lineNum });

    const ma = cols[0] ? cols[0].trim() : '';
    const ten = cols[1] ? cols[1].trim() : '';
    if (ma || ten) {
      fileKnownUnits.push({ ma, ten, lineNum });
    }
  }

  const existingCodes = new Set(
    existingUnits
      .filter((u) => !u.deleted_at && u.ma)
      .map((u) => normalizeOrgSearchText(u.ma)),
  );
  const fileSeenCodes = new Set<string>();

  const validItems: any[] = [];
  const errors: Array<{ line: number; message: string }> = [];

  // PASS 2: Kiểm tra tính hợp lệ chi tiết
  for (const { cols, lineNum } of parsedRows) {
    const ma = cols[0] ? cols[0].trim() : '';
    const ten = cols[1] ? cols[1].trim() : '';
    const loai = cols[2] ? cols[2].trim() : 'CHI_BO';
    const maCapTren = cols[3] ? cols[3].trim() : '';
    const ngayThanhLap = cols[4] ? cols[4].trim() : '';
    const soQuyetDinh = cols[5] ? cols[5].trim() : '';
    const trangThaiRaw = cols[6] ? cols[6].trim() : 'DANG_HOAT_DONG';
    const ghiChu = cols[7] ? cols[7].trim() : '';

    if (!ten) {
      errors.push({ line: lineNum, message: 'Tên tổ chức không được để trống' });
      continue;
    }

    if (ma) {
      const lowerMa = normalizeOrgSearchText(ma);
      if (existingCodes.has(lowerMa)) {
        errors.push({ line: lineNum, message: `Mã tổ chức "${ma}" đã tồn tại trong CSDL` });
        continue;
      }
      if (fileSeenCodes.has(lowerMa)) {
        errors.push({
          line: lineNum,
          message: `Mã tổ chức "${ma}" bị trùng lặp trong chính tệp tải lên`,
        });
        continue;
      }
      fileSeenCodes.add(lowerMa);
    }

    // Phân giải cấp trên thông minh
    let parentId: string | undefined = undefined;
    if (maCapTren && !isRootParentIndicator(maCapTren)) {
      const resolveResult = resolveParentUnit(maCapTren, existingUnits, fileKnownUnits);
      if (resolveResult.error) {
        errors.push({ line: lineNum, message: resolveResult.error });
        continue;
      }
      if (resolveResult.matchedUnit) {
        parentId = resolveResult.matchedUnit.id;
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
      ma_cap_tren: isRootParentIndicator(maCapTren) ? undefined : maCapTren,
      don_vi_cha_id: parentId,
      ngay_thanh_lap: ngayThanhLap || undefined,
      so_quyet_dinh: soQuyetDinh || undefined,
      trang_thai: trangThai,
      ghi_chu: ghiChu || undefined,
    });
  }

  return { validItems, errors };
}
