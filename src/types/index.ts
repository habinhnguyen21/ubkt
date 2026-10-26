export type UserRole = 'ADMIN' | 'BIEN_TAP' | 'XEM';

export type ChucDanhUbkt =
  | 'Chủ nhiệm UBKT'
  | 'Phó Chủ nhiệm UBKT'
  | 'Uỷ viên UBKT'
  | 'Chuyên viên UBKT'
  | 'Khác';

export interface User {
  id: string;
  ten_dang_nhap: string;
  ho_ten: string;
  vai_tro: UserRole;
  chuc_danh?: ChucDanhUbkt | string;
  don_vi_id?: string | null;
  ten_don_vi?: string | null;
  pham_vi_quan_ly?: string[] | null;
  trang_thai: number;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export type DonViLoai = 'DANG_BO' | 'CHI_BO' | 'BTV' | 'BCH' | 'UBKT';

export type TrangThaiDonVi = 'DANG_HOAT_DONG' | 'TAM_NGUNG' | 'CHAM_DUT';

export type CapToChuc = 'CAP_TREN' | 'CO_SO' | 'TRUC_THUOC';

export interface LoaiHinhToChuc {
  ma: string;
  ten: string;
  mo_ta?: string;
  is_active: boolean;
  thu_tu?: number;
}

export interface DonVi {
  id: string;
  ten: string;
  loai: DonViLoai | string;
  don_vi_cha_id: string | null;
  cap_to_chuc?: CapToChuc;
  ma: string | null;
  thu_tu: number;
  ghi_chu: string | null;
  trang_thai?: TrangThaiDonVi;
  ngay_thanh_lap?: string | null;
  ngay_ket_thuc?: string | null;
  so_quyet_dinh?: string | null;
  nguoi_tao_ten?: string | null;
  nguoi_tao_id?: string | null;
  nguoi_cap_nhat_ten?: string | null;
  nguoi_cap_nhat_id?: string | null;
  version: number;
  sync_status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DonViTreeItem {
  id: string;
  ten: string;
  loai: DonViLoai | string;
  don_vi_cha_id: string | null;
  ma: string | null;
  thu_tu: number;
  ghi_chu: string | null;
  trang_thai?: TrangThaiDonVi;
  ngay_thanh_lap?: string | null;
  ngay_ket_thuc?: string | null;
  so_quyet_dinh?: string | null;
  cap_do?: number;
  so_luong_truc_thuoc?: number;
  children: DonViTreeItem[];
}

export interface CreateDonViInput {
  ten: string;
  loai: DonViLoai | string;
  don_vi_cha_id: string | null;
  ma?: string | null;
  thu_tu?: number | null;
  ghi_chu?: string | null;
  trang_thai?: TrangThaiDonVi;
  ngay_thanh_lap?: string | null;
  ngay_ket_thuc?: string | null;
  so_quyet_dinh?: string | null;
  nguoi_tao_ten?: string | null;
  nguoi_tao_id?: string | null;
}

export interface UpdateDonViInput {
  id: string;
  ten: string;
  loai: DonViLoai | string;
  don_vi_cha_id: string | null;
  ma?: string | null;
  thu_tu?: number;
  ghi_chu?: string | null;
  trang_thai?: TrangThaiDonVi;
  ngay_thanh_lap?: string | null;
  ngay_ket_thuc?: string | null;
  so_quyet_dinh?: string | null;
  nguoi_cap_nhat_ten?: string | null;
  nguoi_cap_nhat_id?: string | null;
}

export interface AppInfo {
  app_name: string;
  version: string;
  total_don_vi: number;
  pending_sync_count: number;
  root_unit_name?: string;
  root_unit_id?: string | null;
  server_mode?: string;
  server_time?: string;
}

export interface NhatKy {
  id: string;
  nguoi_dung_id: string | null;
  ten_nguoi_dung: string | null;
  hanh_dong: string;
  bang_anh_huong: string;
  ban_ghi_id: string | null;
  du_lieu_cu: string | null;
  du_lieu_moi: string | null;
  thoi_gian: string;
}

export type LoaiHinhKtGs = 'KIEM_TRA' | 'GIAM_SAT';
export type TrangThaiKtGs = 'CHUA_THUC_HIEN' | 'DANG_THUC_HIEN' | 'DA_HOAN_THANH' | 'QUA_HAN';
export type LoaiChuongTrinh = 'HANG_NAM' | 'NHIEM_KY';
export type ChuTheLoai = 'BCH' | 'BTV' | 'UBKT' | 'UBKT_CO_SO' | 'CHI_BO' | 'KHAC';
export type CapChuThe = 'PHUONG' | 'CO_SO';

export interface ThayDoiBoSungKtGs {
  id: string;
  chuong_trinh_id: string;
  lan_dieu_chinh?: number;
  so_van_ban: string; // VD: "05-KH/ĐU", "12-QĐ/ĐU"
  ngay_ban_hanh: string; // YYYY-MM-DD
  nguoi_ky?: string | null;
  don_vi_id?: string | null; // Địa bàn liên quan (nếu null = Toàn Đảng bộ)
  ten_don_vi?: string | null; // Tên chi, đảng bộ địa bàn
  noi_dung_dieu_chinh: string; // Nội dung thay đổi, bổ sung
  noi_dung_goc?: string | null; // Nội dung ban đầu để đối chiếu
  file_pdf_ten?: string | null;
  file_pdf_url?: string | null;
  file_pdf_dung_luong?: number | null;
  nhom_ho_so?: string | null;
  ghi_chu?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ChuongTrinhKtGs {
  id: string;
  nam: number;
  loai_chuong_trinh?: LoaiChuongTrinh;
  nhiem_ky?: string | null; // Ví dụ: '2025 - 2030', '2020 - 2025', '2025 - 2027', cho phép nhập thủ công yyyy - yyyy
  khoa_nhiem_ky?: string | null; // Tương đương nhiem_ky
  has_nhiem_ky?: boolean;
  term_start_year?: number | null;
  term_end_year?: number | null;
  ten_chuong_trinh?: string | null; // Tên chương trình hiển thị
  co_quan_ban_hanh?: string | null; // Ví dụ: 'BCH Đảng bộ phường Ái Quốc', 'Ban Thường vụ Đảng ủy phường'
  chu_the_ap_dung?: string | null; // Ví dụ: 'Toàn Đảng bộ', 'Chi bộ Quân sự', 'Chi bộ Công an'
  thoi_gian_loai?: 'CA_NHIEM_KY' | 'KHOANG_THOI_GIAN';
  chu_the: string;
  chu_the_loai?: ChuTheLoai;
  cap_chu_the?: CapChuThe;
  chu_the_don_vi_id?: string | null;
  don_vi_id: string | null;
  ten_don_vi: string | null;
  chi_dang_bo_id?: string | null; // ID chi, đảng bộ được lưu/áp dụng
  ten_chi_dang_bo?: string | null; // Tên chi, đảng bộ (hoặc 'Toàn Đảng bộ')
  loai_hinh?: LoaiHinhKtGs | null; // Đối với chương trình nhiệm kỳ có thể bỏ/không bắt buộc
  doi_tuong?: string | null; // Tên hiển thị đối tượng
  doi_tuong_loai?: 'TO_CHUC' | 'DANG_VIEN';
  doi_tuong_don_vi_id?: string | null; // Khóa ngoại chuẩn hóa đến danh mục DonVi duy nhất
  noi_dung: string;
  noi_dung_van_ban?: string | null; // Nội dung chi tiết văn bản đính kèm theo
  ngay_bat_dau: string | null;
  ngay_ket_thuc: string | null;
  so_van_ban: string | null;
  ngay_ban_hanh?: string | null;
  nguoi_ky?: string | null;
  trang_thai: TrangThaiKtGs;
  file_pdf_ten: string | null;
  file_pdf_url: string | null;
  file_pdf_dung_luong?: number | null;
  ghi_chu_pdf: string | null;
  danh_sach_thay_doi_bo_sung?: ThayDoiBoSungKtGs[]; // Bảng list nạp đối chiếu thay đổi bổ sung
  linh_vuc?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateChuongTrinhInput {
  nam: number;
  loai_chuong_trinh?: LoaiChuongTrinh;
  nhiem_ky?: string | null;
  khoa_nhiem_ky?: string | null;
  has_nhiem_ky?: boolean;
  term_start_year?: number | null;
  term_end_year?: number | null;
  ten_chuong_trinh?: string | null;
  co_quan_ban_hanh?: string | null;
  chu_the_ap_dung?: string | null;
  thoi_gian_loai?: 'CA_NHIEM_KY' | 'KHOANG_THOI_GIAN';
  chu_the: string;
  chu_the_loai?: ChuTheLoai;
  cap_chu_the?: CapChuThe;
  chu_the_don_vi_id?: string | null;
  don_vi_id?: string | null;
  ten_don_vi?: string | null;
  chi_dang_bo_id?: string | null;
  ten_chi_dang_bo?: string | null;
  loai_hinh?: LoaiHinhKtGs | null;
  doi_tuong?: string | null;
  doi_tuong_loai?: 'TO_CHUC' | 'DANG_VIEN';
  doi_tuong_don_vi_id?: string | null; // Khóa ngoại chuẩn hóa đến danh mục DonVi duy nhất
  linh_vuc?: string | null;
  noi_dung: string;
  noi_dung_van_ban?: string | null;
  ngay_bat_dau?: string | null;
  ngay_ket_thuc?: string | null;
  so_van_ban?: string | null;
  ngay_ban_hanh?: string | null;
  nguoi_ky?: string | null;
  trang_thai: TrangThaiKtGs;
  file_pdf_ten?: string | null;
  file_pdf_url?: string | null;
  file_pdf_dung_luong?: number | null;
  ghi_chu_pdf?: string | null;
  danh_sach_thay_doi_bo_sung?: ThayDoiBoSungKtGs[];
}

export interface UpdateChuongTrinhInput extends CreateChuongTrinhInput {
  id: string;
}

export interface PdfKhoItem {
  id: string;
  ten_file: string;
  dung_luong: number;
  url?: string | null;
  file_url?: string | null;
  loai_file?: string | null; // pdf, docx, doc, xlsx, etc.
  the_loai_van_ban?: string | null; // Quyết định, Báo cáo, Kế hoạch, Quy chế, Kết luận...
  so_van_ban?: string | null;
  trich_yeu?: string | null;
  nguoi_ky?: string | null;
  chuong_trinh_id?: string | null;
  thay_doi_id?: string | null;
  don_vi_id?: string | null;
  ten_don_vi?: string | null;
  nguon_goc?: 'CHUONG_TRINH' | 'THAY_DOI_BO_SUNG' | 'HO_SO_DIA_BAN' | 'KHO_PDF' | 'BAO_CAO_THANG';
  chu_the?: string | null;
  doi_tuong?: string | null;
  nam?: number | null;
  loai_hinh?: LoaiHinhKtGs | null;
  ngay_ban_hanh?: string | null;
  ghi_chu?: string | null;
  google_drive_id?: string | null;
  google_drive_preview_url?: string | null;
  is_google_drive?: boolean | null;
  created_at: string;
}

export interface HoSoDiaBanFile {
  id: string;
  don_vi_id: string;
  ten_don_vi?: string;
  the_loai_van_ban?: string; // Quyết định, Báo cáo, Kế hoạch, Kết luận, Nghị quyết, Thông báo, Quy chế, Công văn, Khác...
  so_van_ban?: string; // Số ký hiệu văn bản
  trich_yeu?: string; // Trích yếu nội dung văn bản
  nguoi_ky?: string; // Người ký (Họ tên, chức danh)
  ngay_ban_hanh?: string; // Ngày ban hành (DD/MM/YYYY)
  ten_file: string;
  loai_file: 'docx' | 'doc' | 'pdf' | 'xlsx' | 'xls' | string;
  dung_luong: number;
  url?: string | null;
  file_url?: string | null;
  google_drive_id?: string | null;
  google_drive_preview_url?: string | null;
  is_google_drive?: boolean | null;
  loai_tai_lieu?: string; // Thuộc 6 nhóm hồ sơ nghiệp vụ địa bàn
  mo_ta?: string;
  ngay_tao: string;
  nguoi_tao?: string;
}

export interface PhanCongDiaBan {
  id?: string;
  user_id: string;
  user_name: string;
  don_vi_ids: string[];
  loai_phan_cong?: 'THUONG_XUYEN' | 'DOAN_KIEM_TRA';
  tu_ngay?: string;
  den_ngay?: string | null;
  so_quyet_dinh?: string | null;
  trang_thai?: 'DANG_PHU_TRACH' | 'DA_CHUYEN_GIAO';
  ghi_chu?: string;
  updated_at: string;
}

export type BaoCaoThangStatus = 'DA_NOP_DUNG_HAN' | 'DA_NOP_MUON' | 'CHUA_NOP' | 'CHO_DUYET';

export interface VanDeTheoDoi {
  id: string;
  noi_dung: string;
  muc_do: 'THUONG' | 'QUAN_TRONG' | 'PHUC_TAP';
  ngay_ghi_nhan: string;
  nguoi_ghi_nhan?: string | null;
  trang_thai: 'DANG_THEO_DOI' | 'DA_XU_LY';
  file_ten?: string | null;
  file_url?: string | null;
  file_loai?: string | null;
  file_dung_luong?: number | null;
  nhom_ho_so?: string | null; // Thuộc 1 trong 6 nhóm hồ sơ
}

export interface ChiDaoNhiemVu {
  id: string;
  noi_dung: string;
  van_ban_chi_dao?: string;
  han_hoan_thanh?: string;
  nguoi_ghi_nhan?: string | null;
  trang_thai: 'CHUA_HOAN_THANH' | 'DA_HOAN_THANH';
  file_ten?: string | null;
  file_url?: string | null;
  file_loai?: string | null;
  file_dung_luong?: number | null;
  nhom_ho_so?: string | null; // Thuộc 1 trong 6 nhóm hồ sơ
}

export interface BaoCaoDinhKy {
  id: string;
  thang: number;
  nam: number;
  ngay_nop: string;
  tinh_trang: BaoCaoThangStatus;
  file_ten?: string;
  file_loai?: string;
  file_dung_luong?: number;
  nguoi_nop?: string;
  ghi_chu?: string;
}

export interface BaoCaoThangItem {
  id: string;
  tieu_de: string;
  thang: number;
  nam: number;
  ngay_nop: string;
  can_bo_id?: string;
  can_bo_ten: string;
  danh_sach_don_vi_ids: string[];
  danh_sach_ten_don_vi: string[];
  tinh_trang: BaoCaoThangStatus;
  file_ten?: string;
  file_loai?: 'pdf' | 'docx' | 'doc';
  file_dung_luong?: number;
  file_url?: string | null;
  noi_dung_tom_tat?: string;
  ghi_chu?: string;
  created_at: string;
}

export interface LichSuPhuTrachDiaBan {
  id: string;
  can_bo_id?: string;
  can_bo_ten: string;
  can_bo_chuc_vu?: string;
  tu_ngay: string;
  den_ngay?: string | null; // null nếu là cán bộ hiện đang phụ trách
  van_ban_phan_cong?: string;
  can_cu_van_ban?: string; // Bổ sung căn cứ văn bản chi tiết
  so_quyet_dinh?: string; // Số ký hiệu văn bản / Quyết định
  ngay_ban_hanh_qd?: string; // Ngày ban hành quyết định (DD/MM/YYYY)
  co_quan_ban_hanh?: string; // Cơ quan ban hành (Đảng ủy, UBKT Đảng ủy...)
  file_van_ban?: string; // Tên tệp văn bản đính kèm
  file_url?: string | null; // Link tải tệp
  ly_do_thay_doi?: string;
  nguoi_thuc_hien?: string;
  created_at: string;
}

export type TrangThaiHoSoDiaBan = 'DANG_THEO_DOI' | 'DA_KET_THUC';

export interface DiaBanRecord {
  id: string; // don_vi_id
  ten_dia_ban: string;
  loai_to_chuc: string;
  trang_thai_to_chuc?: TrangThaiDonVi;
  can_bo_phu_trach_id?: string;
  can_bo_phu_trach_ten?: string;
  can_bo_chuc_vu?: string;
  thoi_gian_phan_cong?: string;
  van_ban_phan_cong?: string; // Ví dụ: "QĐ số 08-QĐ/UBKT ngày 15/01/2026"
  tinh_trang_bao_cao_thang: BaoCaoThangStatus;
  thang_hien_tai: string;
  so_van_de_theo_doi: number;
  danh_sach_van_de?: VanDeTheoDoi[];
  so_chi_dao_chua_hoan_thanh: number;
  danh_sach_chi_dao?: ChiDaoNhiemVu[];
  thoi_diem_cap_nhat_gan_nhat: string;
  nguoi_cap_nhat_gan_nhat?: string;
  so_luong_tai_lieu?: number;
  ghi_chu?: string;
  // Lịch sử đổi cán bộ phụ trách
  lich_su_phu_trach?: LichSuPhuTrachDiaBan[];
  // Kết thúc hồ sơ địa bàn
  trang_thai_ho_so?: TrangThaiHoSoDiaBan;
  ngay_ket_thuc_ho_so?: string | null;
  nguoi_ket_thuc?: string | null;
  van_ban_ket_thuc?: string | null;
  ghi_chu_ket_thuc?: string | null;
}

// ── QUẢN LÝ ĐƠN THƯ (PETITIONS & COMPLAINTS MANAGEMENT) ──────────────────────
export type LoaiDonThu = 'Khiếu nại' | 'Tố cáo' | 'Kiến nghị' | 'Phản ánh' | 'Đơn khác';

export type LinhVucDonThu =
  | 'Công tác đảng'
  | 'Phẩm chất đạo đức'
  | 'Thực hiện nhiệm vụ'
  | 'Quản lý kinh tế'
  | 'Khác';

export type DoiTuongLienQuanDonThu = 'Tổ chức đảng' | 'Đảng viên' | 'Công dân' | 'Khác';

export type PhanLoaiXuLyDonThu = 'Thuộc thẩm quyền' | 'Không thuộc thẩm quyền';

export type HuongXuLyDonThu =
  | 'Xem xét giải quyết'
  | 'Chuyển cơ quan khác'
  | 'Lưu đơn'
  | 'Hướng dẫn trả lời';

export type TrangThaiDonThu = 'Mới tiếp nhận' | 'Đang xử lý' | 'Đã hoàn thành' | 'Quá hạn';

export interface DonThu {
  id: string;
  ma_don: string; // VD: "ĐT-2026-001"
  ngay_tiep_nhan: string; // YYYY-MM-DD
  loai_don: LoaiDonThu;
  linh_vuc: LinhVucDonThu | string;
  linh_vuc_khac?: string;
  doi_tuong_lien_quan: DoiTuongLienQuanDonThu | string;
  doi_tuong_khac?: string;
  phan_loai_xu_ly: PhanLoaiXuLyDonThu;
  huong_xu_ly: HuongXuLyDonThu;
  thoi_han_quy_dinh: number; // Số ngày (VD: 30)
  can_bo_phu_trach: string; // VD: "Đ/c Nguyễn Văn A"
  trang_thai: TrangThaiDonThu;
  ngay_hoan_thanh?: string | null; // YYYY-MM-DD nếu đã xong
  ghi_chu_nghiep_vu?: string; // Tối đa 255 ký tự (không sao chép nội dung đơn)
  trong_ky?: boolean; // True nếu tiếp nhận trong kỳ
  created_at: string;
  updated_at: string;
}

export interface DonThuStats {
  tong_so_don: number;
  trong_ky: number;
  dang_xu_ly: number;
  da_hoan_thanh: number;
  qua_han: number;
  theo_loai_don: Record<string, number>;
  theo_linh_vuc: Record<string, number>;
  theo_huong_xu_ly: Record<string, number>;
  theo_can_bo: Record<string, number>;
}



