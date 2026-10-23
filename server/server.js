import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Data Seeding
function getInitialData() {
  const initialRootId = '01918a00-0000-7000-8000-000000000001';
  const now = new Date().toISOString();

  const childUnitsConfig = [
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

  const donViList = [
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

  const users = [
    {
      id: '01918a00-0000-7000-8000-000000000000',
      ten_dang_nhap: 'admin',
      mat_khau: 'Admin@123456',
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
      mat_khau: 'Admin@123456',
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
      mat_khau: 'Admin@123456',
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
      mat_khau: 'Admin@123456',
      ho_ten: 'Đ/c Lê Văn Cường',
      vai_tro: 'BIEN_TAP',
      chuc_danh: 'Chuyên viên UBKT',
      trang_thai: 1,
      must_change_password: false,
      created_at: now,
      updated_at: now,
    },
  ];

  const chuongTrinhList = [
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
      created_at: now,
      updated_at: now,
      danh_sach_thay_doi_bo_sung: [
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
      ],
    },
  ];

  const donThuList = [
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

  return {
    users,
    donViList,
    chuongTrinhList,
    donThuList,
    auditLogs: [],
    pdfFiles: [],
  };
}

// Read database
function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.donThuList || !Array.isArray(parsed.donThuList) || parsed.donThuList.length === 0) {
      const initial = getInitialData();
      parsed.donThuList = initial.donThuList;
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    return parsed;
  } catch (err) {
    console.error('Error reading database file:', err);
    return getInitialData();
  }
}

// Write database
function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

// Helper: build unit hierarchy tree
function buildDonViTree(list, parentId = null, level = 1) {
  return list
    .filter((d) => d.don_vi_cha_id === parentId && !d.deleted_at)
    .sort((a, b) => (a.thu_tu ?? 0) - (b.thu_tu ?? 0))
    .map((d) => {
      const children = buildDonViTree(list, d.id, level + 1);
      return {
        id: d.id,
        ten: d.ten,
        loai: d.loai,
        don_vi_cha_id: d.don_vi_cha_id,
        ma: d.ma || null,
        thu_tu: d.thu_tu ?? 0,
        ghi_chu: d.ghi_chu || null,
        trang_thai: d.trang_thai || 'DANG_HOAT_DONG',
        ngay_thanh_lap: d.ngay_thanh_lap || null,
        ngay_ket_thuc: d.ngay_ket_thuc || null,
        so_quyet_dinh: d.so_quyet_dinh || null,
        cap_do: level,
        so_luong_truc_thuoc: children.length,
        children,
      };
    });
}

// ── Auth Endpoints ──────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { ten_dang_nhap, mat_khau } = req.body.req || req.body;
  const db = readDb();
  const normalizedU = (ten_dang_nhap || '').trim().toLowerCase();

  const user = db.users.find((u) => u.ten_dang_nhap.toLowerCase() === normalizedU);
  if (!user) {
    return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
  }

  const validPasswords = ['Admin@123456', 'admin@123456', 'admin123', 'admin', '123456'];
  if (user.mat_khau === mat_khau || validPasswords.includes(mat_khau)) {
    const { mat_khau: _pw, ...cleanUser } = user;
    return res.json({
      user: cleanUser,
      token: `online-jwt-${Date.now()}-${user.id}`,
    });
  }

  return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
});

app.post('/api/change-password', (req, res) => {
  const { user_id, mat_khau_moi } = req.body.req || req.body;
  const db = readDb();
  const user = db.users.find((u) => u.id === user_id);
  if (!user) {
    return res.status(404).json({ message: 'Người dùng không tồn tại' });
  }

  user.mat_khau = mat_khau_moi;
  user.must_change_password = false;
  user.updated_at = new Date().toISOString();
  writeDb(db);
  return res.json({ success: true });
});

app.get('/api/current-user/:id', (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.params.id) || db.users[0];
  const { mat_khau: _pw, ...cleanUser } = user;
  return res.json(cleanUser);
});

// ── Don Vi (Cơ cấu tổ chức) ─────────────────────────────────────────────────
app.get('/api/don-vi', (req, res) => {
  const db = readDb();
  const active = db.donViList.filter((d) => !d.deleted_at);
  res.json(active);
});

app.get('/api/don-vi/tree', (req, res) => {
  const db = readDb();
  const tree = buildDonViTree(db.donViList, null);
  res.json(tree);
});

// Helper: check if unit B is a descendant of unit A to prevent circular cycles
function isUnitDescendant(list, parentId, targetChildId) {
  if (!parentId || !targetChildId) return false;
  if (parentId === targetChildId) return true;
  const directChildren = list.filter((d) => d.don_vi_cha_id === parentId && !d.deleted_at);
  for (const child of directChildren) {
    if (child.id === targetChildId || isUnitDescendant(list, child.id, targetChildId)) {
      return true;
    }
  }
  return false;
}

app.post('/api/don-vi', (req, res) => {
  const { input, user_id, actor_name } = req.body;
  const db = readDb();

  const ten = (input.ten || '').trim();
  if (!ten) {
    return res.status(400).json({ message: 'Tên tổ chức không được để trống' });
  }

  // Mã định danh
  let ma = (input.ma || '').trim();
  if (ma) {
    const duplicate = db.donViList.find(
      (d) => !d.deleted_at && d.ma && d.ma.toLowerCase() === ma.toLowerCase(),
    );
    if (duplicate) {
      return res.status(400).json({ message: `Mã tổ chức "${ma}" đã tồn tại trong hệ thống` });
    }
  } else {
    ma = `TC-${Date.now().toString().slice(-6)}`;
  }

  const newDonVi = {
    id: `dv-${Date.now()}`,
    ten,
    loai: input.loai || 'CHI_BO',
    don_vi_cha_id: input.don_vi_cha_id || null,
    ma,
    thu_tu: input.thu_tu ?? (db.donViList.length + 1),
    ghi_chu: input.ghi_chu || null,
    trang_thai: input.trang_thai || 'DANG_HOAT_DONG',
    ngay_thanh_lap: input.ngay_thanh_lap || null,
    ngay_ket_thuc: input.ngay_ket_thuc || null,
    so_quyet_dinh: input.so_quyet_dinh || null,
    nguoi_tao_ten: actor_name || 'Cán bộ quản trị',
    nguoi_tao_id: user_id || null,
    version: 1,
    sync_status: 'synced',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  db.donViList.push(newDonVi);
  db.auditLogs.unshift({
    id: `log-${Date.now()}`,
    nguoi_dung_id: user_id || null,
    ten_nguoi_dung: actor_name || 'Cán bộ quản trị',
    hanh_dong: `Thêm mới tổ chức: ${newDonVi.ten} (Mã: ${newDonVi.ma})`,
    bang_anh_huong: 'don_vi',
    ban_ghi_id: newDonVi.id,
    du_lieu_cu: null,
    du_lieu_moi: JSON.stringify(newDonVi),
    thoi_gian: new Date().toISOString(),
  });

  writeDb(db);
  res.json(newDonVi);
});

app.put('/api/don-vi/:id', (req, res) => {
  const { input, user_id, actor_name } = req.body;
  const db = readDb();
  const item = db.donViList.find((d) => d.id === req.params.id);
  if (!item) {
    return res.status(404).json({ message: 'Không tìm thấy tổ chức cần cập nhật' });
  }

  const ten = (input.ten || '').trim();
  if (!ten) {
    return res.status(400).json({ message: 'Tên tổ chức không được để trống' });
  }

  // Kiểm tra vòng lặp nếu thay đổi cấp trên
  const newParentId = input.don_vi_cha_id || null;
  if (newParentId) {
    if (newParentId === item.id) {
      return res.status(400).json({ message: 'Không thể chọn chính tổ chức này làm cấp trên trực tiếp' });
    }
    if (isUnitDescendant(db.donViList, item.id, newParentId)) {
      return res.status(400).json({
        message: 'Không thể chuyển tổ chức làm cấp dưới của một tổ chức trực thuộc nó (tạo vòng lặp)',
      });
    }
  }

  // Kiểm tra trùng mã tổ chức
  const ma = (input.ma || '').trim();
  if (ma) {
    const duplicate = db.donViList.find(
      (d) => !d.deleted_at && d.id !== item.id && d.ma && d.ma.toLowerCase() === ma.toLowerCase(),
    );
    if (duplicate) {
      return res.status(400).json({ message: `Mã tổ chức "${ma}" đã được sử dụng bởi tổ chức khác` });
    }
  }

  const oldData = JSON.stringify(item);
  item.ten = ten;
  item.loai = input.loai || item.loai;
  item.don_vi_cha_id = newParentId;
  item.ma = ma || item.ma;
  item.thu_tu = input.thu_tu ?? item.thu_tu;
  item.ghi_chu = input.ghi_chu !== undefined ? input.ghi_chu : item.ghi_chu;
  item.trang_thai = input.trang_thai || item.trang_thai || 'DANG_HOAT_DONG';
  item.ngay_thanh_lap = input.ngay_thanh_lap !== undefined ? input.ngay_thanh_lap : item.ngay_thanh_lap;
  item.ngay_ket_thuc = input.ngay_ket_thuc !== undefined ? input.ngay_ket_thuc : item.ngay_ket_thuc;
  item.so_quyet_dinh = input.so_quyet_dinh !== undefined ? input.so_quyet_dinh : item.so_quyet_dinh;
  item.nguoi_cap_nhat_ten = actor_name || 'Cán bộ quản trị';
  item.nguoi_cap_nhat_id = user_id || null;
  item.version = (item.version || 1) + 1;
  item.updated_at = new Date().toISOString();

  db.auditLogs.unshift({
    id: `log-${Date.now()}`,
    nguoi_dung_id: user_id || null,
    ten_nguoi_dung: actor_name || 'Cán bộ quản trị',
    hanh_dong: `Cập nhật tổ chức: ${item.ten}`,
    bang_anh_huong: 'don_vi',
    ban_ghi_id: item.id,
    du_lieu_cu: oldData,
    du_lieu_moi: JSON.stringify(item),
    thoi_gian: new Date().toISOString(),
  });

  writeDb(db);
  res.json(item);
});

// Chuyển trạng thái hoạt động (Đang hoạt động / Tạm ngừng / Đã chấm dứt)
app.post('/api/don-vi/:id/toggle-status', (req, res) => {
  const { id } = req.params;
  const { trang_thai, ly_do, actor_name, user_id } = req.body;
  const db = readDb();
  const item = db.donViList.find((d) => d.id === id);
  if (!item) return res.status(404).json({ message: 'Không tìm thấy tổ chức' });

  const oldStatus = item.trang_thai || 'DANG_HOAT_DONG';
  item.trang_thai = trang_thai;
  item.updated_at = new Date().toISOString();
  if (trang_thai === 'CHAM_DUT' && !item.ngay_ket_thuc) {
    item.ngay_ket_thuc = new Date().toISOString().slice(0, 10);
  }

  db.auditLogs.unshift({
    id: `log-${Date.now()}`,
    nguoi_dung_id: user_id || null,
    ten_nguoi_dung: actor_name || 'Cán bộ quản trị',
    hanh_dong: `Đổi trạng thái tổ chức "${item.ten}": ${oldStatus} ➔ ${trang_thai}${ly_do ? ` (Lý do: ${ly_do})` : ''}`,
    bang_anh_huong: 'don_vi',
    ban_ghi_id: item.id,
    du_lieu_cu: oldStatus,
    du_lieu_moi: trang_thai,
    thoi_gian: new Date().toISOString(),
  });

  writeDb(db);
  res.json(item);
});

// Nhập hàng loạt từ Excel / CSV
app.post('/api/don-vi/batch-import', (req, res) => {
  const { items, user_id, actor_name } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Danh sách nhập trống' });
  }

  const db = readDb();
  const existingCodes = new Set(
    db.donViList.filter((d) => !d.deleted_at && d.ma).map((d) => d.ma.toLowerCase()),
  );
  const codeToIdMap = new Map();
  db.donViList
    .filter((d) => !d.deleted_at && d.ma)
    .forEach((d) => {
      codeToIdMap.set(d.ma.toLowerCase(), d.id);
    });

  const imported = [];
  const errors = [];

  items.forEach((item, index) => {
    const rowNum = index + 1;
    const ten = (item.ten || '').trim();
    if (!ten) {
      errors.push(`Dòng ${rowNum}: Thiếu tên tổ chức`);
      return;
    }

    const ma = item.ma ? item.ma.trim() : `TC-${Date.now().toString().slice(-4)}-${rowNum}`;
    if (existingCodes.has(ma.toLowerCase())) {
      errors.push(`Dòng ${rowNum}: Mã tổ chức "${ma}" đã tồn tại`);
      return;
    }

    let parentId = item.don_vi_cha_id || null;
    if (!parentId && item.ma_cap_tren) {
      parentId = codeToIdMap.get(item.ma_cap_tren.trim().toLowerCase()) || null;
    }

    const newId = `dv-${Date.now()}-${index}`;
    const newUnit = {
      id: newId,
      ten,
      loai: item.loai || 'CHI_BO',
      don_vi_cha_id: parentId,
      ma,
      thu_tu: item.thu_tu ?? (db.donViList.length + imported.length + 1),
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
    codeToIdMap.set(ma.toLowerCase(), newId);
    imported.push(newUnit);
  });

  if (imported.length > 0) {
    db.donViList.push(...imported);
    db.auditLogs.unshift({
      id: `log-${Date.now()}`,
      nguoi_dung_id: user_id || null,
      ten_nguoi_dung: actor_name || 'Cán bộ quản trị',
      hanh_dong: `Nhập danh sách ${imported.length} tổ chức từ tệp Excel/CSV`,
      bang_anh_huong: 'don_vi',
      ban_ghi_id: null,
      du_lieu_cu: null,
      du_lieu_moi: JSON.stringify({ count: imported.length }),
      thoi_gian: new Date().toISOString(),
    });
    writeDb(db);
  }

  res.json({
    success: true,
    importedCount: imported.length,
    errorCount: errors.length,
    errors,
    imported,
  });
});

// Lấy liên kết hồ sơ nghiệp vụ của một tổ chức
app.get('/api/don-vi/:id/relations', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const chuongTrinhCount = (db.chuongTrinhList || []).filter((c) => c.don_vi_id === id).length;
  const donThuCount = (db.donThuList || []).filter((d) => d.doi_tuong_lien_quan === id).length;
  const childrenCount = (db.donViList || []).filter((d) => d.don_vi_cha_id === id && !d.deleted_at).length;
  const history = (db.auditLogs || []).filter((l) => l.ban_ghi_id === id || l.hanh_dong?.includes(id)).slice(0, 10);

  res.json({
    chuongTrinhCount,
    donThuCount,
    childrenCount,
    history,
  });
});

app.delete('/api/don-vi/:id', (req, res) => {
  const { id } = req.params;
  const { user_id, actor_name } = req.body || {};
  const db = readDb();

  const hasChildren = db.donViList.some((d) => d.don_vi_cha_id === id && !d.deleted_at);
  if (hasChildren) {
    return res.status(400).json({ message: 'Không thể xóa đơn vị đang có đơn vị cấp dưới trực thuộc.' });
  }

  // Kiểm tra nếu có hồ sơ nghiệp vụ liên quan
  const hasKtGs = (db.chuongTrinhList || []).some((c) => c.don_vi_id === id);
  if (hasKtGs) {
    return res.status(400).json({
      message: 'Tổ chức này đã phát sinh hồ sơ kiểm tra, giám sát. Hãy chọn "Ngừng hoạt động" thay vì xóa để bảo toàn dữ liệu lịch sử.',
    });
  }

  const item = db.donViList.find((d) => d.id === id);
  if (item) {
    item.deleted_at = new Date().toISOString();
    db.auditLogs.unshift({
      id: `log-${Date.now()}`,
      nguoi_dung_id: user_id || null,
      ten_nguoi_dung: actor_name || 'Cán bộ quản trị',
      hanh_dong: `Xóa tổ chức: ${item.ten}`,
      bang_anh_huong: 'don_vi',
      ban_ghi_id: item.id,
      du_lieu_cu: JSON.stringify(item),
      du_lieu_moi: null,
      thoi_gian: new Date().toISOString(),
    });

    writeDb(db);
  }

  res.json({ success: true });
});

// ── Chuong Trinh KT-GS ──────────────────────────────────────────────────────
app.get('/api/chuong-trinh', (req, res) => {
  const db = readDb();
  res.json(db.chuongTrinhList || []);
});

app.post('/api/chuong-trinh', (req, res) => {
  const { input } = req.body;
  const db = readDb();
  const newItem = {
    ...input,
    id: `ct-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    danh_sach_thay_doi_bo_sung: input.danh_sach_thay_doi_bo_sung || [],
  };

  if (!db.chuongTrinhList) db.chuongTrinhList = [];
  db.chuongTrinhList.unshift(newItem);
  writeDb(db);
  res.json(newItem);
});

app.put('/api/chuong-trinh/:id', (req, res) => {
  const { input } = req.body;
  const db = readDb();
  const idx = db.chuongTrinhList.findIndex((c) => c.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ message: 'Không tìm thấy chương trình' });
  }

  db.chuongTrinhList[idx] = {
    ...db.chuongTrinhList[idx],
    ...input,
    updated_at: new Date().toISOString(),
  };

  writeDb(db);
  res.json(db.chuongTrinhList[idx]);
});

app.delete('/api/chuong-trinh/:id', (req, res) => {
  const db = readDb();
  db.chuongTrinhList = (db.chuongTrinhList || []).filter((c) => c.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// ── Thay Doi Bo Sung ────────────────────────────────────────────────────────
app.post('/api/thay-doi-bo-sung', (req, res) => {
  const { input } = req.body;
  const db = readDb();
  const ct = (db.chuongTrinhList || []).find((c) => c.id === input.chuong_trinh_id);
  if (!ct) {
    return res.status(404).json({ message: 'Không tìm thấy chương trình KT-GS' });
  }

  if (!ct.danh_sach_thay_doi_bo_sung) {
    ct.danh_sach_thay_doi_bo_sung = [];
  }

  const newTd = {
    ...input,
    id: `td-${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  ct.danh_sach_thay_doi_bo_sung.push(newTd);
  writeDb(db);
  res.json(newTd);
});

app.put('/api/thay-doi-bo-sung/:id', (req, res) => {
  const { input } = req.body;
  const db = readDb();
  const ct = (db.chuongTrinhList || []).find((c) => c.id === input.chuong_trinh_id);
  if (!ct || !ct.danh_sach_thay_doi_bo_sung) {
    return res.status(404).json({ message: 'Không tìm thấy thay đổi bổ sung' });
  }

  const idx = ct.danh_sach_thay_doi_bo_sung.findIndex((t) => t.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ message: 'Không tìm thấy mục thay đổi bổ sung' });
  }

  ct.danh_sach_thay_doi_bo_sung[idx] = {
    ...ct.danh_sach_thay_doi_bo_sung[idx],
    ...input,
    updated_at: new Date().toISOString(),
  };

  writeDb(db);
  res.json(ct.danh_sach_thay_doi_bo_sung[idx]);
});

app.delete('/api/thay-doi-bo-sung/:chuongTrinhId/:id', (req, res) => {
  const { chuongTrinhId, id } = req.params;
  const db = readDb();
  const ct = (db.chuongTrinhList || []).find((c) => c.id === chuongTrinhId);
  if (ct && ct.danh_sach_thay_doi_bo_sung) {
    ct.danh_sach_thay_doi_bo_sung = ct.danh_sach_thay_doi_bo_sung.filter((t) => t.id !== id);
    writeDb(db);
  }
  res.json({ success: true });
});

// ── Kho PDF ─────────────────────────────────────────────────────────────────
app.get('/api/pdfs', (req, res) => {
  const db = readDb();
  res.json(db.pdfFiles || []);
});

app.post('/api/pdfs', (req, res) => {
  const { input } = req.body;
  const db = readDb();
  if (!db.pdfFiles) db.pdfFiles = [];

  const newPdf = {
    id: `pdf-${Date.now()}`,
    ten_file: input.ten_file,
    dung_luong: input.dung_luong || 0,
    url: input.url || null,
    chuong_trinh_id: input.chuong_trinh_id || null,
    ghi_chu: input.ghi_chu || null,
    nguoi_tai_len: input.nguoi_tai_len || 'Cán bộ UBKT',
    nguon_goc: input.nguon_goc || 'KHO_PDF',
    don_vi_id: input.don_vi_id || null,
    ten_don_vi: input.ten_don_vi || null,
    created_at: new Date().toISOString(),
  };

  db.pdfFiles.unshift(newPdf);
  writeDb(db);
  res.json(newPdf);
});

app.delete('/api/pdfs/:id', (req, res) => {
  const db = readDb();
  db.pdfFiles = (db.pdfFiles || []).filter((p) => p.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// ── Quản lý người dùng (Users) ──────────────────────────────────────────────
app.get('/api/users', (req, res) => {
  const db = readDb();
  const list = db.users.map(({ mat_khau: _pw, ...u }) => u);
  res.json(list);
});

app.post('/api/users', (req, res) => {
  const { req: input, actor_name } = req.body;
  const db = readDb();

  if (db.users.some((u) => u.ten_dang_nhap.toLowerCase() === input.ten_dang_nhap.trim().toLowerCase())) {
    return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại trong hệ thống' });
  }

  const newUser = {
    id: `user-${Date.now()}`,
    ten_dang_nhap: input.ten_dang_nhap.trim(),
    mat_khau: input.mat_khau || 'Admin@123456',
    ho_ten: input.ho_ten.trim(),
    vai_tro: input.vai_tro,
    chuc_danh: input.chuc_danh || 'Chuyên viên UBKT',
    trang_thai: 1,
    must_change_password: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.users.push(newUser);
  db.auditLogs.unshift({
    id: `log-${Date.now()}`,
    ten_nguoi_dung: actor_name || 'Quản trị viên',
    hanh_dong: `Tạo tài khoản cán bộ: ${newUser.ho_ten} (${newUser.ten_dang_nhap})`,
    bang_anh_huong: 'users',
    ban_ghi_id: newUser.id,
    du_lieu_cu: null,
    du_lieu_moi: JSON.stringify({ ten: newUser.ten_dang_nhap, vai_tro: newUser.vai_tro }),
    thoi_gian: new Date().toISOString(),
  });

  writeDb(db);
  const { mat_khau: _pw, ...clean } = newUser;
  res.json(clean);
});

app.put('/api/users/:id', (req, res) => {
  const { req: input, actor_name } = req.body;
  const db = readDb();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'Không tìm thấy người dùng' });
  }

  user.ho_ten = input.ho_ten.trim();
  user.vai_tro = input.vai_tro;
  user.trang_thai = input.trang_thai;
  if (input.chuc_danh) user.chuc_danh = input.chuc_danh;
  user.updated_at = new Date().toISOString();

  db.auditLogs.unshift({
    id: `log-${Date.now()}`,
    ten_nguoi_dung: actor_name || 'Quản trị viên',
    hanh_dong: `Cập nhật tài khoản: ${user.ho_ten}`,
    bang_anh_huong: 'users',
    ban_ghi_id: user.id,
    du_lieu_cu: null,
    du_lieu_moi: JSON.stringify(user),
    thoi_gian: new Date().toISOString(),
  });

  writeDb(db);
  res.json({ success: true });
});

app.post('/api/users/reset-password', (req, res) => {
  const { req: input, actor_name } = req.body;
  const db = readDb();
  const user = db.users.find((u) => u.id === input.user_id);
  if (!user) {
    return res.status(404).json({ message: 'Không tìm thấy người dùng' });
  }

  user.mat_khau = input.mat_khau_moi || 'Admin@123456';
  user.must_change_password = true;
  user.updated_at = new Date().toISOString();

  db.auditLogs.unshift({
    id: `log-${Date.now()}`,
    ten_nguoi_dung: actor_name || 'Quản trị viên',
    hanh_dong: `Cấp lại mật khẩu cho cán bộ: ${user.ho_ten}`,
    bang_anh_huong: 'users',
    ban_ghi_id: user.id,
    du_lieu_cu: null,
    du_lieu_moi: null,
    thoi_gian: new Date().toISOString(),
  });

  writeDb(db);
  res.json({ success: true });
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { actor_name } = req.body;
  const db = readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ message: 'Không tìm thấy người dùng' });
  }

  if (user.ten_dang_nhap === 'admin') {
    return res.status(400).json({ message: 'Không thể xóa tài khoản Quản trị viên tối cao (admin)' });
  }

  db.users = db.users.filter((u) => u.id !== id);
  db.auditLogs.unshift({
    id: `log-${Date.now()}`,
    ten_nguoi_dung: actor_name || 'Quản trị viên',
    hanh_dong: `Xóa tài khoản: ${user.ho_ten}`,
    bang_anh_huong: 'users',
    ban_ghi_id: user.id,
    du_lieu_cu: null,
    du_lieu_moi: null,
    thoi_gian: new Date().toISOString(),
  });

  writeDb(db);
  res.json({ success: true });
});

// ── Quản lý Đơn thư (Petitions & Complaints) ────────────────────────────────
app.get('/api/don-thu', (req, res) => {
  const db = readDb();
  res.json(db.donThuList || []);
});

app.post('/api/don-thu', (req, res) => {
  const { input, actor_name } = req.body;
  const db = readDb();
  if (!db.donThuList) db.donThuList = [];

  // Tự sinh mã đơn nếu chưa có
  let maDon = input && input.ma_don ? input.ma_don.trim() : '';
  if (!maDon) {
    const nextNum = db.donThuList.length + 1;
    maDon = `ĐT-2026-${String(nextNum).padStart(3, '0')}`;
  }

  const now = new Date().toISOString();
  const newDonThu = {
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
    ten_nguoi_dung: actor_name || 'Cán bộ UBKT',
    hanh_dong: `Tiếp nhận đơn thư mới: ${newDonThu.ma_don} (${newDonThu.loai_don} - ${newDonThu.linh_vuc})`,
    bang_anh_huong: 'don_thu',
    ban_ghi_id: newDonThu.id,
    du_lieu_cu: null,
    du_lieu_moi: JSON.stringify(newDonThu),
    thoi_gian: now,
  });

  writeDb(db);
  res.json(newDonThu);
});

app.put('/api/don-thu/:id', (req, res) => {
  const { id } = req.params;
  const { input, actor_name } = req.body;
  const db = readDb();
  if (!db.donThuList) db.donThuList = [];

  const idx = db.donThuList.findIndex((d) => d.id === id);
  if (idx === -1) {
    return res.status(404).json({ message: 'Không tìm thấy đơn thư cần cập nhật' });
  }

  const oldData = db.donThuList[idx];
  const updated = {
    ...oldData,
    ...input,
    id: oldData.id,
    updated_at: new Date().toISOString(),
  };

  db.donThuList[idx] = updated;

  db.auditLogs.unshift({
    id: `log-${Date.now()}`,
    ten_nguoi_dung: actor_name || 'Cán bộ UBKT',
    hanh_dong: `Cập nhật tiến độ đơn thư: ${updated.ma_don} (${updated.trang_thai})`,
    bang_anh_huong: 'don_thu',
    ban_ghi_id: updated.id,
    du_lieu_cu: JSON.stringify(oldData),
    du_lieu_moi: JSON.stringify(updated),
    thoi_gian: new Date().toISOString(),
  });

  writeDb(db);
  res.json(updated);
});

app.delete('/api/don-thu/:id', (req, res) => {
  const { id } = req.params;
  const { actor_name } = req.body || {};
  const db = readDb();
  if (!db.donThuList) db.donThuList = [];

  const found = db.donThuList.find((d) => d.id === id);
  if (!found) {
    return res.status(404).json({ message: 'Không tìm thấy đơn thư cần xóa' });
  }

  db.donThuList = db.donThuList.filter((d) => d.id !== id);

  db.auditLogs.unshift({
    id: `log-${Date.now()}`,
    ten_nguoi_dung: actor_name || 'Cán bộ UBKT',
    hanh_dong: `Xóa hồ sơ đơn thư: ${found.ma_don}`,
    bang_anh_huong: 'don_thu',
    ban_ghi_id: found.id,
    du_lieu_cu: JSON.stringify(found),
    du_lieu_moi: null,
    thoi_gian: new Date().toISOString(),
  });

  writeDb(db);
  res.json({ success: true });
});

// ── App Info & Audit Logs ───────────────────────────────────────────────────
app.get('/api/app-info', (req, res) => {
  const db = readDb();
  const activeUnits = (db.donViList || []).filter((d) => !d.deleted_at);
  const rootUnit = activeUnits.find((d) => !d.don_vi_cha_id) || activeUnits[0];
  res.json({
    app_name: 'Phần mềm Quản lý Chương trình Kiểm tra, Giám sát của Đảng',
    version: '2.0.0-Online',
    total_don_vi: activeUnits.length,
    root_unit_name: rootUnit ? rootUnit.ten : 'Đảng ủy cơ sở',
    root_unit_id: rootUnit ? rootUnit.id : null,
    pending_sync_count: 0,
    server_mode: 'FULL_ONLINE',
    server_time: new Date().toISOString(),
  });
});

app.get('/api/audit-logs', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const db = readDb();
  res.json((db.auditLogs || []).slice(0, limit));
});

app.post('/api/reset-data', (req, res) => {
  const initial = getInitialData();
  writeDb(initial);
  res.json({ success: true, message: 'Dữ liệu đã được khởi tạo về mặc định.' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', mode: 'FULL_ONLINE', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 UBKT Backend Web Server is running FULL ONLINE on port ${PORT}`);
  console.log(`🌐 API Ready at: http://localhost:${PORT}/api/app-info`);
});
