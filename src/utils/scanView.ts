import type { ChuongTrinhKtGs, DonVi } from '../types';
import { normalizeSearch } from './phanCongView';
import { normalizeUnitName, findBestMatchingDonVi } from './donViMatcher';

export interface ScanRecordInfo {
  ngay?: string;
  nguoi?: string;
}

export type ScannedMap = Record<string, ScanRecordInfo | boolean | undefined>;

export interface ChiBoScanStat {
  tong: number;
  daScan: number;
  tenChiBo?: string;
  isFallbackName?: boolean;
}

export interface ScanStatsResult {
  tongCuoc: number;
  daScanCuoc: number;
  tyLeCuoc: number;
  tongChiBo: number;
  chiBoDaScanDu: number;
  tyLeChiBo: number;
  theoChiBo: Map<string, ChiBoScanStat>;
  soCuocChuaGanDonVi: number;
}

export interface ScanProgramItem extends ChuongTrinhKtGs {
  scanInfo?: ScanRecordInfo;
  isScanned: boolean;
  chiBoKey: string;
  chiBoTen: string;
  chiBoProgress: string; // VD: "2/3"
}

export interface FilterScanResult {
  items: ScanProgramItem[];
  stats: ScanStatsResult;
}

export interface ResolvedChiBo {
  key: string;
  name: string;
  isFallbackName: boolean;
}

export type ScanFilterMode = boolean | 'CHUA_SCAN' | 'DA_SCAN' | 'ALL';

/**
 * Trích xuất bản đồ scanned từ Firestore document data (hỗ trợ cả nested map và flat keys)
 */
export function extractScannedMap(data: any): ScannedMap {
  if (!data || typeof data !== 'object') return {};
  const map: ScannedMap = {};
  if (data.scanned && typeof data.scanned === 'object') {
    Object.assign(map, data.scanned);
  }
  for (const k of Object.keys(data)) {
    if (k.startsWith('scanned.')) {
      const subId = k.slice('scanned.'.length);
      if (subId && data[k]) {
        map[subId] = data[k];
      }
    }
  }
  return map;
}

/**
 * Nhận diện "chi bộ" để gom cuộc kiểm tra, giám sát:
 * 1. Ưu tiên don_vi_id (hoặc chu_the_don_vi_id / chi_dang_bo_id) của chương trình
 * 2. Nếu không có thì dùng findBestMatchingDonVi để suy ra từ chu_the / co_quan_ban_hanh
 * 3. Nếu vẫn không khớp thì gom theo tên đã chuẩn hóa (normalizeUnitName)
 */
export function resolveChiBo(
  program: ChuongTrinhKtGs,
  donViList?: DonVi[] | null
): ResolvedChiBo {
  // 1. Ưu tiên don_vi_id / chu_the_don_vi_id / chi_dang_bo_id
  const explicitId =
    program.don_vi_id ||
    program.chu_the_don_vi_id ||
    (program as any).chi_dang_bo_id;

  if (explicitId) {
    const matched = donViList?.find((d) => d && !d.deleted_at && d.id === explicitId);
    if (matched) {
      return {
        key: matched.id,
        name: matched.ten,
        isFallbackName: false,
      };
    }
    return {
      key: explicitId,
      name:
        program.ten_don_vi ||
        (program as any).ten_chi_dang_bo ||
        program.chu_the ||
        explicitId,
      isFallbackName: false,
    };
  }

  // 2. Dùng findBestMatchingDonVi từ chu_the / co_quan_ban_hanh
  const rawName = program.chu_the || program.co_quan_ban_hanh || '';
  if (rawName && donViList && donViList.length > 0) {
    const matched = findBestMatchingDonVi(rawName, donViList);
    if (matched) {
      return {
        key: matched.id,
        name: matched.ten,
        isFallbackName: false,
      };
    }
  }

  // 3. Gom theo tên đã chuẩn hóa (normalizeUnitName với stripPrefix=true)
  const normKey = normalizeUnitName(rawName, true) || 'khong_xac_dinh';
  return {
    key: `norm:${normKey}`,
    name: rawName || 'Chưa xác định',
    isFallbackName: true,
  };
}

/**
 * Tính toán thống kê tiến độ scan của năm đã chọn:
 * - tongCuoc, daScanCuoc, tyLeCuoc
 * - tongChiBo, chiBoDaScanDu, tyLeChiBo
 * - theoChiBo: Map<khóaChiBo, { tong, daScan }>
 * - Thống kê KHÔNG phụ thuộc vào ô tìm kiếm hay công tắc hiện đã scan
 */
export function computeScanStats(
  programs: ChuongTrinhKtGs[],
  scannedMap: ScannedMap = {},
  year: number | string,
  donViList?: DonVi[] | null
): ScanStatsResult {
  const targetYear = Number(year);

  // Lọc các cuộc kiểm tra/giám sát hằng năm thuộc năm đã chọn, bỏ bản ghi đã xóa
  const validYearItems = (programs || []).filter((p) => {
    if (!p) return false;
    if ((p as any).is_deleted || (p as any).deleted || (p as any).deleted_at) return false;
    if ((p as any).tombstone) return false;

    const loai = p.loai_chuong_trinh || 'HANG_NAM';
    if (loai !== 'HANG_NAM') return false;

    return Number(p.nam) === targetYear;
  });

  const tongCuoc = validYearItems.length;
  const daScanCuoc = validYearItems.filter((p) => Boolean(scannedMap?.[p.id])).length;
  const tyLeCuoc = tongCuoc > 0 ? Math.round((daScanCuoc / tongCuoc) * 1000) / 10 : 0;

  // Gom theo chi bộ
  const theoChiBo = new Map<string, ChiBoScanStat>();
  let soCuocChuaGanDonVi = 0;

  for (const p of validYearItems) {
    const resolved = resolveChiBo(p, donViList);
    if (resolved.isFallbackName) {
      soCuocChuaGanDonVi++;
    }

    const current = theoChiBo.get(resolved.key) || {
      tong: 0,
      daScan: 0,
      tenChiBo: resolved.name,
      isFallbackName: resolved.isFallbackName,
    };

    current.tong += 1;
    if (scannedMap?.[p.id]) {
      current.daScan += 1;
    }

    theoChiBo.set(resolved.key, current);
  }

  const tongChiBo = theoChiBo.size;
  let chiBoDaScanDu = 0;

  for (const [, stat] of theoChiBo) {
    if (stat.tong > 0 && stat.daScan === stat.tong) {
      chiBoDaScanDu++;
    }
  }

  const tyLeChiBo = tongChiBo > 0 ? Math.round((chiBoDaScanDu / tongChiBo) * 1000) / 10 : 0;

  return {
    tongCuoc,
    daScanCuoc,
    tyLeCuoc,
    tongChiBo,
    chiBoDaScanDu,
    tyLeChiBo,
    theoChiBo,
    soCuocChuaGanDonVi,
  };
}

/**
 * Lọc và sắp xếp danh sách hiển thị cho thẻ Scan hồ sơ:
 * - Nhận danh sách chương trình, bản đồ scanned, năm, công tắc/chế độ hiện đã scan, từ khóa
 * - Hiển thị mọi cuộc thuộc năm (bất kể trạng thái thực hiện)
 * - Mặc định chỉ hiện cuộc chưa tích
 * - Sắp xếp theo thời gian rồi theo tên
 * - Trả về danh sách hiển thị kèm tiến độ chi bộ (ví dụ "2/3") và bộ thống kê
 */
export function filterScanPrograms(
  programs: ChuongTrinhKtGs[],
  scannedMap: ScannedMap = {},
  year: number | string,
  showScanned: ScanFilterMode = false,
  searchQuery: string = '',
  donViList?: DonVi[] | null
): FilterScanResult {
  const targetYear = Number(year);

  // 1. Luôn tính toán thống kê trên toàn bộ cuộc của năm (không bị ảnh hưởng bởi bộ lọc/tìm kiếm)
  const stats = computeScanStats(programs, scannedMap, year, donViList);

  // 2. Lấy toàn bộ cuộc hợp lệ trong năm (bất kể trạng thái thực hiện)
  const validYearItems = (programs || []).filter((p) => {
    if (!p) return false;
    if ((p as any).is_deleted || (p as any).deleted || (p as any).deleted_at) return false;
    if ((p as any).tombstone) return false;

    const loai = p.loai_chuong_trinh || 'HANG_NAM';
    if (loai !== 'HANG_NAM') return false;

    return Number(p.nam) === targetYear;
  });

  // 3. Lọc theo chế độ xem / công tắc scan
  let filtered = validYearItems.filter((p) => {
    const isScanned = Boolean(scannedMap?.[p.id]);
    if (showScanned === 'DA_SCAN') {
      return isScanned;
    }
    if (showScanned === 'CHUA_SCAN' || showScanned === false) {
      return !isScanned;
    }
    // showScanned === 'ALL' hoặc true: hiện cả đã scan
    return true;
  });

  // 4. Lọc theo từ khóa tìm kiếm phong phú (không phân biệt dấu tiếng Việt)
  const normalizedQuery = normalizeSearch(searchQuery);
  if (normalizedQuery) {
    filtered = filtered.filter((p) => {
      const trangThaiText =
        p.trang_thai === 'QUA_HAN'
          ? 'qua han'
          : p.trang_thai === 'DANG_THUC_HIEN'
          ? 'dang thuc hien'
          : p.trang_thai === 'DA_HOAN_THANH'
          ? 'hoan thanh da hoan thanh'
          : 'chua thuc hien';

      const loaiHinhText =
        p.loai_hinh === 'KIEM_TRA' ? 'kiem tra kt' : p.loai_hinh === 'GIAM_SAT' ? 'giam sat gs' : '';

      // Hỗ trợ tìm kiếm theo tháng ("thang 3", "thang 03", "t3",...)
      const dateParts: string[] = [];
      if (p.ngay_bat_dau) {
        dateParts.push(p.ngay_bat_dau);
        const m = p.ngay_bat_dau.slice(5, 7);
        if (m) {
          dateParts.push(`thang ${m}`, `thang ${parseInt(m, 10)}`, `t${parseInt(m, 10)}`);
        }
      }
      if (p.ngay_ket_thuc) {
        dateParts.push(p.ngay_ket_thuc);
        const m = p.ngay_ket_thuc.slice(5, 7);
        if (m) {
          dateParts.push(`thang ${m}`, `thang ${parseInt(m, 10)}`, `t${parseInt(m, 10)}`);
        }
      }

      const searchTarget = [
        p.chu_the,
        p.co_quan_ban_hanh,
        p.doi_tuong,
        p.ten_don_vi,
        (p as any).ten_chi_dang_bo,
        p.noi_dung,
        p.linh_vuc,
        p.so_van_ban,
        loaiHinhText,
        trangThaiText,
        p.trang_thai,
        ...dateParts,
      ]
        .filter(Boolean)
        .join(' ')
        .replace(/[_-]/g, ' ');

      return normalizeSearch(searchTarget).includes(normalizedQuery);
    });
  }

  // 5. Sắp xếp: theo thời gian rồi theo tên
  filtered.sort((a, b) => {
    const timeA = a.ngay_bat_dau || a.ngay_ket_thuc || '';
    const timeB = b.ngay_bat_dau || b.ngay_ket_thuc || '';
    if (timeA !== timeB) {
      if (!timeA) return 1;
      if (!timeB) return -1;
      return timeA.localeCompare(timeB);
    }
    const nameA = a.chu_the || a.co_quan_ban_hanh || '';
    const nameB = b.chu_the || b.co_quan_ban_hanh || '';
    return nameA.localeCompare(nameB, 'vi');
  });

  // 6. Gắn thông tin scan và tiến độ chi bộ vào từng dòng hiển thị
  const items: ScanProgramItem[] = filtered.map((p) => {
    const rawScan = scannedMap?.[p.id];
    const isScanned = Boolean(rawScan);
    const scanInfo = isScanned && typeof rawScan === 'object' ? rawScan : undefined;

    const resolved = resolveChiBo(p, donViList);
    const cbStat = stats.theoChiBo.get(resolved.key);
    const chiBoProgress = cbStat ? `${cbStat.daScan}/${cbStat.tong}` : '0/0';

    return {
      ...p,
      isScanned,
      scanInfo,
      chiBoKey: resolved.key,
      chiBoTen: resolved.name,
      chiBoProgress,
    };
  });

  return {
    items,
    stats,
  };
}
