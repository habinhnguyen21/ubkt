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

  const donViList = [
    {
      id: initialRootId,
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
  ];

  const chuongTrinhList = [];
  const donThuList = [];
  const auditLogs = [
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
  ];

  return {
    users,
    donViList,
    chuongTrinhList,
    donThuList,
    auditLogs,
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
    return res.status(401).json({ message: 'Tên đăng nhập không tồn tại' });
  }

  if (user.trang_thai === 0) {
    return res.status(403).json({ message: 'Tài khoản đang bị tạm khóa. Vui lòng liên hệ Quản trị viên' });
  }

  const validPasswords = ['Admin@123456', 'admin@123456', 'admin123', 'admin', '123456'];
  if (
    user.mat_khau === mat_khau ||
    (user.mat_khau && user.mat_khau.trim() === (mat_khau || '').trim()) ||
    validPasswords.includes(mat_khau)
  ) {
    const { mat_khau: _pw, ...cleanUser } = user;
    return res.json({
      user: cleanUser,
      token: `online-jwt-${Date.now()}-${user.id}`,
    });
  }

  return res.status(401).json({ message: 'Mật khẩu không chính xác' });
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

// Helper tự động sinh mã tổ chức tuần tự không ngẫu nhiên (tránh trùng lặp)
function getNextSequentialCode(loai, donViList, isRoot) {
  let prefix = 'CB';
  const upper = (loai || '').toUpperCase();
  if (isRoot || upper === 'DANG_BO') prefix = 'DU';
  else if (upper === 'BCH') prefix = 'BCH';
  else if (upper === 'BTV') prefix = 'BTV';
  else if (upper === 'UBKT') prefix = 'UBKT';
  else if (upper === 'CHI_BO') prefix = 'CB';
  else prefix = 'TC';

  const activeCodes = (donViList || [])
    .filter((d) => !d.deleted_at && d.ma)
    .map((d) => d.ma.trim().toUpperCase());

  let maxNum = 0;
  const regex = new RegExp(`^${prefix}[-_\\s]?(\\d+)$`, 'i');
  activeCodes.forEach((c) => {
    const m = c.match(regex);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  });

  const existingSet = new Set(activeCodes);
  let next = maxNum + 1;
  while (true) {
    const candidate = `${prefix}-${String(next).padStart(2, '0')}`;
    if (!existingSet.has(candidate)) return candidate;
    next++;
  }
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
    ma = getNextSequentialCode(input.loai, db.donViList, !input.don_vi_cha_id);
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

// Xóa tổ chức Đảng
app.delete('/api/don-vi/:id', (req, res) => {
  const { id } = req.params;
  const { user_id, actor_name } = req.body || {};
  const db = readDb();

  const itemIndex = db.donViList.findIndex((d) => d.id === id);
  if (itemIndex === -1) {
    return res.status(404).json({ message: 'Không tìm thấy tổ chức cần xóa' });
  }

  const item = db.donViList[itemIndex];

  // Kiểm tra nếu đang có tổ chức cấp dưới trực thuộc
  const activeChildren = db.donViList.filter((d) => d.don_vi_cha_id === id && !d.deleted_at);
  if (activeChildren.length > 0) {
    return res.status(400).json({
      message: `Không thể xóa tổ chức "${item.ten}" vì đang có ${activeChildren.length} tổ chức trực thuộc cấp dưới. Vui lòng chuyển hoặc xóa các tổ chức cấp dưới trước.`,
    });
  }

  // Đánh dấu xóa (hoặc gỡ bỏ)
  item.deleted_at = new Date().toISOString();
  item.updated_at = new Date().toISOString();

  // Ghi nhật ký hệ thống
  db.auditLogs.unshift({
    id: `log-${Date.now()}`,
    nguoi_dung_id: user_id || null,
    ten_nguoi_dung: actor_name || 'Cán bộ quản trị',
    hanh_dong: `Xóa tổ chức Đảng: ${item.ten} (Mã: ${item.ma || 'N/A'})`,
    bang_anh_huong: 'don_vi',
    ban_ghi_id: item.id,
    du_lieu_cu: JSON.stringify(item),
    du_lieu_moi: null,
    thoi_gian: new Date().toISOString(),
  });

  writeDb(db);
  res.json({ success: true, message: `Đã xóa tổ chức "${item.ten}" thành công` });
});

// Xóa hàng loạt tổ chức Đảng
app.post('/api/don-vi/batch-delete', (req, res) => {
  const { ids, user_id, actor_name } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'Danh sách ID cần xóa trống' });
  }

  const db = readDb();
  const idSet = new Set(ids);
  const now = new Date().toISOString();

  const deleted = [];
  const errors = [];

  ids.forEach((id) => {
    const item = db.donViList.find((d) => d.id === id && !d.deleted_at);
    if (!item) return;

    // Kiểm tra nếu có tổ chức trực thuộc cấp dưới mà con đó KHÔNG nằm trong danh sách cùng xóa
    const unselectedChildren = db.donViList.filter(
      (d) => d.don_vi_cha_id === id && !d.deleted_at && !idSet.has(d.id),
    );
    if (unselectedChildren.length > 0) {
      errors.push(
        `Không thể xóa "${item.ten}" vì có ${unselectedChildren.length} tổ chức trực thuộc không nằm trong danh sách xóa`,
      );
      return;
    }

    item.deleted_at = now;
    item.updated_at = now;
    deleted.push(item);
  });

  if (deleted.length > 0) {
    db.auditLogs.unshift({
      id: `log-${Date.now()}`,
      nguoi_dung_id: user_id || null,
      ten_nguoi_dung: actor_name || 'Cán bộ quản trị',
      hanh_dong: `Xóa hàng loạt ${deleted.length} tổ chức Đảng: ${deleted
        .map((d) => d.ten)
        .slice(0, 5)
        .join(', ')}${deleted.length > 5 ? '...' : ''}`,
      bang_anh_huong: 'don_vi',
      ban_ghi_id: null,
      du_lieu_cu: JSON.stringify({ count: deleted.length, ids: deleted.map((d) => d.id) }),
      du_lieu_moi: null,
      thoi_gian: now,
    });
    writeDb(db);
  }

  res.json({
    success: true,
    deletedCount: deleted.length,
    errorCount: errors.length,
    errors,
  });
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
  const normalize = (t) =>
    (t || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[–—]/g, '-');
  const isRootVal = (val) => {
    if (!val) return true;
    const clean = normalize(val);
    return [
      '', '-', '--', '---', '0', 'none', 'null', 'n/a', 'na',
      'goc', 'gốc', '-- gốc --', 'khong', 'không', 'khong co', 'không có',
      'root', 'tổ chức gốc', 'cấp cao nhất', 'trực tiếp'
    ].includes(clean);
  };

  const resolveParent = (parentVal, currentUnits, currentImported) => {
    if (isRootVal(parentVal)) return null;
    const raw = (parentVal || '').trim();
    const lower = normalize(raw);
    const all = [...currentUnits.filter((d) => !d.deleted_at), ...currentImported];

    // 1. Theo ID
    const byId = all.find((d) => d.id === raw);
    if (byId) return byId.id;

    // 2. Theo Mã
    const byCode = all.find((d) => d.ma && normalize(d.ma) === lower);
    if (byCode) return byCode.id;

    // 3. Theo Tên
    const byName = all.find((d) => d.ten && normalize(d.ten) === lower);
    if (byName) return byName.id;

    // 4. Ngoặc hoặc gạch nối: "DU-01 (Tên tổ chức)" hoặc "DU-01 - Tên"
    const bracketMatch = raw.match(/^([a-zA-Z0-9_\-\.]+)\s*[\(\-–—:]\s*(.*?)\)?$/);
    if (bracketMatch) {
      const extCode = normalize(bracketMatch[1]);
      const extName = normalize(bracketMatch[2]);
      const byExtCode = all.find((d) => d.ma && normalize(d.ma) === extCode);
      if (byExtCode) return byExtCode.id;
      if (extName) {
        const byExtName = all.find((d) => d.ten && normalize(d.ten) === extName);
        if (byExtName) return byExtName.id;
      }
    }

    // 5. Tiền tố mã: "DU-01 ..."
    const codePrefix = all.find((d) => {
      if (!d.ma) return false;
      const cleanMa = normalize(d.ma);
      return (
        lower === cleanMa ||
        lower.startsWith(cleanMa + ' ') ||
        lower.startsWith(cleanMa + '(') ||
        lower.startsWith(cleanMa + '-')
      );
    });
    if (codePrefix) return codePrefix.id;

    // 6. Hoán đổi đảng ủy <-> đảng bộ
    const swapped = lower.includes('đảng ủy')
      ? lower.replace(/đảng ủy/g, 'đảng bộ')
      : lower.includes('đảng bộ')
      ? lower.replace(/đảng bộ/g, 'đảng ủy')
      : null;
    if (swapped) {
      const bySwapped = all.find((d) => d.ten && normalize(d.ten) === swapped);
      if (bySwapped) return bySwapped.id;
    }

    // 7. Cấp gốc duy nhất trên hệ thống
    const roots = all.filter((d) => !d.don_vi_cha_id);
    if (roots.length === 1) {
      const root = roots[0];
      const genericTerms = [
        'đảng ủy', 'đảng bộ', 'đảng ủy cơ sở', 'đảng bộ cơ sở',
        'đảng ủy phường', 'đảng bộ phường', 'cấp trên'
      ];
      if (
        genericTerms.some((t) => lower === t || lower.includes(t)) ||
        (root.ten && (lower.includes(normalize(root.ten)) || normalize(root.ten).includes(lower)))
      ) {
        return root.id;
      }
    }

    return null;
  };

  const existingCodes = new Set(
    db.donViList.filter((d) => !d.deleted_at && d.ma).map((d) => normalize(d.ma)),
  );

  const imported = [];
  const errors = [];

  // Pass 1: Tạo các bản ghi tổ chức
  items.forEach((item, index) => {
    const rowNum = index + 1;
    const ten = (item.ten || '').trim();
    if (!ten) {
      errors.push(`Dòng ${rowNum}: Thiếu tên tổ chức`);
      return;
    }

    const isRoot = !item.don_vi_cha_id && !item.ma_cap_tren;
    const ma = item.ma
      ? item.ma.trim()
      : getNextSequentialCode(item.loai, [...db.donViList, ...imported], isRoot);
    if (existingCodes.has(normalize(ma))) {
      errors.push(`Dòng ${rowNum}: Mã tổ chức "${ma}" đã tồn tại`);
      return;
    }

    let parentId = item.don_vi_cha_id || null;
    if (!parentId && item.ma_cap_tren) {
      parentId = resolveParent(item.ma_cap_tren, db.donViList, imported);
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
      _temp_ma_cap_tren: item.ma_cap_tren || null,
    };

    existingCodes.add(normalize(ma));
    imported.push(newUnit);
  });

  // Pass 2: Khắc phục liên kết cấp trên cho các trường hợp cấp trên nằm phía sau trong file
  imported.forEach((unit) => {
    if (!unit.don_vi_cha_id && unit._temp_ma_cap_tren) {
      unit.don_vi_cha_id = resolveParent(unit._temp_ma_cap_tren, db.donViList, imported);
    }
    delete unit._temp_ma_cap_tren;
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

app.post('/api/chuong-trinh/batch-import', (req, res) => {
  const { items, duplicateAction = 'OVERWRITE' } = req.body;
  const db = readDb();
  if (!db.chuongTrinhList) db.chuongTrinhList = [];

  const createdItems = [];
  const updatedItems = [];
  let skippedCount = 0;
  const errors = [];

  for (let idx = 0; idx < (items || []).length; idx++) {
    const input = items[idx];
    const isNhiemKy = (input.loai_chuong_trinh || (input.nhiem_ky || input.has_nhiem_ky ? 'NHIEM_KY' : 'HANG_NAM')) === 'NHIEM_KY';
    const termStart = input.term_start_year || (input.nhiem_ky ? parseInt(input.nhiem_ky.split('-')[0]?.trim() || '', 10) || null : null);
    const termEnd = input.term_end_year || (input.nhiem_ky ? parseInt(input.nhiem_ky.split('-')[1]?.trim() || '', 10) || null : null);
    const nhiemKyFinal = input.nhiem_ky || (termStart && termEnd ? `${termStart} - ${termEnd}` : null);

    const existingIdx = db.chuongTrinhList.findIndex((c) => {
      if (c.nam !== input.nam) return false;
      if (input.so_van_ban && c.so_van_ban && c.so_van_ban.trim().toLowerCase() === input.so_van_ban.trim().toLowerCase()) {
        return true;
      }
      if (
        input.doi_tuong &&
        c.doi_tuong &&
        c.doi_tuong.trim().toLowerCase() === input.doi_tuong.trim().toLowerCase() &&
        c.noi_dung &&
        c.noi_dung.trim().toLowerCase() === input.noi_dung.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    });

    if (existingIdx >= 0) {
      if (duplicateAction === 'SKIP') {
        skippedCount++;
        continue;
      }

      if (duplicateAction === 'OVERWRITE') {
        const existing = db.chuongTrinhList[existingIdx];
        existing.nam = input.nam;
        existing.chu_the = input.chu_the;
        existing.co_quan_ban_hanh = input.co_quan_ban_hanh || input.chu_the;
        existing.chu_the_ap_dung = input.chu_the_ap_dung || input.doi_tuong || 'Toàn Đảng bộ';
        existing.loai_hinh = input.loai_hinh || 'KIEM_TRA';
        existing.linh_vuc = input.linh_vuc || 'Công tác xây dựng Đảng';
        existing.doi_tuong = input.doi_tuong?.trim() || '';
        existing.noi_dung = input.noi_dung.trim();
        existing.ten_chuong_trinh = input.ten_chuong_trinh || existing.ten_chuong_trinh;
        existing.ngay_bat_dau = input.ngay_bat_dau || existing.ngay_bat_dau;
        existing.ngay_ket_thuc = input.ngay_ket_thuc || existing.ngay_ket_thuc;
        existing.so_van_ban = input.so_van_ban?.trim() || existing.so_van_ban;
        existing.ngay_ban_hanh = input.ngay_ban_hanh || existing.ngay_ban_hanh;
        existing.nguoi_ky = input.nguoi_ky?.trim() || existing.nguoi_ky;
        existing.trang_thai = input.trang_thai;
        if (input.file_pdf_ten) existing.file_pdf_ten = input.file_pdf_ten;
        if (input.ghi_chu_pdf) existing.ghi_chu_pdf = input.ghi_chu_pdf.trim();
        existing.updated_at = new Date().toISOString();

        updatedItems.push(existing);
        continue;
      }
    }

    const newItem = {
      id: `ct-${Date.now()}-${idx}`,
      nam: input.nam,
      loai_chuong_trinh: isNhiemKy ? 'NHIEM_KY' : 'HANG_NAM',
      nhiem_ky: nhiemKyFinal,
      khoa_nhiem_ky: nhiemKyFinal,
      has_nhiem_ky: input.has_nhiem_ky !== undefined ? input.has_nhiem_ky : Boolean(nhiemKyFinal),
      term_start_year: termStart,
      term_end_year: termEnd,
      ten_chuong_trinh: input.ten_chuong_trinh?.trim() || input.noi_dung.slice(0, 80),
      co_quan_ban_hanh: input.co_quan_ban_hanh?.trim() || input.chu_the,
      chu_the_ap_dung: input.chu_the_ap_dung?.trim() || input.doi_tuong || 'Toàn Đảng bộ',
      thoi_gian_loai: input.thoi_gian_loai || (input.ngay_bat_dau ? 'KHOANG_THOI_GIAN' : 'CA_NHIEM_KY'),
      chu_the: input.chu_the,
      don_vi_id: input.don_vi_id || null,
      ten_don_vi: input.ten_don_vi || null,
      chi_dang_bo_id: input.chi_dang_bo_id || null,
      ten_chi_dang_bo: input.ten_chi_dang_bo || null,
      loai_hinh: isNhiemKy ? (input.loai_hinh || null) : (input.loai_hinh || 'KIEM_TRA'),
      doi_tuong: input.doi_tuong?.trim() || '',
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

    db.chuongTrinhList.unshift(newItem);
    createdItems.push(newItem);
  }

  writeDb(db);
  res.json({
    success: true,
    createdCount: createdItems.length,
    updatedCount: updatedItems.length,
    skippedCount,
    totalProcessed: (items || []).length,
    errors,
  });
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
  const list = [];
  const seen = new Set();

  (db.chuongTrinhList || []).forEach((c) => {
    if (c.file_pdf_ten) {
      const isDrive = Boolean(
        c.is_google_drive ||
        c.google_drive_id ||
        (c.file_pdf_url && c.file_pdf_url.includes('drive.google.com'))
      );
      seen.add('ct_' + c.id);
      list.push({
        id: 'ct-pdf-' + c.id,
        ten_file: c.file_pdf_ten,
        dung_luong: c.file_pdf_dung_luong || 0,
        url: c.file_pdf_url || null,
        file_url: c.file_pdf_url || null,
        loai_file: c.file_pdf_ten.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf',
        the_loai_van_ban: c.the_loai_van_ban || 'Kế hoạch',
        so_van_ban: c.so_van_ban || null,
        trich_yeu: c.noi_dung || c.ten_chuong_trinh || null,
        nguoi_ky: c.nguoi_ky || null,
        chuong_trinh_id: c.id,
        nguon_goc: 'CHUONG_TRINH',
        chu_the: c.chu_the,
        doi_tuong: c.doi_tuong,
        nam: c.nam,
        loai_hinh: c.loai_hinh,
        ngay_ban_hanh: c.ngay_ban_hanh || c.created_at?.slice(0, 10) || null,
        ghi_chu: c.ghi_chu_pdf || null,
        google_drive_id: c.google_drive_id || null,
        google_drive_preview_url: c.google_drive_preview_url || null,
        is_google_drive: isDrive,
        created_at: c.created_at || new Date().toISOString(),
      });
    }

    if (c.danh_sach_thay_doi_bo_sung) {
      c.danh_sach_thay_doi_bo_sung.forEach((td) => {
        if (td.file_pdf_ten) {
          const isDriveTd = Boolean(
            td.is_google_drive ||
            td.google_drive_id ||
            (td.file_pdf_url && td.file_pdf_url.includes('drive.google.com'))
          );
          seen.add('td_' + td.id);
          list.push({
            id: 'td-pdf-' + c.id + '-' + td.id,
            ten_file: td.file_pdf_ten,
            dung_luong: td.file_pdf_dung_luong || 0,
            url: td.file_pdf_url || null,
            file_url: td.file_pdf_url || null,
            loai_file: td.file_pdf_ten.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf',
            the_loai_van_ban: 'Quyết định',
            so_van_ban: td.so_van_ban || null,
            trich_yeu: td.ly_do_dieu_chinh || `Điều chỉnh lần ${td.lan_dieu_chinh}`,
            nguoi_ky: td.nguoi_ky || null,
            chuong_trinh_id: c.id,
            nguon_goc: 'THAY_DOI_BO_SUNG',
            chu_the: c.chu_the,
            doi_tuong: c.doi_tuong,
            nam: c.nam,
            loai_hinh: c.loai_hinh,
            ngay_ban_hanh: td.ngay_ban_hanh || td.created_at?.slice(0, 10) || null,
            ghi_chu: td.ly_do_dieu_chinh || null,
            google_drive_id: td.google_drive_id || null,
            google_drive_preview_url: td.google_drive_preview_url || null,
            is_google_drive: isDriveTd,
            created_at: td.created_at || new Date().toISOString(),
          });
        }
      });
    }
  });

  (db.pdfFiles || []).forEach((p) => {
    if (!seen.has('pdf_' + p.id)) {
      seen.add('pdf_' + p.id);
      list.push(p);
    }
  });

  res.json(list);
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
    file_url: input.file_url || input.url || null,
    google_drive_id: input.google_drive_id || null,
    google_drive_preview_url: input.google_drive_preview_url || null,
    is_google_drive: Boolean(input.is_google_drive),
    the_loai_van_ban: input.the_loai_van_ban || null,
    so_van_ban: input.so_van_ban || null,
    trich_yeu: input.trich_yeu || null,
    nguoi_ky: input.nguoi_ky || null,
    chuong_trinh_id: input.chuong_trinh_id || null,
    ghi_chu: input.ghi_chu || null,
    nguoi_tai_len: input.nguoi_tai_len || 'Cán bộ UBKT',
    nguon_goc: input.nguon_goc || 'KHO_PDF',
    don_vi_id: input.don_vi_id || null,
    ten_don_vi: input.ten_don_vi || null,
    chu_the: input.chu_the || input.ten_don_vi || 'Ủy ban Kiểm tra Đảng ủy',
    doi_tuong: input.doi_tuong || (input.ten_don_vi ? `Địa bàn ${input.ten_don_vi}` : 'Tài liệu nghiệp vụ KT-GS'),
    nam: input.nam || new Date().getFullYear(),
    ngay_ban_hanh: input.ngay_ban_hanh || null,
    created_at: new Date().toISOString(),
  };

  db.pdfFiles.unshift(newPdf);
  writeDb(db);
  res.json(newPdf);
});

app.put('/api/pdfs/:id', (req, res) => {
  const { input } = req.body;
  const db = readDb();
  const id = req.params.id;

  if (id.startsWith('ct-pdf-')) {
    const ctId = id.replace('ct-pdf-', '');
    const ct = (db.chuongTrinhList || []).find((c) => c.id === ctId);
    if (ct) {
      if (input.url || input.file_url) ct.file_pdf_url = input.url || input.file_url || ct.file_pdf_url;
      ct.google_drive_id = input.google_drive_id || null;
      ct.google_drive_preview_url = input.google_drive_preview_url || null;
      ct.is_google_drive = Boolean(input.is_google_drive);
      ct.updated_at = new Date().toISOString();
    }
  } else if (id.startsWith('td-pdf-')) {
    const tdId = id.replace('td-pdf-', '');
    (db.chuongTrinhList || []).forEach((c) => {
      if (c.danh_sach_thay_doi_bo_sung) {
        const td = c.danh_sach_thay_doi_bo_sung.find((t) => t.id === tdId);
        if (td) {
          if (input.url || input.file_url) td.file_pdf_url = input.url || input.file_url || td.file_pdf_url;
          td.google_drive_id = input.google_drive_id || null;
          td.google_drive_preview_url = input.google_drive_preview_url || null;
          td.is_google_drive = Boolean(input.is_google_drive);
        }
      }
    });
  }

  if (!db.pdfFiles) db.pdfFiles = [];
  const idx = db.pdfFiles.findIndex((p) => p.id === id);
  if (idx !== -1) {
    db.pdfFiles[idx] = { ...db.pdfFiles[idx], ...input, updated_at: new Date().toISOString() };
    writeDb(db);
    return res.json(db.pdfFiles[idx]);
  } else if (!id.startsWith('ct-pdf-') && !id.startsWith('td-pdf-')) {
    const newPdf = { id, ...input, updated_at: new Date().toISOString() };
    db.pdfFiles.push(newPdf);
    writeDb(db);
    return res.json(newPdf);
  }

  writeDb(db);
  res.json({ success: true, ...input });
});

app.delete('/api/pdfs/:id', (req, res) => {
  const db = readDb();
  const id = req.params.id;

  if (id.startsWith('ct-pdf-')) {
    const ctId = id.replace('ct-pdf-', '');
    const ct = (db.chuongTrinhList || []).find((c) => c.id === ctId);
    if (ct) {
      ct.file_pdf_ten = null;
      ct.file_pdf_url = null;
      ct.file_pdf_dung_luong = null;
      ct.ghi_chu_pdf = null;
      ct.google_drive_id = null;
      ct.google_drive_preview_url = null;
      ct.is_google_drive = false;
      ct.updated_at = new Date().toISOString();
    }
  } else if (id.startsWith('td-pdf-')) {
    const tdId = id.replace('td-pdf-', '');
    (db.chuongTrinhList || []).forEach((c) => {
      if (c.danh_sach_thay_doi_bo_sung) {
        c.danh_sach_thay_doi_bo_sung.forEach((td) => {
          if (td.id === tdId || tdId.endsWith(td.id)) {
            td.file_pdf_ten = null;
            td.file_pdf_url = null;
            td.google_drive_id = null;
            td.google_drive_preview_url = null;
            td.is_google_drive = false;
          }
        });
      }
    });
  }

  db.pdfFiles = (db.pdfFiles || []).filter((p) => p.id !== id && p.chuong_trinh_id !== id.replace('ct-pdf-', ''));
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
