import * as XLSX from 'xlsx';
import type { ChuongTrinhKtGs, CreateChuongTrinhInput, DonVi, LoaiHinhKtGs, TrangThaiKtGs, ChuTheLoai, CapChuThe } from '../types';

export const DANH_MUC_LINH_VUC_CHUAN = [
  'Công tác xây dựng Đảng',
  'Quản lý đất đai, trật tự xây dựng',
  'Tài chính - ngân sách',
  'Phòng, chống tham nhũng, lãng phí',
  'Chính trị tư tưởng, đạo đức lối sống',
  'Công tác cán bộ',
  'Thực hiện nhiệm vụ chính trị',
  'Dân chủ ở cơ sở',
  'Lĩnh vực khác',
];

/**
 * Chuẩn hóa linh hoạt lĩnh vực kiểm tra, giám sát từ mọi biến thể (dấu phẩy, gạch ngang, en-dash, từ khóa...)
 */
export function normalizeLinhVuc(raw?: string | null): string {
  if (!raw) return 'Công tác xây dựng Đảng';
  const clean = raw.trim();
  const lower = clean.toLowerCase();

  // 1. Tài chính - ngân sách (hỗ trợ mọi định dạng: phẩy, gạch nối, en-dash, đảng phí, quỹ...)
  if (
    lower.includes('tài chính') ||
    lower.includes('ngân sách') ||
    lower.includes('đảng phí') ||
    lower.includes('kinh phí') ||
    lower.includes('quỹ')
  ) {
    return 'Tài chính - ngân sách';
  }

  // 2. Quản lý đất đai, trật tự xây dựng
  if (
    lower.includes('đất đai') ||
    lower.includes('trật tự xây dựng') ||
    lower.includes('xây dựng đô thị') ||
    lower.includes('môi trường') ||
    lower.includes('đô thị') ||
    lower.includes('giải tỏa')
  ) {
    return 'Quản lý đất đai, trật tự xây dựng';
  }

  // 3. Phòng, chống tham nhũng, lãng phí
  if (
    lower.includes('tham nhũng') ||
    lower.includes('lãng phí') ||
    lower.includes('tiêu cực') ||
    lower.includes('kê khai tài sản')
  ) {
    return 'Phòng, chống tham nhũng, lãng phí';
  }

  // 4. Chính trị tư tưởng, đạo đức lối sống
  if (
    lower.includes('chính trị tư tưởng') ||
    lower.includes('đạo đức') ||
    lower.includes('lối sống') ||
    lower.includes('nêu gương') ||
    lower.includes('tư tưởng')
  ) {
    return 'Chính trị tư tưởng, đạo đức lối sống';
  }

  // 5. Công tác cán bộ
  if (lower.includes('cán bộ') || lower.includes('quy hoạch') || lower.includes('bổ nhiệm')) {
    return 'Công tác cán bộ';
  }

  // 6. Dân chủ ở cơ sở
  if (lower.includes('dân chủ') || lower.includes('quy chế dân chủ')) {
    return 'Dân chủ ở cơ sở';
  }

  // 7. Thực hiện nhiệm vụ chính trị
  if (lower.includes('nhiệm vụ chính trị') || lower.includes('phát triển kinh tế')) {
    return 'Thực hiện nhiệm vụ chính trị';
  }

  // 8. Công tác xây dựng Đảng
  if (
    lower.includes('xây dựng đảng') ||
    lower.includes('phát triển đảng') ||
    lower.includes('đảng viên') ||
    lower.includes('sinh hoạt chi bộ')
  ) {
    return 'Công tác xây dựng Đảng';
  }

  // So sánh chuẩn hóa không phân biệt dấu gạch nối, en-dash, phẩy
  const normalizedUser = lower.replace(/[-–—,._/]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const std of DANH_MUC_LINH_VUC_CHUAN) {
    const normalizedStd = std.toLowerCase().replace(/[-–—,._/]/g, ' ').replace(/\s+/g, ' ').trim();
    if (normalizedStd === normalizedUser || normalizedStd.includes(normalizedUser) || normalizedUser.includes(normalizedStd)) {
      return std;
    }
  }

  return clean;
}

export interface ImportRowData {
  rowNumber: number;
  nam: number;
  so_van_ban: string;
  co_quan_ban_hanh: string;
  loai_hinh: LoaiHinhKtGs;
  linh_vuc: string;
  doi_tuong: string;
  noi_dung: string;
  ngay_bat_dau?: string;
  ngay_ket_thuc?: string;
  trang_thai: TrangThaiKtGs;
  ghi_chu?: string;
  isValid: boolean;
  errors: string[];
  isDuplicate?: boolean;
  duplicateId?: string;
  duplicateReason?: string;
  rawPayload: CreateChuongTrinhInput;
}

export interface ParseResult {
  totalRows: number;
  validRows: ImportRowData[];
  invalidRows: ImportRowData[];
  duplicateCount: number;
  rows: ImportRowData[];
}

/**
 * MẪU TIÊU ĐỀ CỘT CHUẨN ĐẦY ĐỦ VÀ DỄ DÙNG
 * Có: Lĩnh vực kiểm tra, giám sát | Từ ngày | Đến ngày
 */
export const EXCEL_HEADERS = [
  'STT',
  'Năm',
  'Số văn bản',
  'Cơ quan ban hành',
  'Loại hình',
  'Lĩnh vực kiểm tra, giám sát',
  'Đối tượng',
  'Nội dung kiểm tra, giám sát (*)',
  'Từ ngày',
  'Đến ngày',
  'Trạng thái',
  'Ghi chú',
];

export const EXCEL_SAMPLE_DATA: Array<Array<string | number>> = [
  [
    1,
    2026,
    '05-KH/ĐU',
    'Ban Thường vụ Đảng ủy phường',
    'Kiểm tra',
    'Công tác xây dựng Đảng',
    'Chi bộ Quân sự',
    'Kiểm tra công tác phát triển đảng viên mới và thực hiện nhiệm vụ quốc phòng địa phương năm 2026',
    '01/03/2026',
    '25/03/2026',
    'Đang thực hiện',
    'Kế hoạch quý I',
  ],
  [
    2,
    2026,
    '08-KH/UBKT',
    'Ủy ban Kiểm tra Đảng ủy phường',
    'Giám sát',
    'Quản lý đất đai, trật tự xây dựng',
    'Chi bộ 1',
    'Giám sát chuyên đề công tác lãnh đạo quản lý trật tự đô thị và vệ sinh môi trường trên địa bàn',
    '10/04/2026',
    '30/04/2026',
    'Chưa thực hiện',
    'Giám sát quý II',
  ],
  [
    3,
    2026,
    '12-KH/ĐU',
    'Đảng ủy phường',
    'Kiểm tra',
    'Tài chính - ngân sách',
    'Chi bộ Công an',
    'Kiểm tra công tác thu nộp, quản lý và sử dụng đảng phí theo quy định của Đảng',
    '01/06/2026',
    '20/06/2026',
    'Chưa thực hiện',
    'Kiểm tra định kỳ 6 tháng',
  ],
  [
    4,
    2026,
    '15-KH/UBKT',
    'Ủy ban Kiểm tra Đảng ủy phường',
    'Giám sát',
    'Chính trị tư tưởng, đạo đức lối sống',
    'Đồng chí Bí thư Chi bộ 2',
    'Giám sát việc tu dưỡng rèn luyện phẩm chất đạo đức lối sống và trách nhiệm nêu gương của người đứng đầu',
    '05/09/2026',
    '25/09/2026',
    'Chưa thực hiện',
    'Giám sát chuyên đề quý III',
  ],
];

/**
 * Tải file Excel mẫu (.xlsx hoặc .csv)
 */
export function downloadChuongTrinhImportTemplate(format: 'xlsx' | 'csv' = 'xlsx') {
  if (format === 'csv') {
    const csvLines = [
      EXCEL_HEADERS.join(','),
      ...EXCEL_SAMPLE_DATA.map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? '');
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(','),
      ),
    ];
    const content = '\uFEFF' + csvLines.join('\r\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Mau_nhap_chuong_trinh_kiem_tra_giam_sat_nam.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  // Xuất file XLSX chuẩn
  const wsData = [EXCEL_HEADERS, ...EXCEL_SAMPLE_DATA];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 6 },  // STT
    { wch: 8 },  // Năm
    { wch: 15 }, // Số văn bản
    { wch: 28 }, // Cơ quan ban hành
    { wch: 14 }, // Loại hình
    { wch: 32 }, // Lĩnh vực kiểm tra, giám sát
    { wch: 26 }, // Đối tượng
    { wch: 60 }, // Nội dung
    { wch: 15 }, // Từ ngày
    { wch: 15 }, // Đến ngày
    { wch: 18 }, // Trạng thái
    { wch: 22 }, // Ghi chú
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_KTGS_Nam');
  XLSX.writeFile(wb, 'Mau_nhap_chuong_trinh_kiem_tra_giam_sat_nam.xlsx');
}

/**
 * Helper chuyển trạng thái hiển thị thành mã enum
 */
export function normalizeTrangThai(val: string): TrangThaiKtGs {
  const v = (val || '').trim().toLowerCase();
  if (v.includes('hoàn thành') || v === 'da_hoan_thanh' || v === 'xong') return 'DA_HOAN_THANH';
  if (v.includes('đang') || v.includes('dang') || v === 'dang_thuc_hien') return 'DANG_THUC_HIEN';
  if (v.includes('quá hạn') || v.includes('qua han') || v.includes('trễ') || v === 'qua_han') return 'QUA_HAN';
  return 'CHUA_THUC_HIEN';
}

/**
 * Helper chuyển trạng thái enum thành nhãn tiếng Việt
 */
export function getTrangThaiLabel(s: TrangThaiKtGs): string {
  switch (s) {
    case 'DA_HOAN_THANH':
      return 'Đã hoàn thành';
    case 'DANG_THUC_HIEN':
      return 'Đang thực hiện';
    case 'CHUA_THUC_HIEN':
      return 'Chưa thực hiện';
    case 'QUA_HAN':
      return 'Quá hạn';
    default:
      return 'Chưa thực hiện';
  }
}

/**
 * Helper chuyển loại hình thành mã enum
 */
export function normalizeLoaiHinh(val: string): LoaiHinhKtGs {
  const v = (val || '').trim().toLowerCase();
  if (v.includes('giám sát') || v.includes('giam sat') || v === 'gs') return 'GIAM_SAT';
  return 'KIEM_TRA';
}

/**
 * Chuyển ngày từ số serial của Excel sang YYYY-MM-DD
 */
function parseExcelSerialDate(val: number): string | null {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const targetDate = new Date(excelEpoch.getTime() + val * 86400000);
  if (!isNaN(targetDate.getTime())) {
    const y = targetDate.getUTCFullYear();
    const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

/**
 * Chuyển đổi định dạng ngày YYYY-MM-DD sang DD/MM/YYYY để hiển thị trong Excel
 */
export function formatDateVn(dateStr?: string | null): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return trimmed;
}

/**
 * Parse một ô ngày đơn lẻ cực kỳ linh hoạt
 * Hỗ trợ DD/MM/YYYY, YYYY-MM-DD, Excel serial date, Tháng X
 */
export function parseSingleDate(val: any, defaultYear: number): string | null {
  if (val === null || val === undefined || String(val).trim() === '') return null;
  if (typeof val === 'number') {
    return parseExcelSerialDate(val);
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Nếu người dùng nhập "Tháng X"
  const mMatch = str.toLowerCase().match(/(?:tháng|t)\s*([0-1]?[0-9])/);
  if (mMatch) {
    const mNum = parseInt(mMatch[1], 10);
    if (mNum >= 1 && mNum <= 12) {
      return `${defaultYear}-${String(mNum).padStart(2, '0')}-01`;
    }
  }

  return str;
}

/**
 * Phân tích khoảng thời gian Từ ngày - Đến ngày
 * Hỗ trợ cả 2 cột riêng biệt hoặc 1 cột tổng hợp:
 * - Cột riêng: "Từ ngày" và "Đến ngày"
 * - Cột gộp: "Từ 01/03/2026 đến 25/03/2026", "01/03/2026 - 25/03/2026", "Tháng 3", "Quý I", v.v.
 */
export function parseDateRange(
  rawTuNgay: any,
  rawDenNgay: any,
  rawThoiGianGop: any,
  nam: number,
): { ngayBatDau: string | null; ngayKetThuc: string | null; ghiChuTime: string } {
  // Ưu tiên 1: Có cả 2 cột Từ ngày và Đến ngày
  let batDau = parseSingleDate(rawTuNgay, nam);
  let ketThuc = parseSingleDate(rawDenNgay, nam);

  if (batDau && ketThuc) {
    return {
      ngayBatDau: batDau,
      ngayKetThuc: ketThuc,
      ghiChuTime: `${formatDateVn(batDau)} - ${formatDateVn(ketThuc)}`,
    };
  }
  if (batDau && !ketThuc) {
    return {
      ngayBatDau: batDau,
      ngayKetThuc: batDau,
      ghiChuTime: formatDateVn(batDau),
    };
  }
  if (!batDau && ketThuc) {
    return {
      ngayBatDau: `${nam}-01-01`,
      ngayKetThuc: ketThuc,
      ghiChuTime: `Đến ${formatDateVn(ketThuc)}`,
    };
  }

  // Ưu tiên 2: Cột gộp "Thời gian" hoặc "Từ ngày đến ngày"
  const textSource = String(rawThoiGianGop || rawTuNgay || rawDenNgay || '').trim();
  if (textSource) {
    const lower = textSource.toLowerCase();

    // Dạng "Từ DD/MM/YYYY đến DD/MM/YYYY" hoặc "DD/MM/YYYY - DD/MM/YYYY"
    const rangeMatch = textSource.match(
      /(\d{1,2}[-/]\d{1,2}[-/]\d{4})\s*(?:đến|-|–|to)\s*(\d{1,2}[-/]\d{1,2}[-/]\d{4})/i,
    );
    if (rangeMatch) {
      const bD = parseSingleDate(rangeMatch[1], nam);
      const kT = parseSingleDate(rangeMatch[2], nam);
      if (bD && kT) {
        return {
          ngayBatDau: bD,
          ngayKetThuc: kT,
          ghiChuTime: `${formatDateVn(bD)} - ${formatDateVn(kT)}`,
        };
      }
    }

    // Nhận diện Quý
    if (lower.includes('quý 1') || lower.includes('quý i') || lower === 'q1' || lower.includes('quy 1') || lower.includes('quy i')) {
      return { ngayBatDau: `${nam}-01-01`, ngayKetThuc: `${nam}-03-31`, ghiChuTime: 'Quý I' };
    }
    if (lower.includes('quý 2') || lower.includes('quý ii') || lower === 'q2' || lower.includes('quy 2') || lower.includes('quy ii')) {
      return { ngayBatDau: `${nam}-04-01`, ngayKetThuc: `${nam}-06-30`, ghiChuTime: 'Quý II' };
    }
    if (lower.includes('quý 3') || lower.includes('quý iii') || lower === 'q3' || lower.includes('quy 3') || lower.includes('quy iii')) {
      return { ngayBatDau: `${nam}-07-01`, ngayKetThuc: `${nam}-09-30`, ghiChuTime: 'Quý III' };
    }
    if (lower.includes('quý 4') || lower.includes('quý iv') || lower === 'q4' || lower.includes('quy 4') || lower.includes('quy iv')) {
      return { ngayBatDau: `${nam}-10-01`, ngayKetThuc: `${nam}-12-31`, ghiChuTime: 'Quý IV' };
    }

    // Nhận diện Tháng
    const monthMatch = lower.match(/(?:tháng|t)\s*([0-1]?[0-9])/);
    if (monthMatch && monthMatch[1]) {
      const mNum = parseInt(monthMatch[1], 10);
      if (mNum >= 1 && mNum <= 12) {
        const mStr = String(mNum).padStart(2, '0');
        const lastDay = new Date(nam, mNum, 0).getDate();
        return {
          ngayBatDau: `${nam}-${mStr}-01`,
          ngayKetThuc: `${nam}-${mStr}-${String(lastDay).padStart(2, '0')}`,
          ghiChuTime: `Tháng ${mNum}`,
        };
      }
    }
  }

  // Mặc định cả năm
  return {
    ngayBatDau: `${nam}-01-01`,
    ngayKetThuc: `${nam}-12-31`,
    ghiChuTime: textSource || `Năm ${nam}`,
  };
}

/**
 * Phân tích và kiểm tra tính hợp lệ của tệp Excel hoặc CSV tải lên
 */
export async function parseAndValidateChuongTrinhFile(
  file: File,
  existingList: ChuongTrinhKtGs[] = [],
  donViList: DonVi[] = [],
): Promise<ParseResult> {
  let rawRows: any[][] = [];

  const fileName = file.name.toLowerCase();
  const isCsv = fileName.endsWith('.csv');

  if (isCsv) {
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) {
      return { totalRows: 0, validRows: [], invalidRows: [], duplicateCount: 0, rows: [] };
    }

    const firstLine = lines[0] || '';
    let delim = ',';
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    if (semiCount > commaCount && semiCount > tabCount) delim = ';';
    else if (tabCount > commaCount && tabCount > semiCount) delim = '\t';

    const parseLine = (line: string, d: string): string[] => {
      const res: string[] = [];
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
        } else if (c === d && !inQuotes) {
          res.push(cur.trim().replace(/^"|"$/g, ''));
          cur = '';
        } else {
          cur += c;
        }
      }
      res.push(cur.trim().replace(/^"|"$/g, ''));
      return res;
    };

    rawRows = lines.map((l) => parseLine(l, delim));
  } else {
    // Đọc Excel qua XLSX
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { totalRows: 0, validRows: [], invalidRows: [], duplicateCount: 0, rows: [] };
    }
    const worksheet = workbook.Sheets[firstSheetName];
    rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
  }

  if (rawRows.length <= 1) {
    return { totalRows: 0, validRows: [], invalidRows: [], duplicateCount: 0, rows: [] };
  }

  // Tự động tìm vị trí các cột theo tên hoặc theo vị trí tương đối
  const headerRow = (rawRows[0] || []).map((h) => String(h || '').trim().toLowerCase());

  const findColIndex = (keywords: string[]): number => {
    return headerRow.findIndex((h) => keywords.some((kw) => h.includes(kw)));
  };

  const colNam = findColIndex(['năm', 'nam']);
  const colSoVb = findColIndex(['số văn bản', 'so van ban', 'số vb', 'so vb', 'văn bản']);
  const colCoQuan = findColIndex(['cơ quan', 'co quan', 'chủ thể', 'chu the']);
  const colLoaiHinh = findColIndex(['loại hình', 'loai hinh', 'hình thức']);
  const colLinhVuc = findColIndex(['lĩnh vực', 'linh vuc']);
  const colDoiTuong = findColIndex(['đối tượng', 'doi tuong', 'địa bàn', 'tổ chức', 'chi bộ']);
  const colNoiDung = findColIndex(['nội dung', 'noi dung', 'kế hoạch']);
  const colTuNgay = findColIndex(['từ ngày', 'tu ngay', 'bắt đầu', 'bat dau']);
  const colDenNgay = findColIndex(['đến ngày', 'den ngay', 'kết thúc', 'ket thuc']);
  const colThoiGian = findColIndex(['thời gian', 'thoi gian', 'tiến độ', 'quý']);
  const colTrangThai = findColIndex(['trạng thái', 'trang thai', 'tình trạng']);
  const colGhiChu = findColIndex(['ghi chú', 'ghi chu']);

  const currentYear = new Date().getFullYear();
  const dataRows = rawRows.slice(1);
  const parsedRows: ImportRowData[] = [];
  let duplicateCount = 0;

  const currentHangNamList = existingList.filter(
    (c) => (c.loai_chuong_trinh || 'HANG_NAM') === 'HANG_NAM',
  );

  dataRows.forEach((r, idx) => {
    // Bỏ qua dòng trống hoàn toàn
    if (!r || r.every((cell) => cell === '' || cell === null || cell === undefined)) {
      return;
    }

    const rowNumber = idx + 2;
    const errors: string[] = [];

    // 1. Năm (Nếu trống tự động lấy năm hiện tại)
    let parsedNam = currentYear;
    if (colNam >= 0 && r[colNam]) {
      const val = parseInt(String(r[colNam]).trim(), 10);
      if (!isNaN(val) && val >= 1945 && val <= 2100) {
        parsedNam = val;
      }
    }

    // 2. Nội dung kiểm tra, giám sát (BẮT BUỘC DUY NHẤT)
    let noiDung = '';
    if (colNoiDung >= 0 && r[colNoiDung]) {
      noiDung = String(r[colNoiDung]).trim();
    } else {
      const longestCell = r.reduce((max, cell) => {
        const s = String(cell || '').trim();
        return s.length > max.length ? s : max;
      }, '');
      if (longestCell.length > 20) noiDung = longestCell;
    }

    if (!noiDung) {
      errors.push('Thiếu nội dung kiểm tra, giám sát');
    }

    // 3. Đối tượng (Nếu trống tự động điền 'Chi bộ trực thuộc')
    let doiTuong = 'Chi bộ trực thuộc';
    if (colDoiTuong >= 0 && r[colDoiTuong]) {
      const val = String(r[colDoiTuong]).trim();
      if (val) doiTuong = val;
    }

    // 4. Cơ quan ban hành (Nếu trống tự động điền 'Đảng ủy phường')
    let coQuan = 'Đảng ủy phường';
    if (colCoQuan >= 0 && r[colCoQuan]) {
      const val = String(r[colCoQuan]).trim();
      if (val) coQuan = val;
    }

    // 5. Loại hình (Kiểm tra / Giám sát, mặc định 'Kiểm tra')
    let loaiHinh: LoaiHinhKtGs = 'KIEM_TRA';
    if (colLoaiHinh >= 0 && r[colLoaiHinh]) {
      loaiHinh = normalizeLoaiHinh(String(r[colLoaiHinh]));
    } else if (noiDung.toLowerCase().includes('giám sát')) {
      loaiHinh = 'GIAM_SAT';
    }

    // 6. Lĩnh vực kiểm tra, giám sát
    let linhVuc = 'Công tác xây dựng Đảng';
    if (colLinhVuc >= 0 && r[colLinhVuc]) {
      const lvVal = String(r[colLinhVuc]).trim();
      if (lvVal) linhVuc = normalizeLinhVuc(lvVal);
    } else {
      // Tự động nhận diện theo từ khóa trong nội dung
      linhVuc = normalizeLinhVuc(noiDung);
    }

    // 7. Thời gian: Từ ngày - Đến ngày
    const rawTuNgay = colTuNgay >= 0 ? r[colTuNgay] : '';
    const rawDenNgay = colDenNgay >= 0 ? r[colDenNgay] : '';
    const rawThoiGianGop = colThoiGian >= 0 ? r[colThoiGian] : '';
    const { ngayBatDau, ngayKetThuc, ghiChuTime } = parseDateRange(
      rawTuNgay,
      rawDenNgay,
      rawThoiGianGop,
      parsedNam,
    );

    // 8. Trạng thái (Mặc định 'Chưa thực hiện')
    let trangThai: TrangThaiKtGs = 'CHUA_THUC_HIEN';
    if (colTrangThai >= 0 && r[colTrangThai]) {
      trangThai = normalizeTrangThai(String(r[colTrangThai]));
    }

    // 9. Số văn bản (Tùy chọn)
    const soVanBan = colSoVb >= 0 ? String(r[colSoVb] || '').trim() : '';

    // 10. Ghi chú
    const rawGhiChu = colGhiChu >= 0 ? String(r[colGhiChu] || '').trim() : '';
    const finalGhiChu = rawGhiChu || ghiChuTime || '';

    // Kiểm tra trùng lặp với danh sách hiện tại
    let isDuplicate = false;
    let duplicateId: string | undefined;
    let duplicateReason: string | undefined;

    if (errors.length === 0) {
      if (soVanBan) {
        const foundByVb = currentHangNamList.find(
          (c) =>
            c.nam === parsedNam &&
            c.so_van_ban &&
            c.so_van_ban.trim().toLowerCase() === soVanBan.toLowerCase(),
        );
        if (foundByVb) {
          isDuplicate = true;
          duplicateId = foundByVb.id;
          duplicateReason = `Trùng số VB "${soVanBan}" trong năm ${parsedNam}`;
        }
      }

      if (!isDuplicate) {
        const foundByContent = currentHangNamList.find(
          (c) =>
            c.nam === parsedNam &&
            c.doi_tuong?.trim().toLowerCase() === doiTuong.toLowerCase() &&
            c.noi_dung.trim().toLowerCase() === noiDung.toLowerCase(),
        );
        if (foundByContent) {
          isDuplicate = true;
          duplicateId = foundByContent.id;
          duplicateReason = `Trùng đối tượng "${doiTuong}" và nội dung trong năm ${parsedNam}`;
        }
      }

      if (isDuplicate) {
        duplicateCount++;
      }
    }

    const tenChuongTrinh = `Kế hoạch ${loaiHinh === 'KIEM_TRA' ? 'kiểm tra' : 'giám sát'} năm ${parsedNam} đối với ${doiTuong}`;

    // Tìm kiếm tổ chức đảng tương ứng trong danh mục chung DonVi
    const cleanDoiTuong = doiTuong.trim().toLowerCase();
    const matchedDonVi = (donViList || []).find(
      (d) =>
        d.ten.trim().toLowerCase() === cleanDoiTuong ||
        (d.ma && d.ma.trim().toLowerCase() === cleanDoiTuong),
    );

    // Xác định phân loại chủ thể thực hiện và cấp chủ thể chuẩn xác
    let chuTheLoai: ChuTheLoai = 'KHAC';
    let capChuThe: CapChuThe = 'CO_SO';
    let chuTheDonViId: string | null = null;

    const lowerCq = (coQuan || '').toLowerCase().trim();
    const activeUnits = (donViList || []).filter((d) => !d.deleted_at);
    const rootUnit = activeUnits.find((d) => !d.don_vi_cha_id);
    const rootId = rootUnit ? rootUnit.id : null;

    // 1. Kiểm tra nếu tên cơ quan thuộc về một tổ chức đảng trực thuộc (trường học, chi bộ)
    const childUnits = activeUnits.filter((d) => d.don_vi_cha_id);
    let matchedChild: DonVi | undefined;
    for (const cu of childUnits) {
      const cuClean = cu.ten.toLowerCase().replace(/^(chi bộ|đảng bộ)\s+/i, '').trim();
      if (cuClean.length >= 3 && lowerCq.includes(cuClean)) {
        matchedChild = cu;
        break;
      }
    }

    const isSchoolOrSub =
      lowerCq.includes('trường') ||
      lowerCq.includes('thcs') ||
      lowerCq.includes('thpt') ||
      lowerCq.includes('mầm non') ||
      lowerCq.includes('cao đẳng') ||
      lowerCq.includes('tiểu học');

    if (matchedChild || isSchoolOrSub) {
      capChuThe = 'CO_SO';
      chuTheDonViId = matchedChild ? matchedChild.id : null;
      if (lowerCq.includes('kiểm tra') || lowerCq.includes('ubkt')) {
        chuTheLoai = 'UBKT_CO_SO';
      } else if (matchedChild?.loai === 'CHI_BO' || lowerCq.includes('chi bộ')) {
        chuTheLoai = 'CHI_BO';
      } else {
        chuTheLoai = 'BCH';
      }
    } else {
      // Cơ quan cấp Đảng ủy phường
      capChuThe = 'PHUONG';
      chuTheDonViId = rootId;
      if (lowerCq.includes('thường vụ') || lowerCq.includes('btv')) {
        chuTheLoai = 'BTV';
      } else if (lowerCq.includes('kiểm tra') || lowerCq.includes('ubkt')) {
        chuTheLoai = 'UBKT';
      } else if (
        lowerCq.includes('chấp hành') ||
        lowerCq.includes('bch') ||
        lowerCq.includes('đảng bộ') ||
        lowerCq.includes('đảng ủy')
      ) {
        chuTheLoai = 'BCH';
      } else {
        chuTheLoai = 'KHAC';
      }
    }

    const rawPayload: CreateChuongTrinhInput = {
      nam: parsedNam,
      loai_chuong_trinh: 'HANG_NAM',
      nhiem_ky: null,
      has_nhiem_ky: false,
      chu_the: coQuan,
      chu_the_loai: chuTheLoai,
      cap_chu_the: capChuThe,
      chu_the_don_vi_id: chuTheDonViId,
      co_quan_ban_hanh: coQuan,
      chu_the_ap_dung: doiTuong,
      don_vi_id: matchedDonVi ? matchedDonVi.id : null,
      ten_don_vi: matchedDonVi ? matchedDonVi.ten : null,
      chi_dang_bo_id: matchedDonVi ? matchedDonVi.id : null,
      ten_chi_dang_bo: matchedDonVi ? matchedDonVi.ten : null,
      loai_hinh: loaiHinh,
      linh_vuc: linhVuc,
      doi_tuong: matchedDonVi ? matchedDonVi.ten : doiTuong,
      doi_tuong_loai: 'TO_CHUC',
      doi_tuong_don_vi_id: matchedDonVi ? matchedDonVi.id : null,
      noi_dung: noiDung,
      ten_chuong_trinh: tenChuongTrinh,
      noi_dung_van_ban: null,
      ngay_bat_dau: ngayBatDau,
      ngay_ket_thuc: ngayKetThuc,
      so_van_ban: soVanBan || null,
      ngay_ban_hanh: null,
      nguoi_ky: null,
      trang_thai: trangThai,
      file_pdf_ten: null,
      file_pdf_url: null,
      file_pdf_dung_luong: null,
      ghi_chu_pdf: finalGhiChu || null,
    };

    parsedRows.push({
      rowNumber,
      nam: parsedNam,
      so_van_ban: soVanBan,
      co_quan_ban_hanh: coQuan,
      loai_hinh: loaiHinh,
      linh_vuc: linhVuc,
      doi_tuong: doiTuong,
      noi_dung: noiDung,
      ngay_bat_dau: ngayBatDau || undefined,
      ngay_ket_thuc: ngayKetThuc || undefined,
      trang_thai: trangThai,
      ghi_chu: finalGhiChu || undefined,
      isValid: errors.length === 0,
      errors,
      isDuplicate,
      duplicateId,
      duplicateReason,
      rawPayload,
    });
  });

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);

  return {
    totalRows: parsedRows.length,
    validRows,
    invalidRows,
    duplicateCount,
    rows: parsedRows,
  };
}

/**
 * Xuất danh sách chương trình kiểm tra, giám sát ra file Excel (.xlsx hoặc .csv)
 * Bao gồm đầy đủ: Lĩnh vực kiểm tra, giám sát, Từ ngày, Đến ngày
 */
export function exportChuongTrinhToExcel(
  items: ChuongTrinhKtGs[],
  format: 'xlsx' | 'csv' = 'xlsx',
  fileName = 'Danh_sach_chuong_trinh_kiem_tra_giam_sat_nam',
) {
  const rows = items.map((item, idx) => [
    idx + 1,
    item.nam || '',
    item.so_van_ban || '',
    item.chu_the || item.co_quan_ban_hanh || 'Đảng ủy phường',
    item.loai_hinh === 'KIEM_TRA' ? 'Kiểm tra' : 'Giám sát',
    item.linh_vuc || 'Công tác xây dựng Đảng',
    item.doi_tuong || '',
    item.noi_dung || '',
    item.ngay_bat_dau ? formatDateVn(item.ngay_bat_dau) : '',
    item.ngay_ket_thuc ? formatDateVn(item.ngay_ket_thuc) : '',
    getTrangThaiLabel(item.trang_thai),
    item.ghi_chu_pdf || '',
  ]);

  if (format === 'csv') {
    const csvLines = [
      EXCEL_HEADERS.join(','),
      ...rows.map((r) =>
        r
          .map((c) => {
            const str = String(c ?? '');
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(','),
      ),
    ];
    const content = '\uFEFF' + csvLines.join('\r\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  // Xuất file XLSX chuẩn
  const wsData = [EXCEL_HEADERS, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 6 },  // STT
    { wch: 8 },  // Năm
    { wch: 15 }, // Số văn bản
    { wch: 28 }, // Cơ quan ban hành
    { wch: 14 }, // Loại hình
    { wch: 32 }, // Lĩnh vực kiểm tra, giám sát
    { wch: 26 }, // Đối tượng
    { wch: 60 }, // Nội dung
    { wch: 15 }, // Từ ngày
    { wch: 15 }, // Đến ngày
    { wch: 18 }, // Trạng thái
    { wch: 22 }, // Ghi chú
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DS_ChuongTrinh_HangNam');
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
