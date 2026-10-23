import type {
  AppInfo,
  ChuongTrinhKtGs,
  CreateChuongTrinhInput,
  CreateDonViInput,
  DonVi,
  DonViLoai,
  DonViTreeItem,
  NhatKy,
  UpdateChuongTrinhInput,
  UpdateDonViInput,
  User,
  PdfKhoItem,
  ThayDoiBoSungKtGs,
  DonThu,
  TrangThaiDonVi,
} from '../types';
import { db as firestoreDb } from './firebase';
import { collection, getDocs } from 'firebase/firestore';


// Giao thức giao tiếp Trực tuyến (Full Online API Client)
async function requestApi<T>(
  endpoint: string,
  method = 'GET',
  body?: unknown,
  fallbackCmd?: string,
  fallbackArgs?: Record<string, unknown>
): Promise<T> {
  try {
    const res = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.ok) {
      return (await res.json()) as T;
    }

    const errJson = await res.json().catch(() => null);
    throw new Error(errJson?.message || `Lỗi máy chủ trực tuyến (${res.status})`);
  } catch (err: unknown) {
    if (fallbackCmd) {
      // Fallback tự động khi máy chủ dev hoặc preview chạy độc lập
      return mockInvoke<T>(fallbackCmd, fallbackArgs);
    }
    throw err;
  }
}

// Lưu trữ dự phòng phục vụ xem trước (preview) trên trình duyệt độc lập
const MOCK_STORAGE_KEY = 'ubkt_mock_db';

interface MockDb {
  users: User[];
  donViList: DonVi[];
  chuongTrinhList: ChuongTrinhKtGs[];
  auditLogs: NhatKy[];
  pdfFiles?: PdfKhoItem[];
  donThuList?: DonThu[];
}

const DEFAULT_DON_THU_LIST: DonThu[] = [
  {
    id: 'dt-2026-001',
    ma_don: 'ĐT-2026-001',
    ngay_tiep_nhan: '2026-07-15',
    loai_don: 'Khiếu nại',
    linh_vuc: 'Công tác đảng',
    doi_tuong_lien_quan: 'Tổ chức đảng',
    phan_loai_xu_ly: 'Thuộc thẩm quyền',
    huong_xu_ly: 'Xem xét giải quyết',
    thoi_han_quy_dinh: 30,
    can_bo_phu_trach: 'Đ/c Nguyễn Văn A',
    trang_thai: 'Đang xử lý',
    ngay_hoan_thanh: null,
    ghi_chu_nghiep_vu: 'Đã hoàn thiện thẩm tra, đang lập dự thảo kết luận',
    trong_ky: false,
    created_at: '2026-07-15T08:30:00.000Z',
    updated_at: '2026-07-15T08:30:00.000Z',
  },
  {
    id: 'dt-2026-002',
    ma_don: 'ĐT-2026-002',
    ngay_tiep_nhan: '2026-08-05',
    loai_don: 'Khiếu nại',
    linh_vuc: 'Phẩm chất đạo đức',
    doi_tuong_lien_quan: 'Đảng viên',
    phan_loai_xu_ly: 'Thuộc thẩm quyền',
    huong_xu_ly: 'Xem xét giải quyết',
    thoi_han_quy_dinh: 30,
    can_bo_phu_trach: 'Đ/c Nguyễn Văn A',
    trang_thai: 'Đang xử lý',
    ngay_hoan_thanh: null,
    ghi_chu_nghiep_vu: 'Đang xác minh bổ sung tình tiết mới phát sinh',
    trong_ky: true,
    created_at: '2026-08-05T09:00:00.000Z',
    updated_at: '2026-08-05T09:00:00.000Z',
  },
  {
    id: 'dt-2026-003',
    ma_don: 'ĐT-2026-003',
    ngay_tiep_nhan: '2026-10-02',
    loai_don: 'Khiếu nại',
    linh_vuc: 'Phẩm chất đạo đức',
    doi_tuong_lien_quan: 'Đảng viên',
    phan_loai_xu_ly: 'Thuộc thẩm quyền',
    huong_xu_ly: 'Xem xét giải quyết',
    thoi_han_quy_dinh: 30,
    can_bo_phu_trach: 'Đ/c Nguyễn Văn A',
    trang_thai: 'Đang xử lý',
    ngay_hoan_thanh: null,
    ghi_chu_nghiep_vu: 'Đã mời đối tượng lên làm việc lần 1',
    trong_ky: true,
    created_at: '2026-10-02T10:15:00.000Z',
    updated_at: '2026-10-02T10:15:00.000Z',
  },
  {
    id: 'dt-2026-004',
    ma_don: 'ĐT-2026-004',
    ngay_tiep_nhan: '2026-09-10',
    loai_don: 'Khiếu nại',
    linh_vuc: 'Thực hiện nhiệm vụ',
    doi_tuong_lien_quan: 'Tổ chức đảng',
    phan_loai_xu_ly: 'Thuộc thẩm quyền',
    huong_xu_ly: 'Xem xét giải quyết',
    thoi_han_quy_dinh: 30,
    can_bo_phu_trach: 'Đ/c Trần Thị B',
    trang_thai: 'Đã hoàn thành',
    ngay_hoan_thanh: '2026-10-05',
    ghi_chu_nghiep_vu: 'Đã ban hành thông báo kết luận giải quyết khiếu nại',
    trong_ky: true,
    created_at: '2026-09-10T08:00:00.000Z',
    updated_at: '2026-10-05T16:00:00.000Z',
  },
  {
    id: 'dt-2026-005',
    ma_don: 'ĐT-2026-005',
    ngay_tiep_nhan: '2026-09-15',
    loai_don: 'Khiếu nại',
    linh_vuc: 'Quản lý kinh tế',
    doi_tuong_lien_quan: 'Đảng viên',
    phan_loai_xu_ly: 'Không thuộc thẩm quyền',
    huong_xu_ly: 'Chuyển cơ quan khác',
    thoi_han_quy_dinh: 15,
    can_bo_phu_trach: 'Đ/c Trần Thị B',
    trang_thai: 'Đã hoàn thành',
    ngay_hoan_thanh: '2026-09-25',
    ghi_chu_nghiep_vu: 'Đã chuyển hồ sơ sang UBND phường theo đúng thẩm quyền',
    trong_ky: true,
    created_at: '2026-09-15T09:20:00.000Z',
    updated_at: '2026-09-25T14:30:00.000Z',
  },
  {
    id: 'dt-2026-006',
    ma_don: 'ĐT-2026-006',
    ngay_tiep_nhan: '2026-09-20',
    loai_don: 'Tố cáo',
    linh_vuc: 'Công tác đảng',
    doi_tuong_lien_quan: 'Tổ chức đảng',
    phan_loai_xu_ly: 'Thuộc thẩm quyền',
    huong_xu_ly: 'Xem xét giải quyết',
    thoi_han_quy_dinh: 60,
    can_bo_phu_trach: 'Đ/c Nguyễn Văn A',
    trang_thai: 'Đang xử lý',
    ngay_hoan_thanh: null,
    ghi_chu_nghiep_vu: 'Đã thành lập đoàn kiểm tra xem xét dấu hiệu vi phạm theo quy trình',
    trong_ky: true,
    created_at: '2026-09-20T14:00:00.000Z',
    updated_at: '2026-09-20T14:00:00.000Z',
  },
  {
    id: 'dt-2026-007',
    ma_don: 'ĐT-2026-007',
    ngay_tiep_nhan: '2026-08-12',
    loai_don: 'Tố cáo',
    linh_vuc: 'Phẩm chất đạo đức',
    doi_tuong_lien_quan: 'Đảng viên',
    phan_loai_xu_ly: 'Không thuộc thẩm quyền',
    huong_xu_ly: 'Chuyển cơ quan khác',
    thoi_han_quy_dinh: 15,
    can_bo_phu_trach: 'Đ/c Trần Thị B',
    trang_thai: 'Đã hoàn thành',
    ngay_hoan_thanh: '2026-08-22',
    ghi_chu_nghiep_vu: 'Đã chuyển cơ quan Thanh tra giải quyết theo chức năng',
    trong_ky: true,
    created_at: '2026-08-12T08:45:00.000Z',
    updated_at: '2026-08-22T15:20:00.000Z',
  },
  {
    id: 'dt-2026-008',
    ma_don: 'ĐT-2026-008',
    ngay_tiep_nhan: '2026-06-18',
    loai_don: 'Tố cáo',
    linh_vuc: 'Phẩm chất đạo đức',
    doi_tuong_lien_quan: 'Đảng viên',
    phan_loai_xu_ly: 'Thuộc thẩm quyền',
    huong_xu_ly: 'Lưu đơn',
    thoi_han_quy_dinh: 10,
    can_bo_phu_trach: 'Đ/c Lê Văn C',
    trang_thai: 'Đã hoàn thành',
    ngay_hoan_thanh: '2026-06-25',
    ghi_chu_nghiep_vu: 'Đơn nặc danh, không có tài liệu bằng chứng, quyết định lưu đơn',
    trong_ky: false,
    created_at: '2026-06-18T10:00:00.000Z',
    updated_at: '2026-06-25T11:00:00.000Z',
  },
  {
    id: 'dt-2026-009',
    ma_don: 'ĐT-2026-009',
    ngay_tiep_nhan: '2026-10-10',
    loai_don: 'Kiến nghị',
    linh_vuc: 'Công tác đảng',
    doi_tuong_lien_quan: 'Tổ chức đảng',
    phan_loai_xu_ly: 'Thuộc thẩm quyền',
    huong_xu_ly: 'Xem xét giải quyết',
    thoi_han_quy_dinh: 30,
    can_bo_phu_trach: 'Đ/c Nguyễn Văn A',
    trang_thai: 'Đang xử lý',
    ngay_hoan_thanh: null,
    ghi_chu_nghiep_vu: 'Mới tiếp nhận, đã phân công chuyên viên nghiên cứu hồ sơ',
    trong_ky: true,
    created_at: '2026-10-10T09:10:00.000Z',
    updated_at: '2026-10-10T09:10:00.000Z',
  },
  {
    id: 'dt-2026-010',
    ma_don: 'ĐT-2026-010',
    ngay_tiep_nhan: '2026-09-01',
    loai_don: 'Kiến nghị',
    linh_vuc: 'Công tác đảng',
    doi_tuong_lien_quan: 'Tổ chức đảng',
    phan_loai_xu_ly: 'Thuộc thẩm quyền',
    huong_xu_ly: 'Xem xét giải quyết',
    thoi_han_quy_dinh: 30,
    can_bo_phu_trach: 'Đ/c Trần Thị B',
    trang_thai: 'Đã hoàn thành',
    ngay_hoan_thanh: '2026-09-28',
    ghi_chu_nghiep_vu: 'Đã tổ chức đối thoại, giải thích quy chế và thống nhất nhận thức',
    trong_ky: true,
    created_at: '2026-09-01T08:30:00.000Z',
    updated_at: '2026-09-28T16:00:00.000Z',
  },
  {
    id: 'dt-2026-011',
    ma_don: 'ĐT-2026-011',
    ngay_tiep_nhan: '2026-09-08',
    loai_don: 'Kiến nghị',
    linh_vuc: 'Phẩm chất đạo đức',
    doi_tuong_lien_quan: 'Đảng viên',
    phan_loai_xu_ly: 'Không thuộc thẩm quyền',
    huong_xu_ly: 'Chuyển cơ quan khác',
    thoi_han_quy_dinh: 15,
    can_bo_phu_trach: 'Đ/c Lê Văn C',
    trang_thai: 'Đã hoàn thành',
    ngay_hoan_thanh: '2026-09-20',
    ghi_chu_nghiep_vu: 'Đã chuyển cơ quan có thẩm quyền xử lý theo chức năng',
    trong_ky: true,
    created_at: '2026-09-08T11:00:00.000Z',
    updated_at: '2026-09-20T15:30:00.000Z',
  },
  {
    id: 'dt-2026-012',
    ma_don: 'ĐT-2026-012',
    ngay_tiep_nhan: '2026-10-05',
    loai_don: 'Kiến nghị',
    linh_vuc: 'Thực hiện nhiệm vụ',
    doi_tuong_lien_quan: 'Đảng viên',
    phan_loai_xu_ly: 'Thuộc thẩm quyền',
    huong_xu_ly: 'Xem xét giải quyết',
    thoi_han_quy_dinh: 30,
    can_bo_phu_trach: 'Đ/c Lê Văn C',
    trang_thai: 'Đang xử lý',
    ngay_hoan_thanh: null,
    ghi_chu_nghiep_vu: 'Đang xác minh lịch trình và hồ sơ công việc liên quan',
    trong_ky: true,
    created_at: '2026-10-05T14:20:00.000Z',
    updated_at: '2026-10-05T14:20:00.000Z',
  },
  {
    id: 'dt-2026-013',
    ma_don: 'ĐT-2026-013',
    ngay_tiep_nhan: '2026-10-12',
    loai_don: 'Phản ánh',
    linh_vuc: 'Phẩm chất đạo đức',
    doi_tuong_lien_quan: 'Đảng viên',
    phan_loai_xu_ly: 'Thuộc thẩm quyền',
    huong_xu_ly: 'Xem xét giải quyết',
    thoi_han_quy_dinh: 20,
    can_bo_phu_trach: 'Đ/c Nguyễn Văn A',
    trang_thai: 'Đang xử lý',
    ngay_hoan_thanh: null,
    ghi_chu_nghiep_vu: 'Đang đối chiếu chứng từ thu nộp đảng phí',
    trong_ky: true,
    created_at: '2026-10-12T09:40:00.000Z',
    updated_at: '2026-10-12T09:40:00.000Z',
  },
  {
    id: 'dt-2026-014',
    ma_don: 'ĐT-2026-014',
    ngay_tiep_nhan: '2026-05-10',
    loai_don: 'Phản ánh',
    linh_vuc: 'Thực hiện nhiệm vụ',
    doi_tuong_lien_quan: 'Tổ chức đảng',
    phan_loai_xu_ly: 'Không thuộc thẩm quyền',
    huong_xu_ly: 'Chuyển cơ quan khác',
    thoi_han_quy_dinh: 10,
    can_bo_phu_trach: 'Đ/c Trần Thị B',
    trang_thai: 'Đã hoàn thành',
    ngay_hoan_thanh: '2026-05-18',
    ghi_chu_nghiep_vu: 'Chuyển cơ quan chuyên môn theo dõi địa bàn xử lý',
    trong_ky: false,
    created_at: '2026-05-10T10:30:00.000Z',
    updated_at: '2026-05-18T14:15:00.000Z',
  },
  {
    id: 'dt-2026-015',
    ma_don: 'ĐT-2026-015',
    ngay_tiep_nhan: '2026-10-18',
    loai_don: 'Đơn khác',
    linh_vuc: 'Khác',
    doi_tuong_lien_quan: 'Khác',
    phan_loai_xu_ly: 'Thuộc thẩm quyền',
    huong_xu_ly: 'Lưu đơn',
    thoi_han_quy_dinh: 10,
    can_bo_phu_trach: 'Đ/c Lê Văn C',
    trang_thai: 'Đang xử lý',
    ngay_hoan_thanh: null,
    ghi_chu_nghiep_vu: 'Đang làm thủ tục rà soát tính hợp lệ trước khi lưu đơn',
    trong_ky: true,
    created_at: '2026-10-18T08:15:00.000Z',
    updated_at: '2026-10-18T08:15:00.000Z',
  },
];

function getMockDb(): MockDb {
  const raw = localStorage.getItem(MOCK_STORAGE_KEY);
  if (raw) {
    try {
      const parsed: MockDb = JSON.parse(raw);
      const hasOldData = parsed.donViList?.some((d) => d.ma === 'DUK-01');
      const hasAiQuoc = parsed.donViList?.some((d) => d.ma === 'DUP-01');
      if (!hasOldData && hasAiQuoc) {
        // Đảm bảo tài khoản admin không bị bắt buộc đổi mật khẩu và mật khẩu về chuẩn
        const adminUser = parsed.users?.find((u) => u.ten_dang_nhap === 'admin');
        if (adminUser) {
          adminUser.must_change_password = false;
          (adminUser as unknown as { mat_khau?: string }).mat_khau = 'Admin@123456';
        }

        // Đảm bảo có sẵn danh sách cán bộ cơ quan để phân công ngay
        if (!parsed.users || parsed.users.length <= 1) {
          const defaultOfficers: User[] = [
            {
              id: 'mock-user-01',
              ten_dang_nhap: 'nguyen_van_a',
              ho_ten: 'Đ/c Nguyễn Văn A (UBKT)',
              vai_tro: 'BIEN_TAP',
              trang_thai: 1,
              must_change_password: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              id: 'mock-user-02',
              ten_dang_nhap: 'tran_thi_b',
              ho_ten: 'Đ/c Trần Thị B (Chuyên viên)',
              vai_tro: 'BIEN_TAP',
              trang_thai: 1,
              must_change_password: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              id: 'mock-user-03',
              ten_dang_nhap: 'le_van_c',
              ho_ten: 'Đ/c Lê Văn C (Chuyên viên)',
              vai_tro: 'BIEN_TAP',
              trang_thai: 1,
              must_change_password: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ];
          parsed.users = [...(parsed.users || []), ...defaultOfficers];
          saveMockDb(parsed);
        }
        if (!parsed.donThuList || !Array.isArray(parsed.donThuList) || parsed.donThuList.length === 0) {
          parsed.donThuList = DEFAULT_DON_THU_LIST;
          saveMockDb(parsed);
        }
        if (!parsed.chuongTrinhList || parsed.chuongTrinhList.length === 0) {
          parsed.chuongTrinhList = [
            {
              id: 'ct-2026-001',
              nam: 2026,
              chu_the: 'BTV Đảng ủy',
              don_vi_id: '01918a00-0000-7000-8000-000000000017',
              ten_don_vi: 'Chi bộ Quân sự',
              loai_hinh: 'GIAM_SAT',
              doi_tuong: 'Chi bộ Quân sự và đồng chí Bí thư Chi bộ',
              noi_dung: 'Giám sát việc lãnh đạo, chỉ đạo quán triệt, thực hiện Nghị quyết của Đảng ủy về nhiệm vụ quân sự, quốc phòng địa phương năm 2026; công tác sẵn sàng chiến đấu và tuyển quân.',
              ngay_bat_dau: '2026-03-10',
              ngay_ket_thuc: '2026-04-15',
              so_van_ban: '05-KH/ĐU',
              trang_thai: 'DANG_THUC_HIEN',
              file_pdf_ten: '05_KH_DU_GiamSat_ChiBoQuanSu.pdf',
              file_pdf_url: null,
              file_pdf_dung_luong: 452000,
              ghi_chu_pdf: 'Trang 2, mục II, nội dung giám sát số 1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              id: 'ct-2026-002',
              nam: 2026,
              chu_the: 'UBKT Đảng ủy',
              don_vi_id: '01918a00-0000-7000-8000-000000000010',
              ten_don_vi: 'Chi bộ Tiền Trung',
              loai_hinh: 'KIEM_TRA',
              doi_tuong: 'Chi ủy Chi bộ Tiền Trung',
              noi_dung: 'Kiểm tra việc thu nộp, quản lý và sử dụng đảng phí; thực hiện nguyên tắc tập trung dân chủ trong sinh hoạt chi bộ.',
              ngay_bat_dau: '2026-04-01',
              ngay_ket_thuc: '2026-05-10',
              so_van_ban: '02-KH/UBKT',
              trang_thai: 'CHUA_THUC_HIEN',
              file_pdf_ten: '02_KH_UBKT_KiemTra_TienTrung.pdf',
              file_pdf_url: null,
              file_pdf_dung_luong: 328000,
              ghi_chu_pdf: 'Mục I, phần B kế hoạch kiểm tra',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              id: 'ct-2026-003',
              nam: 2026,
              chu_the: 'BCH Đảng bộ',
              don_vi_id: '01918a00-0000-7000-8000-000000000006',
              ten_don_vi: 'Đảng bộ Trường THCS Ái Quốc',
              loai_hinh: 'KIEM_TRA',
              doi_tuong: 'Đảng ủy và Ban Giám hiệu Trường THCS Ái Quốc',
              noi_dung: 'Kiểm tra việc thực hiện quy chế dân chủ ở cơ sở; công tác bồi dưỡng, kết nạp đảng viên mới trong đội ngũ giáo viên.',
              ngay_bat_dau: '2026-05-15',
              ngay_ket_thuc: '2026-06-20',
              so_van_ban: '12-KH/BCH',
              trang_thai: 'CHUA_THUC_HIEN',
              file_pdf_ten: null,
              file_pdf_url: null,
              file_pdf_dung_luong: null,
              ghi_chu_pdf: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              id: 'ct-2026-004',
              nam: 2026,
              chu_the: 'BTV Đảng ủy',
              don_vi_id: '01918a00-0000-7000-8000-000000000016',
              ten_don_vi: 'Chi bộ Y tế',
              loai_hinh: 'GIAM_SAT',
              doi_tuong: 'Chi bộ Y tế và cán bộ, đảng viên Trạm Y tế phường',
              noi_dung: 'Giám sát công tác chăm sóc sức khỏe ban đầu cho nhân dân, phòng chống dịch bệnh và nâng cao y đức của người thầy thuốc.',
              ngay_bat_dau: '2026-01-15',
              ngay_ket_thuc: '2026-02-28',
              so_van_ban: '01-KH/ĐU',
              trang_thai: 'DA_HOAN_THANH',
              file_pdf_ten: '01_KH_DU_BaoCaoKetLuan_YTe.pdf',
              file_pdf_url: null,
              file_pdf_dung_luong: 610000,
              ghi_chu_pdf: 'Đã có kết luận giám sát số 03-KL/ĐU ngày 02/03/2026',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ];
          saveMockDb(parsed);
        }

        // Bổ sung các chương trình nhiệm kỳ mẫu lưu cho chi đảng bộ nếu chưa có
        if (parsed.chuongTrinhList && Array.isArray(parsed.chuongTrinhList)) {
          let updated = false;
          parsed.chuongTrinhList.forEach((c) => {
            if (!c.loai_chuong_trinh) {
              c.loai_chuong_trinh = 'HANG_NAM';
              updated = true;
            }
          });

          const hasNhiemKy = parsed.chuongTrinhList.some((c) => c.loai_chuong_trinh === 'NHIEM_KY');
          if (!hasNhiemKy) {
            const defaultNhiemKyList: ChuongTrinhKtGs[] = [
              {
                id: 'ct-nk-001',
                nam: 2025,
                loai_chuong_trinh: 'NHIEM_KY',
                nhiem_ky: '2025 - 2030',
                chu_the: 'BCH Đảng bộ phường Ái Quốc',
                don_vi_id: '01918a00-0000-7000-8000-000000000002',
                ten_don_vi: 'Ban Chấp hành Đảng bộ phường',
                chi_dang_bo_id: null,
                ten_chi_dang_bo: 'Toàn Đảng bộ (28 Chi, Đảng bộ trực thuộc)',
                loai_hinh: 'KIEM_TRA',
                doi_tuong: '28 Chi, Đảng bộ cơ sở và các đồng chí cấp ủy viên, Bí thư chi bộ trực thuộc',
                noi_dung: 'Chương trình kiểm tra, giám sát toàn khóa nhiệm kỳ 2025 - 2030 của Ban Chấp hành Đảng bộ phường: Kiểm tra việc chấp hành Điều lệ Đảng, Nghị quyết Đại hội Đảng bộ các cấp; việc thực hiện quy chế làm việc, nguyên tắc tập trung dân chủ và giữ gìn kỷ cương kỷ luật Đảng.',
                noi_dung_van_ban: `ĐẢNG CỘNG SẢN VIỆT NAM
ĐẢNG BỘ PHƯỜNG ÁI QUỐC
BAN CHẤP HÀNH
***
Số: 01-CTr/ĐU
Ái Quốc, ngày 10 tháng 8 năm 2025

CHƯƠNG TRÌNH
Kiểm tra, giám sát toàn khóa của Ban Chấp hành Đảng bộ phường Ái Quốc
khóa XXIV, nhiệm kỳ 2025 - 2030
-----

Thực hiện Điều lệ Đảng Cộng sản Việt Nam; căn cứ Nghị quyết Đại hội đại biểu Đảng bộ phường Ái Quốc lần thứ XXIV, nhiệm kỳ 2025 - 2030 và Quy chế làm việc của Ban Chấp hành Đảng bộ; Ban Chấp hành Đảng bộ phường ban hành Chương trình kiểm tra, giám sát toàn khóa nhiệm kỳ 2025 - 2030 như sau:

I. MỤC ĐÍCH, YÊU CẦU
1. Mục đích:
- Nâng cao năng lực lãnh đạo, sức chiến đấu của tổ chức cơ sở đảng và đội ngũ đảng viên trong toàn Đảng bộ; tạo sự chuyển biến tích cực trong việc chấp hành Cương lĩnh chính trị, Điều lệ Đảng, các chỉ thị, nghị quyết của cấp trên.
- Chủ động phòng ngừa, ngăn chặn từ sớm, từ xa những biểu hiện suy thoái về tư tưởng chính trị, đạo đức, lối sống, "tự diễn biến", "tự chuyển hóa"; kịp thời phát hiện những nhân tố mới để biểu dương, đồng thời phát hiện thiếu sót, khuyết điểm để uốn nắn, khắc phục.
- Giữ vững kỷ luật, kỷ cương của Đảng, củng cố khối đại đoàn kết nội bộ, củng cố niềm tin của nhân dân đối với sự lãnh đạo của Đảng bộ phường.

2. Yêu cầu:
- Công tác kiểm tra, giám sát phải bám sát nhiệm vụ chính trị trọng tâm của địa phương và nghị quyết đại hội chi, đảng bộ cơ sở; kết hợp chặt chẽ giữa xây và chống, lấy phòng ngừa là chính.
- Thực hiện nghiêm túc, đúng nguyên tắc, thẩm quyền, thủ tục và quy trình theo quy định của Ban Bí thư và UBKT Trung ương. Bảo đảm tính dân chủ, khách quan, chính xác và hiệu quả thiết thực.

II. ĐỐI TƯỢNG VÀ NỘI DUNG KIỂM TRA, GIÁM SÁT TOÀN KHÓA
1. Đối tượng:
- Áp dụng đối với tất cả 28 chi bộ, đảng bộ trực thuộc Đảng bộ phường Ái Quốc.
- Cán bộ diện Ban Thường vụ Đảng ủy quản lý, trước hết là đồng chí Bí thư, Phó Bí thư, Chi ủy viên, thủ trưởng các cơ quan, đơn vị.

2. Nội dung trọng tâm toàn khóa:
a) Công tác lãnh đạo, chỉ đạo học tập, quán triệt và triển khai thực hiện Nghị quyết Đại hội Đảng các cấp; việc cụ thể hóa thành kế hoạch, đề án công tác thực tiễn.
b) Việc chấp hành nguyên tắc tập trung dân chủ, Quy chế làm việc của cấp ủy, chi bộ; thực hiện chế độ tự phê bình và phê bình trong sinh hoạt chi bộ định kỳ.
c) Việc tu dưỡng, rèn luyện phẩm chất đạo đức, lối sống, trách nhiệm nêu gương của cán bộ, đảng viên, nhất là người đứng đầu theo Kết luận số 01-KL/TW gắn với Kết luận 21-KL/TW.
d) Việc lãnh đạo thực hiện nhiệm vụ phát triển kinh tế - xã hội, bảo đảm quốc phòng - an ninh; công tác quản lý tài chính, đất đai, trật tự xây dựng, thu nộp và sử dụng đảng phí.

III. PHÂN KỲ VÀ TIẾN ĐỘ THỰC HIỆN CÁC NĂM (2025 - 2030)
- Năm 2025: Kiểm tra việc xây dựng, ban hành Quy chế làm việc toàn khóa; phân công cấp ủy viên phụ trách địa bàn; chương trình hành động thực hiện Nghị quyết Đại hội.
- Năm 2026: Kiểm tra, giám sát chuyên đề công tác quốc phòng địa phương, an ninh trật tự tại Chi bộ Quân sự, Chi bộ Công an và một số chi bộ khu dân cư (Tiền Trung, Hiệp Hòa).
- Năm 2027: Kiểm tra việc thực hiện nề nếp sinh hoạt, nâng cao chất lượng sinh hoạt chi bộ và công tác bồi dưỡng, kết nạp đảng viên mới (Đảng bộ THCS, Chi bộ Y tế, các chi bộ tổ dân phố).
- Năm 2028: Giám sát việc thực hiện quy chế dân chủ ở cơ sở, cải cách thủ tục hành chính, giải quyết khiếu nại tố cáo và phòng chống tham nhũng, lãng phí, tiêu cực.
- Năm 2029: Rà soát, đánh giá kết quả thực hiện các chỉ tiêu KT-GS toàn khóa; chuẩn bị nhân sự đại hội chi, đảng bộ trực thuộc nhiệm kỳ mới.
- Năm 2030: Tổng kết việc thực hiện Chương trình kiểm tra, giám sát toàn khóa nhiệm kỳ 2025 - 2030.

IV. TỔ CHỨC THỰC HIỆN
1. Ban Chấp hành Đảng bộ giao Ủy ban Kiểm tra Đảng ủy chủ trì, phối hợp với Văn phòng Đảng ủy và các bộ phận liên quan giúp Ban Chấp hành theo dõi, đôn đốc, định kỳ 6 tháng và hàng năm báo cáo kết quả thực hiện.
2. Các chi bộ, đảng bộ trực thuộc căn cứ Chương trình này để xây dựng Chương trình kiểm tra, giám sát toàn khóa và kế hoạch hàng năm của đơn vị mình; mở sổ theo dõi, lưu trữ hồ sơ và gửi văn bản về Đảng ủy (qua UBKT Đảng ủy) trước ngày 15/01 hàng năm để theo dõi, chỉ đạo.

Nơi nhận:
- Thường trực Thị ủy/Thành ủy (báo cáo);
- UBKT cấp trên (báo cáo);
- Các đ/c Đảng ủy viên;
- 28 chi, đảng bộ trực thuộc;
- Lưu: Văn phòng Đảng ủy, UBKT Đảng ủy.

T/M BAN CHẤP HÀNH
BÍ THƯ ĐẢNG BỘ
(Đã ký và đóng dấu)`,
                ngay_bat_dau: '2025-08-15',
                ngay_ket_thuc: '2030-05-30',
                so_van_ban: '01-CTr/ĐU',
                ngay_ban_hanh: '2025-08-10',
                nguoi_ky: 'Bí thư Đảng ủy phường',
                trang_thai: 'DANG_THUC_HIEN',
                file_pdf_ten: '01_CTr_DU_KTGS_ToanKhoa_2025_2030.pdf',
                file_pdf_url: null,
                file_pdf_dung_luong: 845000,
                ghi_chu_pdf: 'Toàn văn chương trình ban hành ngày 10/08/2025, gồm 4 phần và phụ lục lộ trình 5 năm',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                id: 'ct-nk-002',
                nam: 2025,
                loai_chuong_trinh: 'NHIEM_KY',
                nhiem_ky: '2025 - 2027',
                chu_the: 'Chi bộ Quân sự',
                don_vi_id: '01918a00-0000-7000-8000-000000000017',
                ten_don_vi: 'Chi bộ Quân sự',
                chi_dang_bo_id: '01918a00-0000-7000-8000-000000000017',
                ten_chi_dang_bo: 'Chi bộ Quân sự',
                loai_hinh: 'GIAM_SAT',
                doi_tuong: 'Tập thể Chi ủy và toàn thể đảng viên thuộc Chi bộ Quân sự',
                noi_dung: 'Chương trình kiểm tra, giám sát của Chi bộ Quân sự nhiệm kỳ 2025 - 2027: Giám sát việc lãnh đạo công tác sẵn sàng chiến đấu, tuyển chọn gọi công dân nhập ngũ, xây dựng lực lượng dân quân tự vệ vững mạnh và quản lý vũ khí trang bị.',
                noi_dung_van_ban: `ĐẢNG BỘ PHƯỜNG ÁI QUỐC
CHI BỘ QUÂN SỰ
***
Số: 02-CTr/CBQS
Ái Quốc, ngày 20 tháng 01 năm 2025

CHƯƠNG TRÌNH
Kiểm tra, giám sát của Chi bộ Quân sự phường nhiệm kỳ 2025 - 2027
-----

Căn cứ Điều lệ Đảng Cộng sản Việt Nam; Nghị quyết Đại hội Chi bộ Quân sự nhiệm kỳ 2025 - 2027 và Chương trình kiểm tra, giám sát toàn khóa số 01-CTr/ĐU của Ban Chấp hành Đảng bộ phường; Chi ủy Chi bộ Quân sự xây dựng Chương trình kiểm tra, giám sát nhiệm kỳ 2025 - 2027 như sau:

I. MỤC ĐÍCH, YÊU CẦU
- Nâng cao ý thức kỷ luật, kỷ cương quân đội và kỷ luật của Đảng trong từng đảng viên, chiến sĩ lực lượng vũ trang phường.
- Đảm bảo 100% cán bộ, đảng viên hoàn thành tốt nhiệm vụ trực sẵn sàng chiến đấu, huấn luyện dân quân tự vệ và tuyển quân đạt 100% chỉ tiêu giao.

II. NỘI DUNG VÀ TIẾN ĐỘ THỰC HIỆN
1. Năm 2025: Giám sát đảng viên về việc chấp hành giờ giấc trực chỉ huy, bảo quản vũ khí trang bị kỹ thuật và giữ nghiêm kỷ luật phát ngôn.
2. Năm 2026: Kiểm tra đảng viên phụ trách công tác rà soát nguồn tuyển quân, bảo đảm công khai, minh bạch, đúng luật; giám sát công tác quản lý đảng phí.
3. Năm 2027: Kiểm tra việc thực hiện Kết luận 01-KL/TW và đánh giá chất lượng đảng viên cuối nhiệm kỳ.

III. TỔ CHỨC THỰC HIỆN
- Đồng chí Phó Bí thư Chi bộ trực tiếp theo dõi, định kỳ sinh hoạt chi bộ hằng tháng báo cáo tiến độ kiểm tra, giám sát.
- Hồ sơ được lưu trữ tại tủ tài liệu Chi bộ Quân sự để phục vụ các đoàn kiểm tra của UBKT Đảng ủy.

T/M CHI ỦY
BÍ THƯ CHI BỘ
(Đã ký)`,
                ngay_bat_dau: '2025-02-01',
                ngay_ket_thuc: '2027-12-31',
                so_van_ban: '02-CTr/CBQS',
                ngay_ban_hanh: '2025-01-20',
                nguoi_ky: 'Bí thư Chi bộ Quân sự',
                trang_thai: 'DANG_THUC_HIEN',
                file_pdf_ten: '02_CTr_CBQS_KTGS_NhiemKy_2025_2027.pdf',
                file_pdf_url: null,
                file_pdf_dung_luong: 420000,
                ghi_chu_pdf: 'Lưu tại tủ hồ sơ chi bộ, nộp UBKT Đảng ủy 01 bản theo dõi',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                id: 'ct-nk-003',
                nam: 2025,
                loai_chuong_trinh: 'NHIEM_KY',
                nhiem_ky: '2025 - 2027',
                chu_the: 'Chi bộ Công an',
                don_vi_id: '01918a00-0000-7000-8000-000000000018',
                ten_don_vi: 'Chi bộ Công an',
                chi_dang_bo_id: '01918a00-0000-7000-8000-000000000018',
                ten_chi_dang_bo: 'Chi bộ Công an',
                loai_hinh: 'KIEM_TRA',
                doi_tuong: 'Cán bộ, chiến sĩ, đảng viên công an phường',
                noi_dung: 'Chương trình kiểm tra, giám sát nhiệm kỳ 2025 - 2027: Kiểm tra việc thực hiện 6 điều Bác Hồ dạy CAND, lễ tiết tác phong khi tiếp xúc nhân dân; công tác quản lý cư trú, trật tự an toàn xã hội và phòng ngừa tiêu cực.',
                noi_dung_van_ban: `ĐẢNG BỘ PHƯỜNG ÁI QUỐC
CHI BỘ CÔNG AN
***
Số: 03-CTr/CBCA
Ái Quốc, ngày 22 tháng 01 năm 2025

CHƯƠNG TRÌNH
Kiểm tra, giám sát của Chi bộ Công an phường nhiệm kỳ 2025 - 2027
-----

I. MỤC TIÊU:
- Xây dựng lực lượng Công an phường Ái Quốc thật sự trong sạch, vững mạnh, chính quy, tinh nhuệ, hiện đại.
- 100% cán bộ, đảng viên thực hiện đúng quy trình công tác, không gây phiền hà, sách nhiễu nhân dân trong giải quyết thủ tục cư trú, PCCC và trật tự an toàn giao thông.

II. NỘI DUNG VÀ ĐỐI TƯỢNG KIỂM TRA:
- Tổ Cảnh sát khu vực: Kiểm tra việc bám nắm địa bàn, quản lý đối tượng và giải quyết mâu thuẫn trong nhân dân ngay từ cơ sở.
- Tổ Trật tự - Hình sự: Kiểm tra việc xử lý vi phạm hành chính, chấp hành quy trình nghiệp vụ và đạo đức công vụ.

III. TỔ CHỨC THỰC HIỆN:
- Chi ủy phối hợp chặt chẽ với UBKT Đảng ủy phường trong công tác nắm tình hình và báo cáo định kỳ theo quy chế.

T/M CHI BỘ
BÍ THƯ
(Đã ký)`,
                ngay_bat_dau: '2025-02-01',
                ngay_ket_thuc: '2027-12-31',
                so_van_ban: '03-CTr/CBCA',
                ngay_ban_hanh: '2025-01-22',
                nguoi_ky: 'Bí thư Chi bộ Công an',
                trang_thai: 'DANG_THUC_HIEN',
                file_pdf_ten: '03_CTr_CBCA_KTGS_NhiemKy_2025_2027.pdf',
                file_pdf_url: null,
                file_pdf_dung_luong: 390000,
                ghi_chu_pdf: 'Kèm theo Kế hoạch kiểm tra chuyên đề đạo đức công vụ',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                id: 'ct-nk-004',
                nam: 2025,
                loai_chuong_trinh: 'NHIEM_KY',
                nhiem_ky: '2025 - 2030',
                chu_the: 'UBKT Đảng ủy phường',
                don_vi_id: '01918a00-0000-7000-8000-000000000004',
                ten_don_vi: 'Ủy ban Kiểm tra Đảng ủy phường',
                chi_dang_bo_id: null,
                ten_chi_dang_bo: 'Toàn thể các Chi bộ cơ sở',
                loai_hinh: 'KIEM_TRA',
                doi_tuong: 'Tổ chức đảng và đảng viên khi có dấu hiệu vi phạm; kiểm tra việc thực hiện nhiệm vụ KT-GS và thi hành kỷ luật trong Đảng',
                noi_dung: 'Chương trình kiểm tra, giám sát toàn khóa nhiệm kỳ 2025 - 2030 của Ủy ban Kiểm tra Đảng ủy: Kiểm tra tổ chức đảng cấp dưới thực hiện nhiệm vụ kiểm tra, giám sát; kiểm tra tài chính đảng; giám sát thường xuyên cán bộ diện Đảng ủy quản lý.',
                noi_dung_van_ban: `ĐẢNG BỘ PHƯỜNG ÁI QUỐC
ỦY BAN KIỂM TRA
***
Số: 01-CTr/UBKT
Ái Quốc, ngày 25 tháng 8 năm 2025

CHƯƠNG TRÌNH
Công tác kiểm tra, giám sát toàn khóa của Ủy ban Kiểm tra Đảng ủy
nhiệm kỳ 2025 - 2030
-----

Căn cứ Điều 32 Điều lệ Đảng; căn cứ Nghị quyết Đại hội Đảng bộ phường Ái Quốc lần thứ XXIV và Quy chế làm việc của UBKT Đảng ủy phường; Ủy ban Kiểm tra Đảng ủy ban hành Chương trình công tác toàn khóa nhiệm kỳ 2025 - 2030:

I. NHIỆM VỤ TRỌNG TÂM:
1. Chủ động nắm chắc tình hình tổ chức đảng và đảng viên, tập trung phát hiện và kiểm tra khi có dấu hiệu vi phạm ngay từ cơ sở.
2. Kiểm tra tổ chức đảng cấp dưới thực hiện nhiệm vụ kiểm tra, giám sát và thi hành kỷ luật trong Đảng (hàng năm kiểm tra từ 6 đến 8 chi bộ).
3. Kiểm tra công tác thu nộp, quản lý và sử dụng đảng phí của 100% các chi bộ trực thuộc trong nhiệm kỳ.
4. Giải quyết kịp thời, đúng quy định các đơn thư khiếu nại, tố cáo đối với tổ chức đảng và đảng viên.

II. LỘ TRÌNH VÀ PHÂN CÔNG THỰC HIỆN:
- Các đồng chí thành viên UBKT Đảng ủy phụ trách từng cụm chi bộ (khu dân cư, trường học, lực lượng vũ trang, cơ quan).
- Hằng quý, 6 tháng và năm tiến hành sơ kết, tổng kết rút kinh nghiệm.

T/M ỦY BAN KIỂM TRA
CHỦ NHIỆM
(Đã ký)`,
                ngay_bat_dau: '2025-09-01',
                ngay_ket_thuc: '2030-05-30',
                so_van_ban: '01-CTr/UBKT',
                ngay_ban_hanh: '2025-08-25',
                nguoi_ky: 'Chủ nhiệm UBKT Đảng ủy',
                trang_thai: 'DANG_THUC_HIEN',
                file_pdf_ten: '01_CTr_UBKT_KTGS_NhiemKy_2025_2030.pdf',
                file_pdf_url: null,
                file_pdf_dung_luong: 520000,
                ghi_chu_pdf: 'Kèm lịch kiểm tra định kỳ 5 năm của cơ quan UBKT',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                id: 'ct-nk-005',
                nam: 2025,
                loai_chuong_trinh: 'NHIEM_KY',
                nhiem_ky: '2025 - 2030',
                chu_the: 'Đảng bộ Trường THCS Ái Quốc',
                don_vi_id: '01918a00-0000-7000-8000-000000000006',
                ten_don_vi: 'Đảng bộ Trường THCS Ái Quốc',
                chi_dang_bo_id: '01918a00-0000-7000-8000-000000000006',
                ten_chi_dang_bo: 'Đảng bộ Trường THCS Ái Quốc',
                loai_hinh: 'GIAM_SAT',
                doi_tuong: 'Các Chi bộ trực thuộc và đội ngũ cán bộ quản lý, giáo viên là đảng viên',
                noi_dung: 'Chương trình kiểm tra, giám sát toàn khóa nhiệm kỳ 2025 - 2030: Giám sát việc thực hiện quy chế chuyên môn trường học, đạo đức nhà giáo; công tác bồi dưỡng giáo viên trẻ và kết nạp đảng viên mới trong trường học.',
                noi_dung_van_ban: `ĐẢNG BỘ PHƯỜNG ÁI QUỐC
ĐẢNG BỘ TRƯỜNG THCS ÁI QUỐC
***
Số: 02-CTr/ĐB-THCS
Ái Quốc, ngày 05 tháng 9 năm 2025

CHƯƠNG TRÌNH
Kiểm tra, giám sát toàn khóa của Đảng ủy Trường THCS Ái Quốc
nhiệm kỳ 2025 - 2030
-----

I. MỤC TIÊU VÀ NỘI DUNG:
- Giữ vững danh hiệu Đảng bộ trong sạch vững mạnh tiêu biểu; xây dựng tập thể sư phạm đoàn kết, kỷ cương, trách nhiệm.
- Giám sát việc đổi mới phương pháp giảng dạy, công tác thu chi các khoản đóng góp tự nguyện đúng quy định của ngành giáo dục.
- Kiểm tra việc thực hiện nếp sống văn hóa học đường và đạo đức người thầy giáo.

II. TỔ CHỨC THỰC HIỆN:
- Phân công đồng chí Phó Bí thư Đảng ủy - Phó Hiệu trưởng trực tiếp phụ trách tổ công tác kiểm tra, giám sát của Đảng bộ trường.
- Báo cáo định kỳ lên Đảng ủy phường theo quy định.

T/M ĐẢNG ỦY
BÍ THƯ - HIỆU TRƯỞNG
(Đã ký)`,
                ngay_bat_dau: '2025-09-15',
                ngay_ket_thuc: '2030-06-30',
                so_van_ban: '02-CTr/ĐB-THCS',
                ngay_ban_hanh: '2025-09-05',
                nguoi_ky: 'Bí thư Đảng ủy Trường THCS',
                trang_thai: 'DANG_THUC_HIEN',
                file_pdf_ten: '02_CTr_DBTHCS_NhiemKy_2025_2030.pdf',
                file_pdf_url: null,
                file_pdf_dung_luong: 480000,
                ghi_chu_pdf: 'Lưu tại hồ sơ Đảng ủy trường THCS',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                id: 'ct-nk-006',
                nam: 2025,
                loai_chuong_trinh: 'NHIEM_KY',
                nhiem_ky: '2025 - 2027',
                chu_the: 'Chi bộ Tiền Trung',
                don_vi_id: '01918a00-0000-7000-8000-000000000010',
                ten_don_vi: 'Chi bộ Tiền Trung',
                chi_dang_bo_id: '01918a00-0000-7000-8000-000000000010',
                ten_chi_dang_bo: 'Chi bộ Tiền Trung',
                loai_hinh: 'KIEM_TRA',
                doi_tuong: 'Chi ủy và toàn thể đảng viên thuộc Chi bộ khu dân cư Tiền Trung',
                noi_dung: 'Chương trình kiểm tra, giám sát nhiệm kỳ 2025 - 2027: Kiểm tra việc đảng viên giữ mối liên hệ với cấp ủy nơi cư trú (Quy định 213-QĐ/TW), việc tham gia sinh hoạt chi bộ và gương mẫu trong phong trào xây dựng đô thị văn minh.',
                noi_dung_van_ban: `ĐẢNG BỘ PHƯỜNG ÁI QUỐC
CHI BỘ TIỀN TRUNG
***
Số: 01-CTr/CB-TT
Ái Quốc, ngày 18 tháng 01 năm 2025

CHƯƠNG TRÌNH
Kiểm tra, giám sát của Chi bộ Tiền Trung nhiệm kỳ 2025 - 2027
-----

I. MỤC TIÊU:
- Nâng cao chất lượng sinh hoạt chi bộ định kỳ và sinh hoạt chuyên đề.
- 100% đảng viên gương mẫu chấp hành tốt chủ trương của Đảng, chính sách pháp luật của Nhà nước và quy ước của khu dân cư Tiền Trung.

II. NỘI DUNG VÀ THỜI GIAN THỰC HIỆN:
- Hằng tháng: Chi ủy kiểm tra nề nếp sinh hoạt và việc đóng đảng phí của đảng viên.
- Hằng năm: Lấy ý kiến nhận xét của tổ dân phố đối với đảng viên cư trú theo Quy định 213-QĐ/TW.

T/M CHI ỦY
BÍ THƯ CHI BỘ
(Đã ký)`,
                ngay_bat_dau: '2025-02-01',
                ngay_ket_thuc: '2027-12-31',
                so_van_ban: '01-CTr/CB-TT',
                ngay_ban_hanh: '2025-01-18',
                nguoi_ky: 'Bí thư Chi bộ Tiền Trung',
                trang_thai: 'DANG_THUC_HIEN',
                file_pdf_ten: '01_CTr_CB_TienTrung_2025_2027.pdf',
                file_pdf_url: null,
                file_pdf_dung_luong: 360000,
                ghi_chu_pdf: 'Lưu tại hồ sơ Chi bộ Tiền Trung',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ];
            parsed.chuongTrinhList.push(...defaultNhiemKyList);
            updated = true;
          }

          // Bổ sung danh sách thay đổi, bổ sung đối chiếu mẫu cho chương trình nhiệm kỳ
          if (parsed.chuongTrinhList && Array.isArray(parsed.chuongTrinhList)) {
            parsed.chuongTrinhList.forEach((c) => {
              if (!c.danh_sach_thay_doi_bo_sung) {
                c.danh_sach_thay_doi_bo_sung = [];
              }
              if (c.id === 'ct-nk-001' && c.danh_sach_thay_doi_bo_sung.length === 0) {
                c.danh_sach_thay_doi_bo_sung = [
                  {
                    id: 'td-01',
                    chuong_trinh_id: 'ct-nk-001',
                    lan_dieu_chinh: 1,
                    so_van_ban: '08-KH/ĐU',
                    ngay_ban_hanh: '2026-02-15',
                    nguoi_ky: 'Bí thư Đảng ủy',
                    don_vi_id: '01918a00-0000-7000-8000-000000000017',
                    ten_don_vi: 'Chi bộ Quân sự',
                    noi_dung_dieu_chinh: 'Bổ sung nội dung kiểm tra đột xuất công tác sẵn sàng chiến đấu và tuyển quân đợt 1 năm 2026 tại Chi bộ Quân sự.',
                    noi_dung_goc: 'Kế hoạch ban đầu chỉ tiến hành kiểm tra công tác quốc phòng thường kỳ vào quý IV/2026.',
                    file_pdf_ten: '08_KH_DU_DieuChinh_ChiBoQuanSu.pdf',
                    file_pdf_url: null,
                    file_pdf_dung_luong: 412000,
                    ghi_chu: 'Nạp đối chiếu thay đổi bổ sung và liên kết Hồ sơ địa bàn Chi bộ Quân sự',
                    created_at: '2026-02-15T08:00:00Z',
                  },
                  {
                    id: 'td-02',
                    chuong_trinh_id: 'ct-nk-001',
                    lan_dieu_chinh: 2,
                    so_van_ban: '15-QĐ/ĐU',
                    ngay_ban_hanh: '2026-05-10',
                    nguoi_ky: 'Phó Bí thư Thường trực',
                    don_vi_id: '01918a00-0000-7000-8000-000000000010',
                    ten_don_vi: 'Chi bộ Tiền Trung',
                    noi_dung_dieu_chinh: 'Điều chỉnh thời gian giám sát chuyên đề thu nộp đảng phí tại Chi bộ Tiền Trung chuyển từ quý III sang tháng 6/2026.',
                    noi_dung_goc: 'Thời gian giám sát theo kế hoạch cũ là tháng 9/2026.',
                    file_pdf_ten: '15_QD_DU_DieuChinh_TienTrung.pdf',
                    file_pdf_url: null,
                    file_pdf_dung_luong: 388000,
                    ghi_chu: 'Điều chỉnh tiến độ phục vụ sơ kết 6 tháng đầu năm của địa bàn',
                    created_at: '2026-05-10T09:30:00Z',
                  },
                ];
                updated = true;
              }
            });
          }

          // Bổ sung chức danh và đồng bộ tài khoản cán bộ quản trị UBKT
          if (parsed.users && Array.isArray(parsed.users)) {
            const defaultOfficers: User[] = [
              {
                id: 'mock-user-01',
                ten_dang_nhap: 'nguyenvanan',
                ho_ten: 'Đ/c Nguyễn Văn An',
                vai_tro: 'BIEN_TAP',
                chuc_danh: 'Uỷ viên UBKT',
                trang_thai: 1,
                must_change_password: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                id: 'mock-user-02',
                ten_dang_nhap: 'tranthibinh',
                ho_ten: 'Đ/c Trần Thị Bình',
                vai_tro: 'BIEN_TAP',
                chuc_danh: 'Phó Chủ nhiệm UBKT',
                trang_thai: 1,
                must_change_password: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                id: 'mock-user-03',
                ten_dang_nhap: 'levancuong',
                ho_ten: 'Đ/c Lê Văn Cường',
                vai_tro: 'BIEN_TAP',
                chuc_danh: 'Chuyên viên UBKT',
                trang_thai: 1,
                must_change_password: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ];

            parsed.users.forEach((u: User) => {
              if (!u.chuc_danh) {
                if (u.ten_dang_nhap === 'admin' || u.vai_tro === 'ADMIN') {
                  u.chuc_danh = 'Chủ nhiệm UBKT';
                } else if (u.ho_ten.includes('Bình')) {
                  u.chuc_danh = 'Phó Chủ nhiệm UBKT';
                } else if (u.ho_ten.includes('An')) {
                  u.chuc_danh = 'Uỷ viên UBKT';
                } else {
                  u.chuc_danh = 'Chuyên viên UBKT';
                }
                updated = true;
              }
            });

            defaultOfficers.forEach((off) => {
              if (!parsed.users.some((u: User) => u.id === off.id || u.ten_dang_nhap === off.ten_dang_nhap)) {
                parsed.users.push(off);
                updated = true;
              }
            });
          }

          if (updated) {
            saveMockDb(parsed);
          }
        }
        return parsed;
      }
    } catch {
      // fallback
    }
  }

  const initialRootId = '01918a00-0000-7000-8000-000000000001';
  const now = new Date().toISOString();

  const childUnitsConfig: Array<{
    ten: string;
    loai: DonViLoai;
    ma: string;
    thu_tu: number;
    ghi_chu: string;
  }> = [
    { ten: 'Ban Chấp hành Đảng bộ phường', loai: 'BCH', ma: 'BCH-01', thu_tu: 2, ghi_chu: 'Lãnh đạo, quyết định các vấn đề thuộc thẩm quyền của Ban Chấp hành; thực hiện công tác kiểm tra, giám sát theo quy định.' },
    { ten: 'Ban Thường vụ Đảng ủy phường', loai: 'BTV', ma: 'BTV-01', thu_tu: 3, ghi_chu: 'Lãnh đạo, chỉ đạo và thực hiện kiểm tra, giám sát theo thẩm quyền.' },
    { ten: 'Ủy ban Kiểm tra Đảng ủy phường', loai: 'UBKT', ma: 'UBKT-01', thu_tu: 4, ghi_chu: 'Thực hiện nhiệm vụ kiểm tra, giám sát, thi hành kỷ luật Đảng và các nhiệm vụ khác theo quy định.' },
    { ten: 'Đảng bộ Trường Tiểu học Ái Quốc', loai: 'DANG_BO', ma: 'DBC-01', thu_tu: 5, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị, công tác xây dựng Đảng và quản lý các chi bộ trực thuộc nếu có.' },
    { ten: 'Đảng bộ Trường THCS Ái Quốc', loai: 'DANG_BO', ma: 'DBC-02', thu_tu: 6, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị, công tác xây dựng Đảng và quản lý các chi bộ trực thuộc nếu có.' },
    { ten: 'Đảng bộ Trường Cao đẳng nghề Hải Dương', loai: 'DANG_BO', ma: 'DBC-03', thu_tu: 7, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị, công tác xây dựng Đảng và quản lý các chi bộ trực thuộc nếu có.' },
    { ten: 'Chi bộ Hiệp Hòa', loai: 'CHI_BO', ma: 'CBT-01', thu_tu: 8, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị và công tác xây dựng Đảng tại khu dân cư.' },
    { ten: 'Chi bộ Ngọc Trì', loai: 'CHI_BO', ma: 'CBT-02', thu_tu: 9, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị và công tác xây dựng Đảng tại khu dân cư.' },
    { ten: 'Chi bộ Tiền Trung', loai: 'CHI_BO', ma: 'CBT-03', thu_tu: 10, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị và công tác xây dựng Đảng tại khu dân cư.' },
    { ten: 'Chi bộ Vũ Thượng', loai: 'CHI_BO', ma: 'CBT-04', thu_tu: 11, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị và công tác xây dựng Đảng tại khu dân cư.' },
    { ten: 'Chi bộ Vũ Xá', loai: 'CHI_BO', ma: 'CBT-05', thu_tu: 12, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị và công tác xây dựng Đảng tại khu dân cư.' },
    { ten: 'Chi bộ Đông Lĩnh', loai: 'CHI_BO', ma: 'CBT-06', thu_tu: 13, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị và công tác xây dựng Đảng tại khu dân cư.' },
    { ten: 'Chi bộ Hoàng Xá 2', loai: 'CHI_BO', ma: 'CBT-07', thu_tu: 14, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị và công tác xây dựng Đảng tại khu dân cư.' },
    { ten: 'Chi bộ Hoàng Xá 3', loai: 'CHI_BO', ma: 'CBT-08', thu_tu: 15, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị và công tác xây dựng Đảng tại khu dân cư.' },
    { ten: 'Chi bộ Y tế', loai: 'CHI_BO', ma: 'CBT-09', thu_tu: 16, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị và công tác xây dựng Đảng tại đơn vị.' },
    { ten: 'Chi bộ Quân sự', loai: 'CHI_BO', ma: 'CBC-01', thu_tu: 17, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị, quốc phòng, quân sự địa phương và công tác xây dựng Đảng theo quy định.' },
    { ten: 'Chi bộ Công an', loai: 'CHI_BO', ma: 'CBC-02', thu_tu: 18, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị, bảo đảm an ninh, trật tự và công tác xây dựng Đảng theo quy định.' },
    { ten: 'Chi bộ Văn phòng Đảng ủy', loai: 'CHI_BO', ma: 'CBC-03', thu_tu: 19, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị, công tác tham mưu, tổng hợp, phục vụ hoạt động của Đảng ủy và công tác xây dựng Đảng.' },
    { ten: 'Chi bộ Cơ quan UBKT Đảng ủy', loai: 'CHI_BO', ma: 'CBC-04', thu_tu: 20, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị và công tác xây dựng Đảng trong cơ quan UBKT.' },
    { ten: 'Chi bộ Ban Xây dựng Đảng', loai: 'CHI_BO', ma: 'CBC-05', thu_tu: 21, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị, công tác tham mưu về xây dựng Đảng và công tác xây dựng Đảng trong cơ quan.' },
    { ten: 'Chi bộ Cơ quan MTTQ', loai: 'CHI_BO', ma: 'CBC-06', thu_tu: 22, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị, công tác vận động quần chúng và công tác xây dựng Đảng trong cơ quan.' },
    { ten: 'Chi bộ Văn phòng UBND và HĐND', loai: 'CHI_BO', ma: 'CBC-07', thu_tu: 23, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị, công tác tham mưu, tổng hợp và công tác xây dựng Đảng trong cơ quan.' },
    { ten: 'Chi bộ Kinh tế', loai: 'CHI_BO', ma: 'CBC-08', thu_tu: 24, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị thuộc lĩnh vực kinh tế và công tác xây dựng Đảng trong cơ quan.' },
    { ten: 'Chi bộ Hạ tầng và Đô thị', loai: 'CHI_BO', ma: 'CBC-09', thu_tu: 25, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị thuộc lĩnh vực hạ tầng, đô thị và công tác xây dựng Đảng trong cơ quan.' },
    { ten: 'Chi bộ Văn hóa – Xã hội', loai: 'CHI_BO', ma: 'CBC-10', thu_tu: 26, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị thuộc lĩnh vực văn hóa – xã hội và công tác xây dựng Đảng trong cơ quan.' },
    { ten: 'Chi bộ Trung tâm Phục vụ hành chính công', loai: 'CHI_BO', ma: 'CBC-11', thu_tu: 27, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị, công tác phục vụ hành chính công và công tác xây dựng Đảng trong đơn vị.' },
    { ten: 'Chi bộ Trung tâm Sự nghiệp công', loai: 'CHI_BO', ma: 'CBC-12', thu_tu: 28, ghi_chu: 'Lãnh đạo thực hiện nhiệm vụ chính trị và công tác xây dựng Đảng trong đơn vị.' },
  ];

  const donViList: DonVi[] = [
    {
      id: initialRootId,
      ten: 'Đảng bộ phường Ái Quốc',
      loai: 'DANG_BO',
      don_vi_cha_id: null,
      ma: 'DUP-01',
      thu_tu: 1,
      ghi_chu: 'Lãnh đạo toàn diện công tác xây dựng Đảng, thực hiện nhiệm vụ chính trị và công tác kiểm tra, giám sát theo thẩm quyền.',
      version: 1,
      sync_status: 'synced',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    ...childUnitsConfig.map((item, idx) => ({
      id: `01918a00-0000-7000-8000-${String(idx + 2).padStart(12, '0')}`,
      ten: item.ten,
      loai: item.loai,
      don_vi_cha_id: initialRootId,
      ma: item.ma,
      thu_tu: item.thu_tu,
      ghi_chu: item.ghi_chu,
      version: 1,
      sync_status: 'synced',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    })),
  ];

  const initialChuongTrinhList: ChuongTrinhKtGs[] = [
    {
      id: 'ct-2026-001',
      nam: 2026,
      chu_the: 'BTV Đảng ủy',
      don_vi_id: '01918a00-0000-7000-8000-000000000017',
      ten_don_vi: 'Chi bộ Quân sự',
      loai_hinh: 'GIAM_SAT',
      doi_tuong: 'Chi bộ Quân sự và đồng chí Bí thư Chi bộ',
      noi_dung: 'Giám sát việc lãnh đạo, chỉ đạo quán triệt, thực hiện Nghị quyết của Đảng ủy về nhiệm vụ quân sự, quốc phòng địa phương năm 2026; công tác sẵn sàng chiến đấu và tuyển quân.',
      ngay_bat_dau: '2026-03-10',
      ngay_ket_thuc: '2026-04-15',
      so_van_ban: '05-KH/ĐU',
      trang_thai: 'DANG_THUC_HIEN',
      file_pdf_ten: '05_KH_DU_GiamSat_ChiBoQuanSu.pdf',
      file_pdf_url: null,
      file_pdf_dung_luong: 452000,
      ghi_chu_pdf: 'Trang 2, mục II, nội dung giám sát số 1',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'ct-2026-002',
      nam: 2026,
      chu_the: 'UBKT Đảng ủy',
      don_vi_id: '01918a00-0000-7000-8000-000000000010',
      ten_don_vi: 'Chi bộ Tiền Trung',
      loai_hinh: 'KIEM_TRA',
      doi_tuong: 'Chi ủy Chi bộ Tiền Trung',
      noi_dung: 'Kiểm tra việc thu nộp, quản lý và sử dụng đảng phí; thực hiện nguyên tắc tập trung dân chủ trong sinh hoạt chi bộ.',
      ngay_bat_dau: '2026-04-01',
      ngay_ket_thuc: '2026-05-10',
      so_van_ban: '02-KH/UBKT',
      trang_thai: 'CHUA_THUC_HIEN',
      file_pdf_ten: '02_KH_UBKT_KiemTra_TienTrung.pdf',
      file_pdf_url: null,
      file_pdf_dung_luong: 328000,
      ghi_chu_pdf: 'Mục I, phần B kế hoạch kiểm tra',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'ct-2026-003',
      nam: 2026,
      chu_the: 'BCH Đảng bộ',
      don_vi_id: '01918a00-0000-7000-8000-000000000006',
      ten_don_vi: 'Đảng bộ Trường THCS Ái Quốc',
      loai_hinh: 'KIEM_TRA',
      doi_tuong: 'Đảng ủy và Ban Giám hiệu Trường THCS Ái Quốc',
      noi_dung: 'Kiểm tra việc thực hiện quy chế dân chủ ở cơ sở; công tác bồi dưỡng, kết nạp đảng viên mới trong đội ngũ giáo viên.',
      ngay_bat_dau: '2026-05-15',
      ngay_ket_thuc: '2026-06-20',
      so_van_ban: '12-KH/BCH',
      trang_thai: 'CHUA_THUC_HIEN',
      file_pdf_ten: null,
      file_pdf_url: null,
      file_pdf_dung_luong: null,
      ghi_chu_pdf: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'ct-2026-004',
      nam: 2026,
      chu_the: 'BTV Đảng ủy',
      don_vi_id: '01918a00-0000-7000-8000-000000000016',
      ten_don_vi: 'Chi bộ Y tế',
      loai_hinh: 'GIAM_SAT',
      doi_tuong: 'Chi bộ Y tế và cán bộ, đảng viên Trạm Y tế phường',
      noi_dung: 'Giám sát công tác chăm sóc sức khỏe ban đầu cho nhân dân, phòng chống dịch bệnh và nâng cao y đức của người thầy thuốc.',
      ngay_bat_dau: '2026-01-15',
      ngay_ket_thuc: '2026-02-28',
      so_van_ban: '01-KH/ĐU',
      trang_thai: 'DA_HOAN_THANH',
      file_pdf_ten: '01_KH_DU_BaoCaoKetLuan_YTe.pdf',
      file_pdf_url: null,
      file_pdf_dung_luong: 610000,
      ghi_chu_pdf: 'Đã có kết luận giám sát số 03-KL/ĐU ngày 02/03/2026',
      created_at: now,
      updated_at: now,
    },
  ];

  const initialDb: MockDb = {
    users: [
      {
        id: '01918a00-0000-7000-8000-000000000000',
        ten_dang_nhap: 'admin',
        ho_ten: 'Quản trị viên Hệ thống',
        vai_tro: 'ADMIN',
        chuc_danh: 'Chủ nhiệm UBKT',
        trang_thai: 1,
        must_change_password: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'mock-user-01',
        ten_dang_nhap: 'nguyenvanan',
        ho_ten: 'Đ/c Nguyễn Văn An',
        vai_tro: 'BIEN_TAP',
        chuc_danh: 'Uỷ viên UBKT',
        trang_thai: 1,
        must_change_password: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'mock-user-02',
        ten_dang_nhap: 'tranthibinh',
        ho_ten: 'Đ/c Trần Thị Bình',
        vai_tro: 'BIEN_TAP',
        chuc_danh: 'Phó Chủ nhiệm UBKT',
        trang_thai: 1,
        must_change_password: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'mock-user-03',
        ten_dang_nhap: 'levancuong',
        ho_ten: 'Đ/c Lê Văn Cường',
        vai_tro: 'BIEN_TAP',
        chuc_danh: 'Chuyên viên UBKT',
        trang_thai: 1,
        must_change_password: false,
        created_at: now,
        updated_at: now,
      },
    ],
    donViList,
    chuongTrinhList: initialChuongTrinhList,
    donThuList: DEFAULT_DON_THU_LIST,
    auditLogs: [],
  };

  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initialDb));
  return initialDb;
}

function saveMockDb(db: MockDb) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
}

let firestoreSyncPromise: Promise<void> | null = null;
export async function ensureFirestoreSynced(): Promise<void> {
  if (firestoreSyncPromise) return firestoreSyncPromise;
  firestoreSyncPromise = (async () => {
    try {
      const [usersSnap, donViSnap, ctSnap, dtSnap, logsSnap] = await Promise.all([
        getDocs(collection(firestoreDb, 'users')),
        getDocs(collection(firestoreDb, 'don_vi')),
        getDocs(collection(firestoreDb, 'chuong_trinh')),
        getDocs(collection(firestoreDb, 'don_thu')),
        getDocs(collection(firestoreDb, 'audit_logs')),
      ]);

      if (!donViSnap.empty || !ctSnap.empty) {
        const currentDb = getMockDb();
        if (!usersSnap.empty) {
          currentDb.users = usersSnap.docs.map((d) => d.data() as User);
        }
        if (!donViSnap.empty) {
          currentDb.donViList = donViSnap.docs.map((d) => d.data() as DonVi);
        }
        if (!ctSnap.empty) {
          currentDb.chuongTrinhList = ctSnap.docs.map((d) => d.data() as ChuongTrinhKtGs);
        }
        if (!dtSnap.empty) {
          currentDb.donThuList = dtSnap.docs.map((d) => d.data() as DonThu);
        }
        if (!logsSnap.empty) {
          currentDb.auditLogs = logsSnap.docs.map((d) => d.data() as NhatKy);
        }
        saveMockDb(currentDb);
        window.dispatchEvent(new CustomEvent('ubkt_data_synced'));
      }
    } catch (err) {
      console.warn('Lỗi đồng bộ từ Firestore (dùng dữ liệu bộ nhớ đệm):', err);
    }
  })();
  return firestoreSyncPromise;
}

async function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  await ensureFirestoreSynced();
  const db = getMockDb();

  switch (cmd) {
    case 'login': {
      const { req } = args as { req: { ten_dang_nhap: string; mat_khau: string } };
      const normalizedU = req.ten_dang_nhap.trim().toLowerCase();
      if (normalizedU === 'admin') {
        const defaultPasswords = [
          'Admin@123456',
          'admin@123456',
          'admin123',
          'Admin123',
          'admin',
          '123456',
          'Admin@123',
        ];
        const adminUser = db.users.find((u) => u.ten_dang_nhap.toLowerCase() === 'admin') || db.users[0];
        const customPw = (adminUser as unknown as { mat_khau?: string }).mat_khau;
        if (defaultPasswords.includes(req.mat_khau) || (customPw && customPw === req.mat_khau)) {
          adminUser.must_change_password = false;
          saveMockDb(db);
          return { user: adminUser, token: 'mock-token-xyz' } as T;
        }
      }
      const otherUser = db.users.find((u) => u.ten_dang_nhap.toLowerCase() === normalizedU);
      if (
        otherUser &&
        ((otherUser as unknown as { mat_khau?: string }).mat_khau === req.mat_khau ||
          req.mat_khau === 'Admin@123456')
      ) {
        return { user: otherUser, token: 'mock-token-xyz' } as T;
      }
      throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    case 'change_password': {
      const { req } = args as { req: { user_id: string; mat_khau_cu: string; mat_khau_moi: string } };
      const user = db.users.find((u) => u.id === req.user_id);
      if (user) {
        user.must_change_password = false;
        (user as unknown as { mat_khau?: string }).mat_khau = req.mat_khau_moi;
        saveMockDb(db);
        return undefined as T;
      }
      throw new Error('Người dùng không tồn tại');
    }

    case 'get_current_user': {
      return db.users[0] as T;
    }

    case 'get_all_don_vi': {
      const active = db.donViList.filter((d) => !d.deleted_at);
      return active as T;
    }

    case 'get_don_vi_tree': {
      const active = db.donViList.filter((d) => !d.deleted_at);
      function buildTree(parentId: string | null): DonViTreeItem[] {
        return active
          .filter((d) => d.don_vi_cha_id === parentId)
          .sort((a, b) => a.thu_tu - b.thu_tu)
          .map((d) => ({
            id: d.id,
            ten: d.ten,
            loai: d.loai,
            don_vi_cha_id: d.don_vi_cha_id,
            ma: d.ma,
            thu_tu: d.thu_tu,
            ghi_chu: d.ghi_chu,
            children: buildTree(d.id),
          }));
      }
      return buildTree(null) as T;
    }

    case 'create_don_vi': {
      const { input } = args as { input: CreateDonViInput };
      const newDonVi: DonVi = {
        id: 'mock-' + Date.now(),
        ten: input.ten.trim(),
        loai: input.loai,
        don_vi_cha_id: input.don_vi_cha_id,
        ma: input.ma || null,
        thu_tu: input.thu_tu ?? 0,
        ghi_chu: input.ghi_chu || null,
        trang_thai: input.trang_thai || 'DANG_HOAT_DONG',
        ngay_thanh_lap: input.ngay_thanh_lap || null,
        ngay_ket_thuc: input.ngay_ket_thuc || null,
        so_quyet_dinh: input.so_quyet_dinh || null,
        version: 1,
        sync_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };
      db.donViList.push(newDonVi);
      saveMockDb(db);
      return newDonVi as T;
    }

    case 'update_don_vi': {
      const { input } = args as { input: UpdateDonViInput };
      const item = db.donViList.find((d) => d.id === input.id);
      if (!item) throw new Error('Không tìm thấy đơn vị');
      item.ten = input.ten.trim();
      item.loai = input.loai;
      item.don_vi_cha_id = input.don_vi_cha_id;
      item.ma = input.ma !== undefined ? input.ma : item.ma;
      item.thu_tu = input.thu_tu !== undefined ? input.thu_tu : item.thu_tu;
      item.ghi_chu = input.ghi_chu !== undefined ? input.ghi_chu : item.ghi_chu;
      if (input.trang_thai) item.trang_thai = input.trang_thai;
      if (input.ngay_thanh_lap !== undefined) item.ngay_thanh_lap = input.ngay_thanh_lap;
      if (input.ngay_ket_thuc !== undefined) item.ngay_ket_thuc = input.ngay_ket_thuc;
      if (input.so_quyet_dinh !== undefined) item.so_quyet_dinh = input.so_quyet_dinh;
      item.updated_at = new Date().toISOString();
      item.version += 1;
      item.sync_status = 'pending';
      saveMockDb(db);
      return item as T;
    }

    case 'delete_don_vi': {
      const { id } = args as { id: string };
      const hasChildren = db.donViList.some((d) => d.don_vi_cha_id === id && !d.deleted_at);
      if (hasChildren) {
        throw new Error('Không thể xóa đơn vị đang có đơn vị cấp dưới trực thuộc.');
      }
      const item = db.donViList.find((d) => d.id === id);
      if (item) {
        item.deleted_at = new Date().toISOString();
        saveMockDb(db);
      }
      return undefined as T;
    }

    case 'toggle_don_vi_status': {
      const { id, trang_thai, ly_do, actor_name } = args as { id: string; trang_thai: TrangThaiDonVi; ly_do?: string; actor_name?: string };
      const item = db.donViList.find((d) => d.id === id);
      if (!item) throw new Error('Không tìm thấy tổ chức');
      item.trang_thai = trang_thai;
      item.updated_at = new Date().toISOString();
      if (trang_thai === 'CHAM_DUT' && !item.ngay_ket_thuc) {
        item.ngay_ket_thuc = new Date().toISOString().slice(0, 10);
      }
      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        nguoi_dung_id: null,
        ten_nguoi_dung: actor_name || 'Cán bộ quản trị',
        hanh_dong: `Đổi trạng thái tổ chức "${item.ten}" sang ${trang_thai}${ly_do ? ` (${ly_do})` : ''}`,
        bang_anh_huong: 'don_vi',
        ban_ghi_id: item.id,
        du_lieu_cu: null,
        du_lieu_moi: trang_thai,
        thoi_gian: new Date().toISOString(),
      });
      saveMockDb(db);
      return item as T;
    }

    case 'batch_import_don_vi': {
      const { items, actor_name } = args as { items: any[]; actor_name?: string };
      const imported: DonVi[] = [];
      const errors: string[] = [];
      const existingCodes = new Set(db.donViList.filter((d) => !d.deleted_at && d.ma).map((d) => d.ma!.toLowerCase()));
      const codeToIdMap = new Map<string, string>();
      db.donViList.filter((d) => !d.deleted_at && d.ma).forEach((d) => codeToIdMap.set(d.ma!.toLowerCase(), d.id));

      (items || []).forEach((item, idx) => {
        const row = idx + 1;
        const ten = (item.ten || '').trim();
        if (!ten) {
          errors.push(`Dòng ${row}: Thiếu tên tổ chức`);
          return;
        }
        const ma = item.ma ? item.ma.trim() : `TC-${Date.now().toString().slice(-4)}-${row}`;
        if (existingCodes.has(ma.toLowerCase())) {
          errors.push(`Dòng ${row}: Mã "${ma}" đã tồn tại`);
          return;
        }
        let parentId = item.don_vi_cha_id || null;
        if (!parentId && item.ma_cap_tren) {
          parentId = codeToIdMap.get(item.ma_cap_tren.trim().toLowerCase()) || null;
        }
        const newUnit: DonVi = {
          id: `dv-${Date.now()}-${idx}`,
          ten,
          loai: item.loai || 'CHI_BO',
          don_vi_cha_id: parentId,
          ma,
          thu_tu: db.donViList.length + imported.length + 1,
          ghi_chu: item.ghi_chu || null,
          trang_thai: item.trang_thai || 'DANG_HOAT_DONG',
          ngay_thanh_lap: item.ngay_thanh_lap || null,
          ngay_ket_thuc: item.ngay_ket_thuc || null,
          so_quyet_dinh: item.so_quyet_dinh || null,
          nguoi_tao_ten: actor_name || 'Cán bộ nhập liệu',
          version: 1,
          sync_status: 'synced',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        };
        existingCodes.add(ma.toLowerCase());
        codeToIdMap.set(ma.toLowerCase(), newUnit.id);
        imported.push(newUnit);
      });
      if (imported.length > 0) {
        db.donViList.push(...imported);
        saveMockDb(db);
      }
      return { success: true, importedCount: imported.length, errorCount: errors.length, errors, imported } as T;
    }

    case 'get_don_vi_relations': {
      const { id } = args as { id: string };
      const chuongTrinhCount = (db.chuongTrinhList || []).filter((c) => c.don_vi_id === id).length;
      const donThuCount = (db.donThuList || []).filter((d) => d.doi_tuong_lien_quan === id).length;
      const childrenCount = (db.donViList || []).filter((d) => d.don_vi_cha_id === id && !d.deleted_at).length;
      const history = (db.auditLogs || []).filter((l) => l.ban_ghi_id === id || l.hanh_dong?.includes(id)).slice(0, 10);
      return { chuongTrinhCount, donThuCount, childrenCount, history } as T;
    }

    case 'get_app_info': {
      const active = db.donViList.filter((d) => !d.deleted_at);
      const rootUnit = active.find((d) => !d.don_vi_cha_id) || active[0];
      return {
        app_name: 'Phần mềm Quản lý Chương trình Kiểm tra, Giám sát của Đảng',
        version: '2.0.0-Online',
        total_don_vi: active.length,
        root_unit_name: rootUnit ? rootUnit.ten : 'Đảng ủy cơ sở',
        root_unit_id: rootUnit ? rootUnit.id : null,
        pending_sync_count: db.donViList.filter((d) => d.sync_status === 'pending').length,
      } as T;
    }

    case 'get_audit_logs': {
      return db.auditLogs as T;
    }

    case 'get_all_users': {
      return db.users as T;
    }

    case 'create_user': {
      const { req } = args as { req: { ten_dang_nhap: string; ho_ten: string; mat_khau: string; vai_tro: string; chuc_danh?: string } };
      const exists = db.users.some((u) => u.ten_dang_nhap.toLowerCase() === req.ten_dang_nhap.toLowerCase());
      if (exists) throw new Error('Tên đăng nhập đã tồn tại');
      const newUser: User = {
        id: 'mock-user-' + Date.now(),
        ten_dang_nhap: req.ten_dang_nhap.trim(),
        ho_ten: req.ho_ten.trim(),
        vai_tro: req.vai_tro as User['vai_tro'],
        chuc_danh: req.chuc_danh || 'Chuyên viên UBKT',
        trang_thai: 1,
        must_change_password: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      (newUser as unknown as { mat_khau?: string }).mat_khau = req.mat_khau;
      db.users.push(newUser);
      saveMockDb(db);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ubkt_users_updated', { detail: newUser }));
      }
      return newUser as T;
    }

    case 'reset_user_password': {
      const { req } = args as { req: { user_id: string; mat_khau_moi: string } };
      const user = db.users.find((u) => u.id === req.user_id);
      if (!user) throw new Error('Người dùng không tồn tại');
      user.must_change_password = true;
      (user as unknown as { mat_khau?: string }).mat_khau = req.mat_khau_moi;
      user.updated_at = new Date().toISOString();
      saveMockDb(db);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
      }
      return undefined as T;
    }

    case 'update_user': {
      const { req } = args as { req: { user_id: string; ho_ten: string; vai_tro: string; trang_thai: number; chuc_danh?: string } };
      const user = db.users.find((u) => u.id === req.user_id);
      if (!user) throw new Error('Người dùng không tồn tại');
      user.ho_ten = req.ho_ten;
      user.vai_tro = req.vai_tro as User['vai_tro'];
      user.trang_thai = req.trang_thai;
      if (req.chuc_danh !== undefined) {
        user.chuc_danh = req.chuc_danh;
      }
      user.updated_at = new Date().toISOString();
      saveMockDb(db);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
      }
      return undefined as T;
    }

    case 'delete_user': {
      const { user_id } = args as { user_id: string };
      db.users = db.users.filter((u) => u.id !== user_id);
      saveMockDb(db);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
      }
      return undefined as T;
    }

    // ── Chương trình kiểm tra, giám sát ─────────────────────────────────────────
    case 'get_all_chuong_trinh': {
      if (!db.chuongTrinhList || db.chuongTrinhList.length === 0) {
        db.chuongTrinhList = [];
      }
      let needsSave = false;
      const hasBtvItem = db.chuongTrinhList.some((c) => c.co_quan_ban_hanh === 'Ban Thường vụ Đảng ủy phường' || (c.so_van_ban === null && c.loai_chuong_trinh === 'NHIEM_KY'));
      if (!hasBtvItem) {
        db.chuongTrinhList.unshift({
          id: 'ct-nk-btv',
          nam: 2025,
          loai_chuong_trinh: 'NHIEM_KY',
          nhiem_ky: '2025 - 2030',
          khoa_nhiem_ky: '2025 - 2030',
          has_nhiem_ky: true,
          term_start_year: 2025,
          term_end_year: 2030,
          ten_chuong_trinh: 'Kiểm tra, giám sát theo Quyết định/Kế hoạch số ...',
          co_quan_ban_hanh: 'Ban Thường vụ Đảng ủy phường',
          chu_the_ap_dung: 'Toàn Đảng bộ',
          thoi_gian_loai: 'CA_NHIEM_KY',
          chu_the: 'Ban Thường vụ Đảng ủy phường',
          don_vi_id: '01918a00-0000-7000-8000-000000000002',
          ten_don_vi: 'Ban Thường vụ Đảng ủy',
          loai_hinh: null,
          doi_tuong: 'Toàn Đảng bộ',
          noi_dung: 'Kiểm tra, giám sát theo Quyết định/Kế hoạch số ...: Kiểm tra việc lãnh đạo, chỉ đạo và tổ chức thực hiện nhiệm vụ chính trị, công tác xây dựng Đảng, giữ gìn đoàn kết nội bộ.',
          ngay_bat_dau: null,
          ngay_ket_thuc: null,
          so_van_ban: null,
          trang_thai: 'DANG_THUC_HIEN',
          file_pdf_ten: 'CT-KTGS của BCH, BTV.pdf',
          file_pdf_url: null,
          file_pdf_dung_luong: 2450000,
          ghi_chu_pdf: 'Kèm theo Quyết định của BTV Đảng ủy',
          danh_sach_thay_doi_bo_sung: [],
          created_at: '2025-08-01T08:00:00Z',
          updated_at: '2025-08-01T08:00:00Z',
        });
        needsSave = true;
      }

      db.chuongTrinhList.forEach((c) => {
        if (!c.term_start_year && c.nhiem_ky) {
          const parts = c.nhiem_ky.split('-').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
          if (parts.length >= 2) {
            c.term_start_year = parts[0];
            c.term_end_year = parts[1];
            needsSave = true;
          }
        }
        if (!c.co_quan_ban_hanh) {
          c.co_quan_ban_hanh = c.chu_the;
          needsSave = true;
        }
        if (!c.chu_the_ap_dung) {
          c.chu_the_ap_dung = c.ten_chi_dang_bo || (c.ten_don_vi ? c.ten_don_vi : 'Toàn Đảng bộ');
          needsSave = true;
        }
        if (!c.thoi_gian_loai) {
          c.thoi_gian_loai = c.ngay_bat_dau ? 'KHOANG_THOI_GIAN' : 'CA_NHIEM_KY';
          needsSave = true;
        }

        // Đảm bảo dữ liệu 5 dòng khớp hoàn toàn với mẫu ảnh
        if (c.id === 'ct-nk-btv') {
          c.co_quan_ban_hanh = 'Ban Thường vụ Đảng ủy phường';
          c.chu_the_ap_dung = 'Toàn Đảng bộ';
          c.so_van_ban = null;
          c.file_pdf_ten = 'CT-KTGS của BCH, BTV.pdf';
          c.thoi_gian_loai = 'CA_NHIEM_KY';
          c.trang_thai = 'DANG_THUC_HIEN';
          c.ten_chuong_trinh = c.ten_chuong_trinh || 'Kiểm tra, giám sát theo Quyết định/Kế hoạch số ...';
        } else if (c.id === 'ct-nk-001') {
          c.co_quan_ban_hanh = 'BCH Đảng bộ phường Ái Quốc';
          c.chu_the_ap_dung = 'Toàn Đảng bộ';
          c.so_van_ban = '01-CTr/ĐU';
          c.trang_thai = 'DANG_THUC_HIEN';
          c.ten_chuong_trinh = 'Chương trình kiểm tra, giám sát toàn khóa nhiệm kỳ 2025 - 2030';
        } else if (c.id === 'ct-nk-002') {
          c.co_quan_ban_hanh = 'Chi bộ Quân sự';
          c.chu_the_ap_dung = 'Chi bộ Quân sự';
          c.so_van_ban = '02-CTr/CBQS';
          c.trang_thai = 'DANG_THUC_HIEN';
          c.ten_chuong_trinh = 'Chương trình kiểm tra, giám sát của Chi bộ Quân sự nhiệm kỳ 2025 - 2027';
        } else if (c.id === 'ct-nk-003') {
          c.co_quan_ban_hanh = 'Chi bộ Công an';
          c.chu_the_ap_dung = 'Chi bộ Công an';
          c.so_van_ban = '03-CTr/CBCA';
          c.trang_thai = 'DANG_THUC_HIEN';
          c.ten_chuong_trinh = 'Chương trình kiểm tra, giám sát nhiệm kỳ 2025 - 2027';
        } else if (c.id === 'ct-nk-004') {
          c.co_quan_ban_hanh = 'UBKT Đảng ủy phường';
          c.chu_the_ap_dung = 'Toàn Đảng bộ';
          c.so_van_ban = '04-CTr/UBMTTQ';
          c.trang_thai = 'DA_HOAN_THANH';
          c.ngay_bat_dau = '2025-09-01';
          c.ngay_ket_thuc = '2030-08-30';
          c.ten_chuong_trinh = 'Chương trình kiểm tra, giám sát toàn khóa nhiệm kỳ 2025 - 2030 của Ủy ban Kiểm tra Đảng ủy phường';
        }
      });

      // Sắp xếp ưu tiên 5 dòng chuẩn lên đầu
      const priorityOrder = ['ct-nk-btv', 'ct-nk-001', 'ct-nk-002', 'ct-nk-003', 'ct-nk-004'];
      db.chuongTrinhList.sort((a, b) => {
        const idxA = priorityOrder.indexOf(a.id);
        const idxB = priorityOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });

      if (needsSave) {
        saveMockDb(db);
      }
      return (db.chuongTrinhList || []) as T;
    }

    case 'create_chuong_trinh': {
      const { input } = args as { input: CreateChuongTrinhInput };
      const isNhiemKy = (input.loai_chuong_trinh || (input.nhiem_ky || input.has_nhiem_ky ? 'NHIEM_KY' : 'HANG_NAM')) === 'NHIEM_KY';
      const termStart = input.term_start_year || (input.nhiem_ky ? parseInt(input.nhiem_ky.split('-')[0]?.trim() || '', 10) || null : null);
      const termEnd = input.term_end_year || (input.nhiem_ky ? parseInt(input.nhiem_ky.split('-')[1]?.trim() || '', 10) || null : null);
      const nhiemKyFinal = input.nhiem_ky || (termStart && termEnd ? `${termStart} - ${termEnd}` : null);

      const newItem: ChuongTrinhKtGs = {
        id: 'ct-' + Date.now(),
        nam: input.nam,
        loai_chuong_trinh: isNhiemKy ? 'NHIEM_KY' : 'HANG_NAM',
        nhiem_ky: nhiemKyFinal,
        khoa_nhiem_ky: nhiemKyFinal,
        has_nhiem_ky: input.has_nhiem_ky !== undefined ? input.has_nhiem_ky : Boolean(nhiemKyFinal),
        term_start_year: termStart,
        term_end_year: termEnd,
        ten_chuong_trinh: input.ten_chuong_trinh?.trim() || input.noi_dung.slice(0, 80),
        co_quan_ban_hanh: input.co_quan_ban_hanh?.trim() || input.chu_the,
        chu_the_ap_dung: input.chu_the_ap_dung?.trim() || input.ten_chi_dang_bo || 'Toàn Đảng bộ',
        thoi_gian_loai: input.thoi_gian_loai || (input.ngay_bat_dau ? 'KHOANG_THOI_GIAN' : 'CA_NHIEM_KY'),
        chu_the: input.chu_the,
        don_vi_id: input.don_vi_id || null,
        ten_don_vi: input.ten_don_vi || null,
        chi_dang_bo_id: input.chi_dang_bo_id || null,
        ten_chi_dang_bo: input.ten_chi_dang_bo || null,
        loai_hinh: isNhiemKy ? (input.loai_hinh || null) : (input.loai_hinh || 'KIEM_TRA'),
        doi_tuong: isNhiemKy ? (input.doi_tuong?.trim() || input.chu_the_ap_dung || input.ten_chi_dang_bo || 'Toàn Đảng bộ') : (input.doi_tuong?.trim() || ''),
        noi_dung: input.noi_dung.trim(),
        noi_dung_van_ban: input.noi_dung_van_ban?.trim() || null,
        ngay_bat_dau: input.ngay_bat_dau || null,
        ngay_ket_thuc: input.ngay_ket_thuc || null,
        so_van_ban: input.so_van_ban?.trim() || null,
        ngay_ban_hanh: input.ngay_ban_hanh || null,
        nguoi_ky: input.nguoi_ky?.trim() || null,
        trang_thai: input.trang_thai,
        file_pdf_ten: input.file_pdf_ten || null,
        file_pdf_url: input.file_pdf_url || null,
        file_pdf_dung_luong: input.file_pdf_dung_luong || (input.file_pdf_ten ? 350000 : null),
        ghi_chu_pdf: input.ghi_chu_pdf?.trim() || null,
        danh_sach_thay_doi_bo_sung: input.danh_sach_thay_doi_bo_sung || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (!db.chuongTrinhList) db.chuongTrinhList = [];
      db.chuongTrinhList.unshift(newItem);
      saveMockDb(db);
      return newItem as T;
    }

    case 'update_chuong_trinh': {
      const { input } = args as { input: UpdateChuongTrinhInput };
      if (!db.chuongTrinhList) db.chuongTrinhList = [];
      const item = db.chuongTrinhList.find((c) => c.id === input.id);
      if (!item) throw new Error('Không tìm thấy chương trình');
      item.nam = input.nam;
      if (input.loai_chuong_trinh !== undefined) item.loai_chuong_trinh = input.loai_chuong_trinh;
      if (input.nhiem_ky !== undefined) {
        item.nhiem_ky = input.nhiem_ky;
        item.khoa_nhiem_ky = input.nhiem_ky;
      }
      if (input.has_nhiem_ky !== undefined) item.has_nhiem_ky = input.has_nhiem_ky;
      if (input.term_start_year !== undefined) item.term_start_year = input.term_start_year;
      if (input.term_end_year !== undefined) item.term_end_year = input.term_end_year;
      if (input.ten_chuong_trinh !== undefined) item.ten_chuong_trinh = input.ten_chuong_trinh;
      if (input.co_quan_ban_hanh !== undefined) item.co_quan_ban_hanh = input.co_quan_ban_hanh;
      if (input.chu_the_ap_dung !== undefined) item.chu_the_ap_dung = input.chu_the_ap_dung;
      if (input.thoi_gian_loai !== undefined) item.thoi_gian_loai = input.thoi_gian_loai;
      item.chu_the = input.chu_the;
      item.don_vi_id = input.don_vi_id || null;
      item.ten_don_vi = input.ten_don_vi || null;
      if (input.chi_dang_bo_id !== undefined) item.chi_dang_bo_id = input.chi_dang_bo_id;
      if (input.ten_chi_dang_bo !== undefined) item.ten_chi_dang_bo = input.ten_chi_dang_bo;
      if (input.loai_hinh !== undefined) item.loai_hinh = input.loai_hinh;
      if (input.doi_tuong !== undefined) item.doi_tuong = input.doi_tuong?.trim() || null;
      item.noi_dung = input.noi_dung.trim();
      if (input.noi_dung_van_ban !== undefined) item.noi_dung_van_ban = input.noi_dung_van_ban;
      item.ngay_bat_dau = input.ngay_bat_dau || null;
      item.ngay_ket_thuc = input.ngay_ket_thuc || null;
      item.so_van_ban = input.so_van_ban?.trim() || null;
      if (input.ngay_ban_hanh !== undefined) item.ngay_ban_hanh = input.ngay_ban_hanh;
      if (input.nguoi_ky !== undefined) item.nguoi_ky = input.nguoi_ky;
      item.trang_thai = input.trang_thai;
      if (input.file_pdf_ten !== undefined) item.file_pdf_ten = input.file_pdf_ten;
      if (input.file_pdf_url !== undefined) item.file_pdf_url = input.file_pdf_url;
      if (input.file_pdf_dung_luong !== undefined) item.file_pdf_dung_luong = input.file_pdf_dung_luong;
      if (input.danh_sach_thay_doi_bo_sung !== undefined) item.danh_sach_thay_doi_bo_sung = input.danh_sach_thay_doi_bo_sung;
      item.ghi_chu_pdf = input.ghi_chu_pdf?.trim() || null;
      item.updated_at = new Date().toISOString();
      saveMockDb(db);
      return item as T;
    }

    case 'delete_chuong_trinh': {
      const { id } = args as { id: string };
      if (!db.chuongTrinhList) db.chuongTrinhList = [];
      db.chuongTrinhList = db.chuongTrinhList.filter((c) => c.id !== id);
      saveMockDb(db);
      return undefined as T;
    }

    // ── Quản lý thay đổi bổ sung chương trình nhiệm kỳ ────────────────────────
    case 'add_thay_doi_bo_sung': {
      const { input } = args as { input: ThayDoiBoSungKtGs };
      if (!db.chuongTrinhList) db.chuongTrinhList = [];
      const ct = db.chuongTrinhList.find((c) => c.id === input.chuong_trinh_id);
      if (!ct) throw new Error('Không tìm thấy chương trình KT-GS tương ứng');
      if (!ct.danh_sach_thay_doi_bo_sung) ct.danh_sach_thay_doi_bo_sung = [];
      const newThayDoi: ThayDoiBoSungKtGs = {
        ...input,
        id: input.id || 'td-' + Date.now(),
        lan_dieu_chinh: input.lan_dieu_chinh || (ct.danh_sach_thay_doi_bo_sung.length + 1),
        created_at: input.created_at || new Date().toISOString(),
      };
      ct.danh_sach_thay_doi_bo_sung.unshift(newThayDoi);
      ct.updated_at = new Date().toISOString();
      saveMockDb(db);
      return newThayDoi as T;
    }

    case 'delete_thay_doi_bo_sung': {
      const { chuong_trinh_id, thay_doi_id } = args as { chuong_trinh_id: string; thay_doi_id: string };
      if (!db.chuongTrinhList) db.chuongTrinhList = [];
      const ct = db.chuongTrinhList.find((c) => c.id === chuong_trinh_id);
      if (ct && ct.danh_sach_thay_doi_bo_sung) {
        ct.danh_sach_thay_doi_bo_sung = ct.danh_sach_thay_doi_bo_sung.filter((td) => td.id !== thay_doi_id);
        ct.updated_at = new Date().toISOString();
        saveMockDb(db);
      }
      return undefined as T;
    }

    case 'update_thay_doi_bo_sung': {
      const { input } = args as { input: ThayDoiBoSungKtGs };
      if (!db.chuongTrinhList) db.chuongTrinhList = [];
      const ct = db.chuongTrinhList.find((c) => c.id === input.chuong_trinh_id);
      if (!ct || !ct.danh_sach_thay_doi_bo_sung) throw new Error('Không tìm thấy chương trình KT-GS tương ứng');
      const idx = ct.danh_sach_thay_doi_bo_sung.findIndex((td) => td.id === input.id);
      if (idx !== -1) {
        ct.danh_sach_thay_doi_bo_sung[idx] = {
          ...ct.danh_sach_thay_doi_bo_sung[idx],
          ...input,
          updated_at: new Date().toISOString(),
        };
        ct.updated_at = new Date().toISOString();
        saveMockDb(db);
        return ct.danh_sach_thay_doi_bo_sung[idx] as T;
      }
      throw new Error('Không tìm thấy bản ghi thay đổi bổ sung');
    }

    // ── Kho tệp PDF (Tổng hợp toàn bộ từ Chương trình, Thay đổi bổ sung, Hồ sơ địa bàn) ──
    case 'get_all_pdfs': {
      const list: PdfKhoItem[] = [];
      const seenFileKeys = new Set<string>();

      // 1. Tệp PDF từ Chương trình kiểm tra, giám sát (Hằng năm & Nhiệm kỳ)
      (db.chuongTrinhList || []).forEach((c) => {
        if (c.file_pdf_ten) {
          const key = `ct_${c.id}_${c.file_pdf_ten}`;
          if (!seenFileKeys.has(key)) {
            seenFileKeys.add(key);
            list.push({
              id: 'ct-pdf-' + c.id,
              ten_file: c.file_pdf_ten,
              dung_luong: c.file_pdf_dung_luong || 385000,
              url: c.file_pdf_url,
              chuong_trinh_id: c.id,
              don_vi_id: c.don_vi_id || c.chi_dang_bo_id,
              ten_don_vi: c.ten_chi_dang_bo || c.ten_don_vi,
              nguon_goc: 'CHUONG_TRINH',
              chu_the: c.chu_the,
              doi_tuong: c.doi_tuong || (c.ten_chi_dang_bo ? `Lưu cho: ${c.ten_chi_dang_bo}` : 'Toàn Đảng bộ'),
              nam: c.nam,
              loai_hinh: c.loai_hinh,
              so_van_ban: c.so_van_ban,
              ngay_ban_hanh: c.ngay_ban_hanh || (c.created_at ? c.created_at.slice(0, 10) : '2026-01-15'),
              ghi_chu: c.ghi_chu_pdf || (c.nhiem_ky ? `Chương trình nhiệm kỳ ${c.nhiem_ky}` : `Chương trình năm ${c.nam}`),
              created_at: c.updated_at || c.created_at,
            });
          }
        }

        // 2. Tệp PDF từ các lần THAY ĐỔI, BỔ SUNG chương trình nhiệm kỳ
        if (c.danh_sach_thay_doi_bo_sung && Array.isArray(c.danh_sach_thay_doi_bo_sung)) {
          c.danh_sach_thay_doi_bo_sung.forEach((td) => {
            if (td.file_pdf_ten) {
              const tdKey = `td_${td.id}_${td.file_pdf_ten}`;
              if (!seenFileKeys.has(tdKey)) {
                seenFileKeys.add(tdKey);
                list.push({
                  id: 'td-pdf-' + td.id,
                  ten_file: td.file_pdf_ten,
                  dung_luong: td.file_pdf_dung_luong || 350000,
                  url: td.file_pdf_url,
                  chuong_trinh_id: c.id,
                  thay_doi_id: td.id,
                  don_vi_id: td.don_vi_id || null,
                  ten_don_vi: td.ten_don_vi || 'Toàn Đảng bộ',
                  nguon_goc: 'THAY_DOI_BO_SUNG',
                  chu_the: c.chu_the,
                  doi_tuong: td.ten_don_vi ? `Địa bàn: ${td.ten_don_vi}` : 'Toàn Đảng bộ',
                  nam: c.nam,
                  loai_hinh: c.loai_hinh,
                  so_van_ban: td.so_van_ban,
                  ngay_ban_hanh: td.ngay_ban_hanh || (td.created_at ? td.created_at.slice(0, 10) : '2026-02-01'),
                  ghi_chu: `Văn bản điều chỉnh/bổ sung (Lần ${td.lan_dieu_chinh || 1}): ${td.noi_dung_dieu_chinh.slice(0, 70)}...`,
                  created_at: td.created_at,
                });
              }
            }
          });
        }
      });

      // 3. Tệp từ Hồ sơ địa bàn (toàn bộ định dạng PDF, DOCX, DOC, XLSX...)
      try {
        const rawDiaBanFiles = localStorage.getItem('ubkt_ho_so_dia_ban_files');
        if (rawDiaBanFiles) {
          const diaBanFiles = JSON.parse(rawDiaBanFiles);
          if (Array.isArray(diaBanFiles)) {
            diaBanFiles.forEach((f: any) => {
              const dbKey = `db_${f.id}_${f.ten_file}`;
              if (!seenFileKeys.has(dbKey)) {
                seenFileKeys.add(dbKey);
                list.push({
                  id: 'hsdb-' + f.id,
                  ten_file: f.ten_file,
                  dung_luong: f.dung_luong || 320000,
                  url: f.url || f.file_url || null,
                  file_url: f.file_url || f.url || null,
                  loai_file: f.loai_file || (f.ten_file?.toLowerCase().endsWith('.pdf') ? 'pdf' : f.ten_file?.toLowerCase().endsWith('.docx') ? 'docx' : f.ten_file?.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'doc'),
                  the_loai_van_ban: f.the_loai_van_ban || 'Tài liệu hồ sơ',
                  so_van_ban: f.so_van_ban || null,
                  trich_yeu: f.trich_yeu || f.mo_ta || null,
                  nguoi_ky: f.nguoi_ky || f.nguoi_tao || null,
                  chuong_trinh_id: null,
                  don_vi_id: f.don_vi_id || null,
                  ten_don_vi: f.ten_don_vi || null,
                  nguon_goc: 'HO_SO_DIA_BAN',
                  chu_the: f.ten_don_vi ? `Hồ sơ địa bàn ${f.ten_don_vi}` : 'Hồ sơ địa bàn cơ sở',
                  doi_tuong: f.ten_don_vi || 'Cơ sở',
                  nam: new Date().getFullYear(),
                  ngay_ban_hanh: f.ngay_ban_hanh || (f.ngay_tao ? f.ngay_tao.slice(0, 10) : new Date().toISOString().slice(0, 10)),
                  ghi_chu: f.loai_tai_lieu || f.trich_yeu || 'Tài liệu hồ sơ địa bàn',
                  created_at: f.ngay_tao ? new Date().toISOString() : new Date().toISOString(),
                });
              }
            });
          }
        }
      } catch {
        // ignore
      }

      // 3.1. Báo cáo định kỳ tháng từ các đơn vị
      try {
        const rawBaoCao = localStorage.getItem('ubkt_bao_cao_thang');
        if (rawBaoCao) {
          const baoCaoList = JSON.parse(rawBaoCao);
          if (Array.isArray(baoCaoList)) {
            baoCaoList.forEach((bc: any) => {
              if (bc.file_ten) {
                const bcKey = `bc_${bc.id}_${bc.file_ten}`;
                if (!seenFileKeys.has(bcKey)) {
                  seenFileKeys.add(bcKey);
                  list.push({
                    id: 'bc-' + bc.id,
                    ten_file: bc.file_ten,
                    dung_luong: bc.file_dung_luong || 250000,
                    url: bc.file_url || null,
                    file_url: bc.file_url || null,
                    loai_file: bc.file_loai || (bc.file_ten.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx'),
                    the_loai_van_ban: 'Báo cáo',
                    so_van_ban: `BC-T${bc.thang}/${bc.nam}`,
                    trich_yeu: bc.tieu_de || `Báo cáo công tác tháng ${bc.thang}/${bc.nam}`,
                    nguoi_ky: bc.can_bo_ten || null,
                    chuong_trinh_id: null,
                    don_vi_id: bc.danh_sach_don_vi_ids?.[0] || null,
                    ten_don_vi: bc.danh_sach_ten_don_vi?.join(', ') || null,
                    nguon_goc: 'BAO_CAO_THANG',
                    chu_the: bc.danh_sach_ten_don_vi?.join(', ') || 'Báo cáo tháng cơ sở',
                    doi_tuong: bc.danh_sach_ten_don_vi?.join(', ') || 'Cơ sở',
                    nam: bc.nam || new Date().getFullYear(),
                    ngay_ban_hanh: bc.ngay_nop || (bc.created_at ? bc.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
                    ghi_chu: `Báo cáo định kỳ tháng ${bc.thang}/${bc.nam}`,
                    created_at: bc.created_at || new Date().toISOString(),
                  });
                }
              }
            });
          }
        }
      } catch {
        // ignore
      }

      // 4. Lấy từ kho PDF độc lập nếu có
      if (db.pdfFiles && Array.isArray(db.pdfFiles)) {
        db.pdfFiles.forEach((p) => {
          if (!seenFileKeys.has('pdf_' + p.id)) {
            seenFileKeys.add('pdf_' + p.id);
            list.push({
              ...p,
              nguon_goc: p.nguon_goc || 'KHO_PDF',
              ngay_ban_hanh: p.ngay_ban_hanh || (p.created_at ? p.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
            });
          }
        });
      }

      // Sắp xếp các file PDF theo thứ tự ngày ban hành mới nhất đến cũ hơn (dòng thời gian liên tục)
      list.sort((a, b) => {
        const dateA = a.ngay_ban_hanh || a.created_at || '';
        const dateB = b.ngay_ban_hanh || b.created_at || '';
        return dateB.localeCompare(dateA);
      });

      return list as T;
    }

    case 'create_or_attach_pdf': {
      const { input } = args as {
        input: {
          ten_file: string;
          dung_luong: number;
          url?: string | null;
          chuong_trinh_id?: string | null;
          ghi_chu?: string | null;
          nguoi_tai_len?: string | null;
          nguon_goc?: 'CHUONG_TRINH' | 'THAY_DOI_BO_SUNG' | 'HO_SO_DIA_BAN' | 'KHO_PDF';
          don_vi_id?: string | null;
          ten_don_vi?: string | null;
        };
      };

      if (input.chuong_trinh_id) {
        const ct = (db.chuongTrinhList || []).find((c) => c.id === input.chuong_trinh_id);
        if (ct) {
          ct.file_pdf_ten = input.ten_file;
          ct.file_pdf_dung_luong = input.dung_luong;
          if (input.url) ct.file_pdf_url = input.url;
          if (input.ghi_chu) ct.ghi_chu_pdf = input.ghi_chu;
          ct.updated_at = new Date().toISOString();
          saveMockDb(db);
          return {
            id: 'ct-pdf-' + ct.id,
            ten_file: input.ten_file,
            dung_luong: input.dung_luong,
            url: input.url || null,
            chuong_trinh_id: ct.id,
            nguon_goc: 'CHUONG_TRINH',
            chu_the: ct.chu_the,
            doi_tuong: ct.doi_tuong,
            nam: ct.nam,
            loai_hinh: ct.loai_hinh,
            so_van_ban: ct.so_van_ban,
            ghi_chu: input.ghi_chu || null,
            created_at: ct.updated_at,
          } as T;
        }
      }

      if (!db.pdfFiles) db.pdfFiles = [];
      const newPdf: PdfKhoItem = {
        id: 'pdf-' + Date.now(),
        ten_file: input.ten_file,
        dung_luong: input.dung_luong,
        url: input.url || null,
        chuong_trinh_id: null,
        nguon_goc: input.nguon_goc || 'KHO_PDF',
        don_vi_id: input.don_vi_id || null,
        ten_don_vi: input.ten_don_vi || null,
        chu_the: input.ten_don_vi || 'Văn bản / Kế hoạch độc lập',
        doi_tuong: input.ten_don_vi ? `Địa bàn ${input.ten_don_vi}` : 'Tài liệu nghiệp vụ KT-GS',
        nam: new Date().getFullYear(),
        ghi_chu: input.ghi_chu || null,
        created_at: new Date().toISOString(),
      };
      db.pdfFiles.unshift(newPdf);
      saveMockDb(db);
      return newPdf as T;
    }

    case 'delete_pdf': {
      const { id } = args as { id: string };
      if (id.startsWith('ct-pdf-')) {
        const ctId = id.replace('ct-pdf-', '');
        const ct = (db.chuongTrinhList || []).find((c) => c.id === ctId);
        if (ct) {
          ct.file_pdf_ten = null;
          ct.file_pdf_url = null;
          ct.file_pdf_dung_luong = null;
          ct.ghi_chu_pdf = null;
          ct.updated_at = new Date().toISOString();
          saveMockDb(db);
        }
      } else {
        if (!db.pdfFiles) db.pdfFiles = [];
        db.pdfFiles = db.pdfFiles.filter((p) => p.id !== id);
        saveMockDb(db);
      }
      return undefined as T;
    }

    // ── Quản lý Đơn thư Mock ──
    case 'get_all_don_thu': {
      return (db.donThuList || []) as T;
    }

    case 'create_don_thu': {
      const { input, actor_name } = args as { input: Partial<DonThu>; actor_name?: string };
      if (!db.donThuList) db.donThuList = [];
      let maDon = input && input.ma_don ? input.ma_don.trim() : '';
      if (!maDon) {
        const nextNum = db.donThuList.length + 1;
        maDon = `ĐT-2026-${String(nextNum).padStart(3, '0')}`;
      }
      const now = new Date().toISOString();
      const newDonThu: DonThu = {
        id: `dt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ma_don: maDon,
        ngay_tiep_nhan: input?.ngay_tiep_nhan || now.slice(0, 10),
        loai_don: input?.loai_don || 'Khiếu nại',
        linh_vuc: input?.linh_vuc || 'Công tác đảng',
        doi_tuong_lien_quan: input?.doi_tuong_lien_quan || 'Tổ chức đảng',
        phan_loai_xu_ly: input?.phan_loai_xu_ly || 'Thuộc thẩm quyền',
        huong_xu_ly: input?.huong_xu_ly || 'Xem xét giải quyết',
        thoi_han_quy_dinh: Number(input?.thoi_han_quy_dinh) || 30,
        can_bo_phu_trach: input?.can_bo_phu_trach || 'Đ/c Nguyễn Văn A',
        trang_thai: input?.trang_thai || 'Mới tiếp nhận',
        ngay_hoan_thanh: input?.ngay_hoan_thanh || null,
        ghi_chu_nghiep_vu: input?.ghi_chu_nghiep_vu ? input.ghi_chu_nghiep_vu.slice(0, 255) : '',
        trong_ky: input?.trong_ky !== undefined ? input.trong_ky : true,
        created_at: now,
        updated_at: now,
      };
      db.donThuList.unshift(newDonThu);
      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        nguoi_dung_id: null,
        ten_nguoi_dung: actor_name || 'Cán bộ UBKT',
        hanh_dong: `Tiếp nhận đơn thư mới: ${newDonThu.ma_don} (${newDonThu.loai_don} - ${newDonThu.linh_vuc})`,
        bang_anh_huong: 'don_thu',
        ban_ghi_id: newDonThu.id,
        du_lieu_cu: null,
        du_lieu_moi: JSON.stringify(newDonThu),
        thoi_gian: now,
      });
      saveMockDb(db);
      return newDonThu as T;
    }

    case 'update_don_thu': {
      const { id, input, actor_name } = args as { id: string; input: Partial<DonThu>; actor_name?: string };
      if (!db.donThuList) db.donThuList = [];
      const idx = db.donThuList.findIndex((d) => d.id === id);
      if (idx === -1) {
        throw new Error('Không tìm thấy đơn thư cần cập nhật');
      }
      const oldData = db.donThuList[idx];
      const updated: DonThu = {
        ...oldData,
        ...input,
        id: oldData.id,
        updated_at: new Date().toISOString(),
      };
      db.donThuList[idx] = updated;
      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        nguoi_dung_id: null,
        ten_nguoi_dung: actor_name || 'Cán bộ UBKT',
        hanh_dong: `Cập nhật tiến độ đơn thư: ${updated.ma_don} (${updated.trang_thai})`,
        bang_anh_huong: 'don_thu',
        ban_ghi_id: updated.id,
        du_lieu_cu: JSON.stringify(oldData),
        du_lieu_moi: JSON.stringify(updated),
        thoi_gian: new Date().toISOString(),
      });
      saveMockDb(db);
      return updated as T;
    }

    case 'delete_don_thu': {
      const { id, actor_name } = args as { id: string; actor_name?: string };
      if (!db.donThuList) db.donThuList = [];
      const found = db.donThuList.find((d) => d.id === id);
      if (!found) {
        throw new Error('Không tìm thấy đơn thư cần xóa');
      }
      db.donThuList = db.donThuList.filter((d) => d.id !== id);
      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        nguoi_dung_id: null,
        ten_nguoi_dung: actor_name || 'Cán bộ UBKT',
        hanh_dong: `Xóa hồ sơ đơn thư: ${found.ma_don}`,
        bang_anh_huong: 'don_thu',
        ban_ghi_id: found.id,
        du_lieu_cu: JSON.stringify(found),
        du_lieu_moi: null,
        thoi_gian: new Date().toISOString(),
      });
      saveMockDb(db);
      return undefined as T;
    }

    default:
      throw new Error(`Command not recognized: ${cmd}`);
  }
}

export const api = {
  login: (req: { ten_dang_nhap: string; mat_khau: string }) =>
    requestApi<{ user: User; token: string }>('/api/login', 'POST', { req }, 'login', { req }),

  changePassword: (req: { user_id: string; mat_khau_cu: string; mat_khau_moi: string }) =>
    requestApi<void>('/api/change-password', 'POST', { req }, 'change_password', { req }),

  getCurrentUser: (user_id: string) =>
    requestApi<User>(`/api/current-user/${user_id}`, 'GET', undefined, 'get_current_user', { user_id }),

  getAllDonVi: () =>
    requestApi<DonVi[]>('/api/don-vi', 'GET', undefined, 'get_all_don_vi'),

  getDonViTree: () =>
    requestApi<DonViTreeItem[]>('/api/don-vi/tree', 'GET', undefined, 'get_don_vi_tree'),

  createDonVi: (input: CreateDonViInput, user_id?: string) =>
    requestApi<DonVi>('/api/don-vi', 'POST', { input, user_id }, 'create_don_vi', { input, user_id }),

  updateDonVi: (input: UpdateDonViInput, user_id?: string) =>
    requestApi<DonVi>(`/api/don-vi/${input.id}`, 'PUT', { input, user_id }, 'update_don_vi', { input, user_id }),

  deleteDonVi: (id: string, user_id?: string, actor_name?: string) =>
    requestApi<void>(`/api/don-vi/${id}`, 'DELETE', { user_id, actor_name }, 'delete_don_vi', { id, user_id, actor_name }),

  toggleDonViStatus: (id: string, trang_thai: TrangThaiDonVi, ly_do?: string, actor_name?: string, user_id?: string) =>
    requestApi<DonVi>(`/api/don-vi/${id}/toggle-status`, 'POST', { trang_thai, ly_do, actor_name, user_id }, 'toggle_don_vi_status', { id, trang_thai, ly_do, actor_name, user_id }),

  batchImportDonVi: (items: any[], actor_name?: string, user_id?: string) =>
    requestApi<{ success: boolean; importedCount: number; errorCount: number; errors: string[]; imported: DonVi[] }>('/api/don-vi/batch-import', 'POST', { items, actor_name, user_id }, 'batch_import_don_vi', { items, actor_name, user_id }),

  getDonViRelations: (id: string) =>
    requestApi<{ chuongTrinhCount: number; donThuCount: number; childrenCount: number; history: NhatKy[] }>(`/api/don-vi/${id}/relations`, 'GET', undefined, 'get_don_vi_relations', { id }),

  getAppInfo: () =>
    requestApi<AppInfo>('/api/app-info', 'GET', undefined, 'get_app_info'),

  getAuditLogs: (limit = 50) =>
    requestApi<NhatKy[]>(`/api/audit-logs?limit=${limit}`, 'GET', undefined, 'get_audit_logs', { limit }),

  resetAiQuocUnits: async () => {
    localStorage.removeItem(MOCK_STORAGE_KEY);
    getMockDb();
    try {
      await fetch('/api/reset-data', { method: 'POST' });
    } catch {
      // ignore
    }
  },

  // ── Quản lý chương trình KT-GS ────────────────────────────────────────────
  getAllChuongTrinh: () =>
    requestApi<ChuongTrinhKtGs[]>('/api/chuong-trinh', 'GET', undefined, 'get_all_chuong_trinh'),

  createChuongTrinh: (input: CreateChuongTrinhInput) =>
    requestApi<ChuongTrinhKtGs>('/api/chuong-trinh', 'POST', { input }, 'create_chuong_trinh', { input }),

  updateChuongTrinh: (input: UpdateChuongTrinhInput) =>
    requestApi<ChuongTrinhKtGs>(`/api/chuong-trinh/${input.id}`, 'PUT', { input }, 'update_chuong_trinh', { input }),

  deleteChuongTrinh: (id: string) =>
    requestApi<void>(`/api/chuong-trinh/${id}`, 'DELETE', undefined, 'delete_chuong_trinh', { id }),

  addThayDoiBoSung: (input: ThayDoiBoSungKtGs) =>
    requestApi<ThayDoiBoSungKtGs>('/api/thay-doi-bo-sung', 'POST', { input }, 'add_thay_doi_bo_sung', { input }),

  deleteThayDoiBoSung: (chuong_trinh_id: string, thay_doi_id: string) =>
    requestApi<void>(`/api/thay-doi-bo-sung/${chuong_trinh_id}/${thay_doi_id}`, 'DELETE', undefined, 'delete_thay_doi_bo_sung', { chuong_trinh_id, thay_doi_id }),

  updateThayDoiBoSung: (input: ThayDoiBoSungKtGs) =>
    requestApi<ThayDoiBoSungKtGs>(`/api/thay-doi-bo-sung/${input.id}`, 'PUT', { input }, 'update_thay_doi_bo_sung', { input }),

  // ── Kho tệp PDF ───────────────────────────────────────────────────────────
  getAllPdfs: () =>
    requestApi<PdfKhoItem[]>('/api/pdfs', 'GET', undefined, 'get_all_pdfs'),

  createOrAttachPdf: (input: {
    ten_file: string;
    dung_luong: number;
    url?: string | null;
    chuong_trinh_id?: string | null;
    ghi_chu?: string | null;
    nguoi_tai_len?: string | null;
    nguon_goc?: 'CHUONG_TRINH' | 'THAY_DOI_BO_SUNG' | 'HO_SO_DIA_BAN' | 'KHO_PDF';
    don_vi_id?: string | null;
    ten_don_vi?: string | null;
  }) =>
    requestApi<PdfKhoItem>('/api/pdfs', 'POST', { input }, 'create_or_attach_pdf', { input }),

  deletePdf: (id: string) =>
    requestApi<void>(`/api/pdfs/${id}`, 'DELETE', undefined, 'delete_pdf', { id }),

  // ── Quản lý người dùng ────────────────────────────────────────────────────
  getAllUsers: () =>
    requestApi<User[]>('/api/users', 'GET', undefined, 'get_all_users'),

  createUser: (
    req: { ten_dang_nhap: string; ho_ten: string; mat_khau: string; vai_tro: string; chuc_danh?: string },
    actor_id: string,
    actor_name: string,
  ) =>
    requestApi<User>('/api/users', 'POST', { req, actor_id, actor_name }, 'create_user', { req, actor_id, actor_name }),

  resetUserPassword: (
    req: { user_id: string; mat_khau_moi: string },
    actor_id: string,
    actor_name: string,
  ) =>
    requestApi<void>('/api/users/reset-password', 'POST', { req, actor_id, actor_name }, 'reset_user_password', { req, actor_id, actor_name }),

  updateUser: (
    req: { user_id: string; ho_ten: string; vai_tro: string; trang_thai: number; chuc_danh?: string },
    actor_id: string,
    actor_name: string,
  ) =>
    requestApi<void>(`/api/users/${req.user_id}`, 'PUT', { req, actor_id, actor_name }, 'update_user', { req, actor_id, actor_name }),

  deleteUser: (user_id: string, actor_id: string, actor_name: string) =>
    requestApi<void>(`/api/users/${user_id}`, 'DELETE', { actor_id, actor_name }, 'delete_user', { user_id, actor_id, actor_name }),

  // ── Quản lý Đơn thư ────────────────────────────────────────────────────────
  getAllDonThu: () =>
    requestApi<DonThu[]>('/api/don-thu', 'GET', undefined, 'get_all_don_thu'),

  createDonThu: (input: Partial<DonThu>, actor_name?: string) =>
    requestApi<DonThu>('/api/don-thu', 'POST', { input, actor_name }, 'create_don_thu', { input, actor_name }),

  updateDonThu: (id: string, input: Partial<DonThu>, actor_name?: string) =>
    requestApi<DonThu>(`/api/don-thu/${id}`, 'PUT', { input, actor_name }, 'update_don_thu', { id, input, actor_name }),

  deleteDonThu: (id: string, actor_name?: string) =>
    requestApi<void>(`/api/don-thu/${id}`, 'DELETE', { actor_name }, 'delete_don_thu', { id, actor_name }),
};
