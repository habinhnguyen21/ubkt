import fs from 'node:fs';

let content = fs.readFileSync('src/services/api.ts', 'utf8');
const startIdx = content.indexOf('const DEFAULT_DON_THU_LIST: DonThu[] = [');
const endIdx = content.indexOf('function saveMockDb(db: MockDb)');

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `function getInitialProductionDb(): MockDb {
  const now = new Date().toISOString();
  return {
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
    ],
    donViList: [
      {
        id: '01918a00-0000-7000-8000-000000000001',
        ten: 'Đảng ủy cơ sở',
        loai: 'DANG_BO',
        don_vi_cha_id: null,
        ma: 'DU-01',
        thu_tu: 1,
        ghi_chu: 'Cơ quan lãnh đạo cao nhất của Đảng bộ cơ sở (Bấm chỉnh sửa để đổi tên theo đúng cơ quan thực tế)',
        version: 1,
        sync_status: 'synced',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
    ],
    chuongTrinhList: [],
    donThuList: [],
    auditLogs: [
      {
        id: 'log-init',
        nguoi_dung_id: '01918a00-0000-7000-8000-000000000000',
        ten_nguoi_dung: 'Quản trị viên',
        hanh_dong: 'Khởi tạo hệ thống dữ liệu chính thức',
        bang_anh_huong: 'system',
        ban_ghi_id: 'init',
        du_lieu_cu: null,
        du_lieu_moi: null,
        thoi_gian: now,
      },
    ],
    pdfFiles: [],
  };
}

function getMockDb(): MockDb {
  try {
    localStorage.removeItem('ubkt_mock_db');
    localStorage.removeItem('ubkt_phan_cong_dia_ban');
    localStorage.removeItem('ubkt_ho_so_dia_ban_records');
  } catch {
    // ignore
  }

  const raw = localStorage.getItem(MOCK_STORAGE_KEY);
  if (raw) {
    try {
      const parsed: MockDb = JSON.parse(raw);
      if (!parsed.users || parsed.users.length === 0) {
        parsed.users = getInitialProductionDb().users;
      }
      return parsed;
    } catch {
      // fallback
    }
  }

  const initial = getInitialProductionDb();
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

`;
  content = content.slice(0, startIdx) + replacement + content.slice(endIdx);
  fs.writeFileSync('src/services/api.ts', content, 'utf8');
  console.log('Successfully cleaned api.ts!');
} else {
  console.log('Markers not found:', startIdx, endIdx);
}
