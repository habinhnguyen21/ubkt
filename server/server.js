import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tự động đọc file .env ở thư mục gốc nếu có
const ENV_FILE = path.resolve(__dirname, '../.env');
if (fs.existsSync(ENV_FILE)) {
  try {
    const envLines = fs.readFileSync(ENV_FILE, 'utf-8').split(/\r?\n/);
    for (const line of envLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  } catch (err) {
    console.warn('Không thể đọc file .env:', err);
  }
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.trim().length < 16) {
  console.error(
    '❌ LỖI CẤU HÌNH BẢO MẬT: Biến môi trường JWT_SECRET là bắt buộc (tối thiểu 16 ký tự). Vui lòng tạo file .env từ .env.example và thiết lập JWT_SECRET trước khi chạy server!'
  );
  process.exit(1);
}
const JWT_EXPIRES_IN = '8h';

const BCRYPT_COST = 10;
const INITIAL_SEED_ADMIN_HASH =
  '$2b$10$oPqHubEEvKVDcP7UmBgqUu9FTfNn3abZbbi.kdAwgDPOqouEgxxve';

async function hashPasswordServer(plain) {
  return bcrypt.hash(String(plain), BCRYPT_COST);
}

async function verifyPasswordServer(plain, storedHash) {
  if (!plain || !storedHash) return false;
  if (
    storedHash.startsWith('$2a$') ||
    storedHash.startsWith('$2b$') ||
    storedHash.startsWith('$2y$')
  ) {
    return bcrypt.compare(String(plain), storedHash);
  }
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const saltHex = parts[2];
    const expectedHex = parts[3];
    if (!iterations || !saltHex || !expectedHex) return false;
    const derived = crypto.pbkdf2Sync(
      String(plain),
      Buffer.from(saltHex, 'hex'),
      iterations,
      32,
      'sha256'
    );
    const actualBuf = Buffer.from(derived.toString('hex'), 'utf8');
    const expectedBuf = Buffer.from(expectedHex, 'utf8');
    if (actualBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  }
  return false;
}

function stripUserSecrets(user) {
  if (!user) return user;
  const { mat_khau: _pw, mat_khau_hash: _hash, ...cleanUser } = user;
  return cleanUser;
}

function validatePasswordPolicy(password) {
  const pw = String(password || '');
  if (pw.length < 8) {
    return 'Mật khẩu phải có tối thiểu 8 ký tự.';
  }
  if (!/[A-Z]/.test(pw)) {
    return 'Mật khẩu phải chứa ít nhất 1 chữ cái viết hoa (A-Z).';
  }
  if (!/[a-z]/.test(pw)) {
    return 'Mật khẩu phải chứa ít nhất 1 chữ cái viết thường (a-z).';
  }
  if (!/[0-9]/.test(pw)) {
    return 'Mật khẩu phải chứa ít nhất 1 chữ số (0-9).';
  }
  return null;
}

const GENERIC_LOGIN_ERROR_MSG = 'Tên đăng nhập hoặc mật khẩu không chính xác';

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const SAMPLE_DB_FILE = path.join(DATA_DIR, 'database.sample.json');

// Bảo mật HTTP Headers với Helmet
app.use(helmet());

// Cấu hình CORS chỉ cho phép các origin trong biến môi trường ALLOWED_ORIGINS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép request cùng nguồn / server-to-server không có header Origin
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(
        new Error(`Origin ${origin} không nằm trong danh sách ALLOWED_ORIGINS được phép truy cập.`)
      );
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));

// Chống dò mật khẩu (Brute-force): tối đa 5 lần đăng nhập sai / 15 phút / IP + tên đăng nhập
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const bodyPayload = (req.body && (req.body.req || req.body)) || {};
    const username = String(bodyPayload.ten_dang_nhap || '')
      .trim()
      .toLowerCase();
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown-ip';
    return `${clientIp}:${username || 'anonymous'}`;
  },
  message: {
    message:
      'Tài khoản hoặc địa chỉ IP này đã nhập sai mật khẩu quá 5 lần. Vui lòng thử lại sau 15 phút.',
  },
});

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
      mat_khau_hash: INITIAL_SEED_ADMIN_HASH,
      ho_ten: 'Quản trị viên Hệ thống',
      vai_tro: 'ADMIN',
      chuc_danh: 'Chủ nhiệm UBKT',
      trang_thai: 1,
      must_change_password: true,
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
    diaBanRecords: [],
    hoSoDiaBanFiles: [],
    phanCongDiaBan: [],
  };
}

// Read database (tự động tạo database.json từ database.sample.json nếu chưa có)
function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      if (fs.existsSync(SAMPLE_DB_FILE)) {
        fs.copyFileSync(SAMPLE_DB_FILE, DB_FILE);
        const sampleContent = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(sampleContent);
      }
      const initial = getInitialData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.donThuList || !Array.isArray(parsed.donThuList) || parsed.donThuList.length === 0) {
      const initial = getInitialData();
      parsed.donThuList = initial.donThuList;
    }
    if (!parsed.diaBanRecords || !Array.isArray(parsed.diaBanRecords)) {
      parsed.diaBanRecords = [];
    }
    if (!parsed.hoSoDiaBanFiles || !Array.isArray(parsed.hoSoDiaBanFiles)) {
      parsed.hoSoDiaBanFiles = [];
    }
    if (!parsed.phanCongDiaBan || !Array.isArray(parsed.phanCongDiaBan)) {
      parsed.phanCongDiaBan = [];
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

// ── Middleware xác thực JWT & Phân quyền vai trò (RBAC) ───────────────────────
function authenticateJwt(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Yêu cầu đăng nhập: Thiếu mã xác thực phiên làm việc (Bearer Token).',
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Yêu cầu đăng nhập: Token xác thực trống.',
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    const isExpired = err && err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      message: isExpired
        ? 'Phiên đăng nhập đã hết hạn (8 giờ). Vui lòng đăng nhập lại.'
        : 'Mã xác thực phiên làm việc không hợp lệ hoặc đã bị giả mạo.',
    });
  }

  const userId = decoded && (decoded.sub || decoded.id);
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Thông tin định danh trong token không hợp lệ.',
    });
  }

  const db = readDb();
  const user = (db.users || []).find((u) => u.id === userId && u.trang_thai !== 0);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Tài khoản không tồn tại hoặc đã bị tạm khóa.',
    });
  }

  req.authUser = user;

  // Không bao giờ tin user_id, actor_id, actor_name hay vai_tro do client gửi lên
  if (req.body && typeof req.body === 'object') {
    req.body.user_id = user.id;
    req.body.actor_id = user.id;
    req.body.actor_name = user.ho_ten;
  }

  next();
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    const user = req.authUser;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập: Không tìm thấy thông tin phiên làm việc hợp lệ.',
      });
    }
    if (!allowedRoles.includes(user.vai_tro)) {
      return res.status(403).json({
        success: false,
        message: `Từ chối truy cập: Chức năng này yêu cầu quyền ${allowedRoles.join(' hoặc ')}.`,
      });
    }
    next();
  };
}

const requireAdmin = requireRoles('ADMIN');
const requireEditorOrAdmin = requireRoles('ADMIN', 'BIEN_TAP');

// Áp dụng verify JWT cho TẤT CẢ route /api trừ POST /api/login,
// đồng thời kiểm tra vai trò cho toàn bộ thao tác ghi/xóa/quản trị
app.use('/api', (req, res, next) => {
  if (req.path === '/login' && req.method === 'POST') {
    return next();
  }
  return authenticateJwt(req, res, (err) => {
    if (err) return next(err);

    // Các route chỉ dành riêng cho ADMIN
    const isAdminOnlyRoute =
      req.path.startsWith('/phan-cong-dia-ban') ||
      req.path === '/reset-data' ||
      (req.path.startsWith('/users') && req.method !== 'GET');

    if (isAdminOnlyRoute) {
      return requireAdmin(req, res, next);
    }

    // Đổi mật khẩu của chính mình: cho phép mọi tài khoản đã xác thực JWT
    if (req.path === '/change-password' && req.method === 'POST') {
      return next();
    }

    // Tất cả các route ghi / cập nhật / xóa dữ liệu khác yêu cầu ADMIN hoặc BIEN_TAP
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return requireEditorOrAdmin(req, res, next);
    }

    return next();
  });
});

// ── Auth Endpoints ──────────────────────────────────────────────────────────
app.post('/api/login', loginRateLimiter, async (req, res) => {
  try {
    const { ten_dang_nhap, mat_khau } = req.body.req || req.body || {};
    const db = readDb();
    const normalizedU = (ten_dang_nhap || '').trim().toLowerCase();

    const user = (db.users || []).find((u) => u.ten_dang_nhap.toLowerCase() === normalizedU);
    if (!user || !mat_khau) {
      return res.status(401).json({ message: GENERIC_LOGIN_ERROR_MSG });
    }

    if (user.trang_thai === 0) {
      return res.status(403).json({ message: 'Tài khoản đang bị tạm khóa. Vui lòng liên hệ Quản trị viên' });
    }

    let isValid = false;
    let needsMigrationSave = false;

    if (user.mat_khau_hash) {
      isValid = await verifyPasswordServer(mat_khau, user.mat_khau_hash);
      if (isValid && 'mat_khau' in user) {
        delete user.mat_khau;
        needsMigrationSave = true;
      }
    }

    // Migration: nếu tài khoản cũ vẫn lưu mat_khau dạng plaintext hoặc hash cũ trong trường mat_khau
    if (!isValid && user.mat_khau) {
      const legacyVal = String(user.mat_khau);
      if (
        legacyVal.startsWith('$2a$') ||
        legacyVal.startsWith('$2b$') ||
        legacyVal.startsWith('$2y$') ||
        legacyVal.startsWith('pbkdf2$')
      ) {
        isValid = await verifyPasswordServer(mat_khau, legacyVal);
      } else if (legacyVal === mat_khau) {
        isValid = true;
      }

      if (isValid) {
        user.mat_khau_hash = await hashPasswordServer(mat_khau);
        delete user.mat_khau;
        user.updated_at = new Date().toISOString();
        needsMigrationSave = true;
      }
    }

    if (!isValid) {
      return res.status(401).json({ message: GENERIC_LOGIN_ERROR_MSG });
    }

    if (needsMigrationSave) {
      writeDb(db);
    }

    const signedToken = jwt.sign(
      {
        sub: user.id,
        ten_dang_nhap: user.ten_dang_nhap,
        vai_tro: user.vai_tro,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      user: stripUserSecrets(user),
      token: signedToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Lỗi xử lý đăng nhập' });
  }
});

app.post('/api/change-password', async (req, res) => {
  try {
    const { mat_khau_cu, mat_khau_moi } = req.body.req || req.body || {};
    const db = readDb();
    // Chỉ cho phép đổi mật khẩu của chính người dùng đã xác thực trong JWT
    const authUserId = req.authUser.id;
    const user = (db.users || []).find((u) => u.id === authUserId);
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    const policyError = validatePasswordPolicy(mat_khau_moi);
    if (policyError) {
      return res.status(400).json({ message: policyError });
    }

    // Kiểm tra mật khẩu hiện tại
    if (user.mat_khau_hash || user.mat_khau) {
      let oldMatches = false;
      if (mat_khau_cu && user.mat_khau_hash) {
        oldMatches = await verifyPasswordServer(mat_khau_cu, user.mat_khau_hash);
      }
      if (!oldMatches && mat_khau_cu && user.mat_khau) {
        oldMatches =
          (await verifyPasswordServer(mat_khau_cu, String(user.mat_khau))) ||
          user.mat_khau === mat_khau_cu;
      }
      if (!oldMatches) {
        return res.status(400).json({ message: 'Mật khẩu hiện tại không chính xác' });
      }
    }

    user.mat_khau_hash = await hashPasswordServer(mat_khau_moi);
    delete user.mat_khau;
    user.must_change_password = false;
    user.updated_at = new Date().toISOString();
    writeDb(db);
    return res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ message: 'Lỗi khi đổi mật khẩu' });
  }
});

app.get('/api/current-user/:id', (req, res) => {
  return res.json(stripUserSecrets(req.authUser));
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

  // Tự động khởi tạo Hồ sơ địa bàn tương ứng cho tổ chức mới (1-1 bằng ID bất biến)
  if (!db.diaBanRecords) db.diaBanRecords = [];
  if (!db.diaBanRecords.some((r) => r.id === newDonVi.id)) {
    db.diaBanRecords.push({
      id: newDonVi.id,
      ten_dia_ban: newDonVi.ten,
      loai_to_chuc: newDonVi.loai,
      can_bo_phu_trach_id: null,
      can_bo_phu_trach_ten: 'Chưa phân công',
      can_bo_chuc_vu: '',
      thoi_gian_phan_cong: 'Chưa có',
      van_ban_phan_cong: 'Chưa ban hành',
      tinh_trang_bao_cao_thang: 'CHUA_NOP',
      thang_hien_tai: 'T10/2026',
      so_van_de_theo_doi: 0,
      danh_sach_van_de: [],
      so_chi_dao_chua_hoan_thanh: 0,
      danh_sach_chi_dao: [],
      thoi_diem_cap_nhat_gan_nhat: new Date().toISOString(),
      nguoi_cap_nhat_gan_nhat: actor_name || 'Hệ thống',
      so_luong_tai_lieu: 0,
      trang_thai_ho_so: 'DANG_THEO_DOI',
    });
  }

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

  // Đồng bộ cascade tên và loại sang hồ sơ địa bàn, tệp tài liệu và chương trình KT-GS
  if (!db.diaBanRecords) db.diaBanRecords = [];
  const dbRecord = db.diaBanRecords.find((r) => r.id === item.id);
  if (dbRecord) {
    dbRecord.ten_dia_ban = ten;
    dbRecord.loai_to_chuc = item.loai;
    dbRecord.thoi_diem_cap_nhat_gan_nhat = new Date().toISOString();
  }
  if (db.hoSoDiaBanFiles) {
    db.hoSoDiaBanFiles.filter((f) => f.don_vi_id === item.id).forEach((f) => {
      f.ten_don_vi = ten;
    });
  }
  if (db.chuongTrinhList) {
    db.chuongTrinhList.filter((c) => c.doi_tuong_don_vi_id === item.id).forEach((c) => {
      c.doi_tuong = ten;
    });
  }

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



// Helper nhận diện và phân loại chủ thể chuẩn xác: phân biệt rõ cấp Đảng ủy phường và cơ sở trực thuộc (trường học, chi bộ)
function detectChuThe(str, chuTheDonViId, donViList) {
  if (!str && !chuTheDonViId) {
    return {
      chuTheLoai: 'KHAC',
      capChuThe: 'CO_SO',
      chuTheDonViId: null,
    };
  }

  const s = (str || '').toLowerCase().trim();
  const activeUnits = (donViList || []).filter((d) => !d.deleted_at);
  const rootUnit = activeUnits.find((d) => !d.don_vi_cha_id);
  const rootId = rootUnit ? rootUnit.id : null;

  // 1. Nếu có ID đơn vị chủ thể cụ thể được truyền vào
  if (chuTheDonViId) {
    const found = activeUnits.find((d) => d.id === chuTheDonViId);
    if (found) {
      if (found.id === rootId) {
        if (s.includes('thường vụ') || s.includes('btv')) {
          return { chuTheLoai: 'BTV', capChuThe: 'PHUONG', chuTheDonViId: found.id };
        }
        if (s.includes('kiểm tra') || s.includes('ubkt')) {
          return { chuTheLoai: 'UBKT', capChuThe: 'PHUONG', chuTheDonViId: found.id };
        }
        return { chuTheLoai: 'BCH', capChuThe: 'PHUONG', chuTheDonViId: found.id };
      } else {
        if (s.includes('kiểm tra') || s.includes('ubkt')) {
          return { chuTheLoai: 'UBKT_CO_SO', capChuThe: 'CO_SO', chuTheDonViId: found.id };
        }
        if (found.loai === 'CHI_BO') {
          return { chuTheLoai: 'CHI_BO', capChuThe: 'CO_SO', chuTheDonViId: found.id };
        }
        return { chuTheLoai: 'BCH', capChuThe: 'CO_SO', chuTheDonViId: found.id };
      }
    }
  }

  // 2. Kiểm tra xem tên chủ thể có chứa tên của một tổ chức đảng trực thuộc (trường học, chi bộ) hay không
  const childUnits = activeUnits.filter((d) => d.don_vi_cha_id);
  for (const cu of childUnits) {
    const cuName = cu.ten.toLowerCase().trim();
    const cleanName = cuName.replace(/^(chi bộ|đảng bộ|đảng ủy|ủy ban kiểm tra|ubkt)\s+/i, '').trim();
    if (cleanName.length >= 3 && s.includes(cleanName)) {
      if (s.includes('kiểm tra') || s.includes('ubkt')) {
        return { chuTheLoai: 'UBKT_CO_SO', capChuThe: 'CO_SO', chuTheDonViId: cu.id };
      }
      if (cu.loai === 'CHI_BO') {
        return { chuTheLoai: 'CHI_BO', capChuThe: 'CO_SO', chuTheDonViId: cu.id };
      }
      return { chuTheLoai: 'BCH', capChuThe: 'CO_SO', chuTheDonViId: cu.id };
    }
  }

  // 3. Kiểm tra các từ khóa đặc thù trường học / chi bộ cấp dưới
  const isSchoolOrSubunit =
    s.includes('trường') ||
    s.includes('thcs') ||
    s.includes('thpt') ||
    s.includes('mầm non') ||
    s.includes('cao đẳng') ||
    s.includes('tiểu học') ||
    s.includes('doanh nghiệp') ||
    s.includes('hợp tác xã') ||
    s.includes('công an') ||
    s.includes('quân sự') ||
    s.includes('khu dân cư') ||
    s.includes('tổ dân phố') ||
    s.includes('tdp ');
  if (isSchoolOrSubunit) {
    if (s.includes('kiểm tra') || s.includes('ubkt')) {
      return { chuTheLoai: 'UBKT_CO_SO', capChuThe: 'CO_SO', chuTheDonViId: null };
    }
    return { chuTheLoai: 'BCH', capChuThe: 'CO_SO', chuTheDonViId: null };
  }

  // 4. Nếu là chủ thể cấp Đảng ủy phường (Ban Chấp hành, Ban Thường vụ, UBKT Đảng ủy phường)
  if (s.includes('thường vụ') || s.includes('btv')) {
    return { chuTheLoai: 'BTV', capChuThe: 'PHUONG', chuTheDonViId: rootId };
  }
  if (s.includes('kiểm tra') || s.includes('ubkt')) {
    return { chuTheLoai: 'UBKT', capChuThe: 'PHUONG', chuTheDonViId: rootId };
  }
  if (
    s.includes('chấp hành') ||
    s.includes('bch') ||
    s.includes('đảng bộ phường') ||
    s.includes('đảng ủy phường')
  ) {
    return { chuTheLoai: 'BCH', capChuThe: 'PHUONG', chuTheDonViId: rootId };
  }

  if (s.includes('chi bộ')) {
    return { chuTheLoai: 'CHI_BO', capChuThe: 'CO_SO', chuTheDonViId: null };
  }

  return { chuTheLoai: 'KHAC', capChuThe: 'CO_SO', chuTheDonViId: null };
}

// Helper đối chiếu đối tượng với danh mục tổ chức Đảng duy nhất
function resolveTargetDonVi(targetStr, targetId, donViList) {
  if (targetId) {
    const found = donViList.find((d) => !d.deleted_at && d.id === targetId);
    if (found) return { id: found.id, ten: found.ten, loai: 'TO_CHUC' };
  }
  if (!targetStr) return { id: null, ten: '', loai: 'TO_CHUC' };
  const s = targetStr.trim().toLowerCase();
  const found = donViList.find(
    (d) => !d.deleted_at && (d.ten.toLowerCase() === s || (d.ma && d.ma.toLowerCase() === s))
  );
  if (found) return { id: found.id, ten: found.ten, loai: 'TO_CHUC' };
  return { id: null, ten: targetStr.trim(), loai: 'DANG_VIEN' };
}

// ── Chuong Trinh KT-GS ──────────────────────────────────────────────────────
app.get('/api/chuong-trinh', (req, res) => {
  const db = readDb();
  res.json(db.chuongTrinhList || []);
});

app.post('/api/chuong-trinh', (req, res) => {
  const { input } = req.body;
  const db = readDb();

  const resolved = resolveTargetDonVi(input.doi_tuong, input.doi_tuong_don_vi_id, db.donViList || []);
  const detected = detectChuThe(input.chu_the, input.chu_the_don_vi_id, db.donViList || []);
  const chuTheLoai = input.chu_the_loai || detected.chuTheLoai;
  const capChuThe = input.cap_chu_the || detected.capChuThe;
  const chuTheDonViId = input.chu_the_don_vi_id || detected.chuTheDonViId;

  const newItem = {
    ...input,
    id: `ct-${Date.now()}`,
    chu_the_loai: chuTheLoai,
    cap_chu_the: capChuThe,
    chu_the_don_vi_id: chuTheDonViId,
    doi_tuong: resolved.ten || input.doi_tuong,
    doi_tuong_loai: input.doi_tuong_loai || resolved.loai,
    doi_tuong_don_vi_id: resolved.id || input.doi_tuong_don_vi_id || null,
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

  const existing = db.chuongTrinhList[idx];
  const resolved = resolveTargetDonVi(
    input.doi_tuong || existing.doi_tuong,
    input.doi_tuong_don_vi_id !== undefined ? input.doi_tuong_don_vi_id : existing.doi_tuong_don_vi_id,
    db.donViList || []
  );
  const detected = detectChuThe(
    input.chu_the || existing.chu_the,
    input.chu_the_don_vi_id !== undefined ? input.chu_the_don_vi_id : existing.chu_the_don_vi_id,
    db.donViList || []
  );
  const chuTheLoai = input.chu_the_loai || existing.chu_the_loai || detected.chuTheLoai;
  const capChuThe = input.cap_chu_the || existing.cap_chu_the || detected.capChuThe;
  const chuTheDonViId = input.chu_the_don_vi_id !== undefined ? input.chu_the_don_vi_id : (existing.chu_the_don_vi_id || detected.chuTheDonViId);

  db.chuongTrinhList[idx] = {
    ...existing,
    ...input,
    chu_the_loai: chuTheLoai,
    cap_chu_the: capChuThe,
    chu_the_don_vi_id: chuTheDonViId,
    doi_tuong: resolved.ten || input.doi_tuong || existing.doi_tuong,
    doi_tuong_loai: input.doi_tuong_loai || resolved.loai,
    doi_tuong_don_vi_id: resolved.id,
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

    const resolved = resolveTargetDonVi(input.doi_tuong, input.doi_tuong_don_vi_id, db.donViList || []);
    const detected = detectChuThe(input.chu_the, input.chu_the_don_vi_id, db.donViList || []);
    const chuTheLoai = input.chu_the_loai || detected.chuTheLoai;
    const capChuThe = input.cap_chu_the || detected.capChuThe;
    const chuTheDonViId = input.chu_the_don_vi_id || detected.chuTheDonViId;

    if (existingIdx >= 0) {
      if (duplicateAction === 'SKIP') {
        skippedCount++;
        continue;
      }

      if (duplicateAction === 'OVERWRITE') {
        const existing = db.chuongTrinhList[existingIdx];
        existing.nam = input.nam;
        existing.chu_the = input.chu_the;
        existing.chu_the_loai = chuTheLoai;
        existing.cap_chu_the = capChuThe;
        existing.chu_the_don_vi_id = chuTheDonViId;
        existing.co_quan_ban_hanh = input.co_quan_ban_hanh || input.chu_the;
        existing.chu_the_ap_dung = input.chu_the_ap_dung || input.doi_tuong || 'Toàn Đảng bộ';
        existing.loai_hinh = input.loai_hinh || 'KIEM_TRA';
        existing.linh_vuc = input.linh_vuc || 'Công tác xây dựng Đảng';
        existing.doi_tuong = resolved.ten || input.doi_tuong?.trim() || '';
        existing.doi_tuong_don_vi_id = resolved.id || input.doi_tuong_don_vi_id || null;
        existing.doi_tuong_loai = input.doi_tuong_loai || resolved.loai;
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
      chu_the_loai: chuTheLoai,
      cap_chu_the: capChuThe,
      chu_the_don_vi_id: chuTheDonViId,
      don_vi_id: resolved.id || input.don_vi_id || null,
      ten_don_vi: resolved.ten || input.ten_don_vi || null,
      chi_dang_bo_id: resolved.id || input.chi_dang_bo_id || null,
      ten_chi_dang_bo: resolved.ten || input.ten_chi_dang_bo || null,
      loai_hinh: isNhiemKy ? (input.loai_hinh || null) : (input.loai_hinh || 'KIEM_TRA'),
      doi_tuong: resolved.ten || input.doi_tuong?.trim() || '',
      doi_tuong_don_vi_id: resolved.id || input.doi_tuong_don_vi_id || null,
      doi_tuong_loai: input.doi_tuong_loai || resolved.loai,
      linh_vuc: input.linh_vuc || 'Công tác xây dựng Đảng',
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

// ── Endpoints Hồ Sơ Địa Bàn & Phân Công Địa Bàn Chuẩn Hóa ──────────────────
app.get('/api/dia-ban', (req, res) => {
  const db = readDb();
  const activeUnits = (db.donViList || []).filter((d) => !d.deleted_at);
  const unitMap = new Map(activeUnits.map((u) => [u.id, u]));
  if (!db.diaBanRecords) db.diaBanRecords = [];

  // Đảm bảo 1-1 với DonVi và tự động kế thừa tên mới nhất từ master danh mục
  const recordsMap = new Map(db.diaBanRecords.map((r) => [r.id, r]));
  activeUnits.forEach((u) => {
    const existing = recordsMap.get(u.id);
    if (existing) {
      existing.ten_dia_ban = u.ten;
      existing.loai_to_chuc = u.loai;
    } else {
      recordsMap.set(u.id, {
        id: u.id,
        ten_dia_ban: u.ten,
        loai_to_chuc: u.loai,
        can_bo_phu_trach_id: null,
        can_bo_phu_trach_ten: 'Chưa phân công',
        can_bo_chuc_vu: '',
        thoi_gian_phan_cong: 'Chưa có',
        van_ban_phan_cong: 'Chưa ban hành',
        tinh_trang_bao_cao_thang: 'CHUA_NOP',
        thang_hien_tai: 'T10/2026',
        so_van_de_theo_doi: 0,
        danh_sach_van_de: [],
        so_chi_dao_chua_hoan_thanh: 0,
        danh_sach_chi_dao: [],
        thoi_diem_cap_nhat_gan_nhat: new Date().toISOString(),
        nguoi_cap_nhat_gan_nhat: 'Hệ thống',
        so_luong_tai_lieu: 0,
        trang_thai_ho_so: u.trang_thai === 'CHAM_DUT' ? 'DA_KET_THUC' : 'DANG_THEO_DOI',
      });
    }
  });

  db.diaBanRecords = Array.from(recordsMap.values()).filter((r) => unitMap.has(r.id));
  writeDb(db);
  res.json(db.diaBanRecords);
});

app.post('/api/dia-ban', (req, res) => {
  const db = readDb();
  const { records } = req.body;
  if (Array.isArray(records)) {
    db.diaBanRecords = records;
    writeDb(db);
    return res.json({ success: true, count: records.length });
  }
  res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
});

app.put('/api/dia-ban/:id', (req, res) => {
  const db = readDb();
  const { record } = req.body;
  const id = req.params.id;
  if (!db.diaBanRecords) db.diaBanRecords = [];
  const idx = db.diaBanRecords.findIndex((r) => r.id === id);
  if (idx >= 0) {
    db.diaBanRecords[idx] = { ...db.diaBanRecords[idx], ...record, id };
  } else {
    db.diaBanRecords.push({ ...record, id });
  }
  writeDb(db);
  res.json(db.diaBanRecords.find((r) => r.id === id));
});

// ── Phân công địa bàn (Đã được bảo vệ bởi authenticateJwt + requireAdmin) ──
const requireAdminForPhanCong = requireAdmin;

app.get('/api/phan-cong-dia-ban', requireAdminForPhanCong, (req, res) => {
  const db = readDb();
  res.json(db.phanCongDiaBan || []);
});

app.post('/api/phan-cong-dia-ban', requireAdminForPhanCong, (req, res) => {
  const db = readDb();
  const { assignments, user_id, actor_name, action_info } = req.body;
  if (!Array.isArray(assignments)) {
    return res.status(400).json({ message: 'Danh sách phân công không hợp lệ' });
  }

  if (action_info && action_info.hanh_dong) {
    db.auditLogs = db.auditLogs || [];
    db.auditLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      nguoi_dung_id: user_id || null,
      ten_nguoi_dung: actor_name || 'Quản trị viên',
      hanh_dong: action_info.hanh_dong,
      bang_anh_huong: 'phan_cong_dia_ban',
      ban_ghi_id: 'phan_cong_dia_ban',
      du_lieu_cu: action_info.du_lieu_cu ? JSON.stringify(action_info.du_lieu_cu) : null,
      du_lieu_moi: action_info.du_lieu_moi ? JSON.stringify(action_info.du_lieu_moi) : null,
      thoi_gian: new Date().toISOString(),
    });
  }

  db.phanCongDiaBan = assignments;

  // Tự động đồng bộ sang diaBanRecords và ghi lịch sử phân công
  if (!db.diaBanRecords) db.diaBanRecords = [];
  const now = new Date().toISOString();
  const userMap = new Map((db.users || []).map((u) => [u.id, u]));

  const unitToAssign = new Map();
  assignments.forEach((as) => {
    const u = userMap.get(as.user_id);
    (as.don_vi_ids || []).forEach((uId) => {
      unitToAssign.set(uId, {
        userId: as.user_id,
        userName: u ? `Đ/c ${u.ho_ten}` : as.user_name || 'Cán bộ UBKT',
        chucVu: u?.chuc_danh || (u?.vai_tro === 'ADMIN' ? 'Chủ nhiệm UBKT' : 'Chuyên viên UBKT'),
        vanBan: as.so_quyet_dinh || as.ghi_chu || 'Quyết định phân công của UBKT',
      });
    });
  });

  db.diaBanRecords.forEach((r) => {
    const assignInfo = unitToAssign.get(r.id);
    if (assignInfo) {
      if (r.can_bo_phu_trach_id && r.can_bo_phu_trach_id !== assignInfo.userId) {
        if (!r.lich_su_phu_trach) r.lich_su_phu_trach = [];
        r.lich_su_phu_trach.unshift({
          id: `ls-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          can_bo_id: r.can_bo_phu_trach_id,
          can_bo_ten: r.can_bo_phu_trach_ten || 'Chưa rõ',
          can_bo_chuc_vu: r.can_bo_chuc_vu || '',
          tu_ngay: r.thoi_gian_phan_cong || 'Trước đó',
          den_ngay: new Date().toLocaleDateString('vi-VN'),
          van_ban_phan_cong: r.van_ban_phan_cong || '',
          ly_do_thay_doi: 'Điều chỉnh phân công địa bàn công tác',
          nguoi_thuc_hien: actor_name || 'Quản trị viên',
          created_at: now,
        });
      }
      r.can_bo_phu_trach_id = assignInfo.userId;
      r.can_bo_phu_trach_ten = assignInfo.userName;
      r.can_bo_chuc_vu = assignInfo.chucVu;
      r.thoi_gian_phan_cong = new Date().toLocaleDateString('vi-VN');
      r.van_ban_phan_cong = assignInfo.vanBan;
    } else {
      if (r.can_bo_phu_trach_id) {
        if (!r.lich_su_phu_trach) r.lich_su_phu_trach = [];
        r.lich_su_phu_trach.unshift({
          id: `ls-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          can_bo_id: r.can_bo_phu_trach_id,
          can_bo_ten: r.can_bo_phu_trach_ten || 'Chưa rõ',
          can_bo_chuc_vu: r.can_bo_chuc_vu || '',
          tu_ngay: r.thoi_gian_phan_cong || 'Trước đó',
          den_ngay: new Date().toLocaleDateString('vi-VN'),
          van_ban_phan_cong: r.van_ban_phan_cong || '',
          ly_do_thay_doi: 'Rút phân công địa bàn',
          nguoi_thuc_hien: actor_name || 'Quản trị viên',
          created_at: now,
        });
        r.can_bo_phu_trach_id = null;
        r.can_bo_phu_trach_ten = 'Chưa phân công';
        r.can_bo_chuc_vu = '';
      }
    }
  });

  writeDb(db);
  res.json({ success: true, assignments: db.phanCongDiaBan });
});

app.get('/api/ho-so-files', (req, res) => {
  const db = readDb();
  const donViId = req.query.don_vi_id;
  let files = db.hoSoDiaBanFiles || [];
  if (donViId) {
    files = files.filter((f) => f.don_vi_id === donViId);
  }
  res.json(files);
});

app.post('/api/ho-so-files', (req, res) => {
  const db = readDb();
  const file = req.body;
  if (!file || !file.don_vi_id) {
    return res.status(400).json({ message: 'Tệp phải gắn với mã đơn vị (don_vi_id) cụ thể' });
  }
  if (!db.hoSoDiaBanFiles) db.hoSoDiaBanFiles = [];
  const newFile = {
    id: file.id || `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    ...file,
    created_at: file.created_at || new Date().toISOString(),
  };
  db.hoSoDiaBanFiles.unshift(newFile);

  if (db.diaBanRecords) {
    const diaBan = db.diaBanRecords.find((r) => r.id === file.don_vi_id);
    if (diaBan) {
      diaBan.so_luong_tai_lieu = db.hoSoDiaBanFiles.filter((f) => f.don_vi_id === file.don_vi_id).length;
    }
  }

  writeDb(db);
  res.json(newFile);
});

app.delete('/api/ho-so-files/:id', (req, res) => {
  const db = readDb();
  if (!db.hoSoDiaBanFiles) db.hoSoDiaBanFiles = [];
  const file = db.hoSoDiaBanFiles.find((f) => f.id === req.params.id);
  db.hoSoDiaBanFiles = db.hoSoDiaBanFiles.filter((f) => f.id !== req.params.id);

  if (file && db.diaBanRecords) {
    const diaBan = db.diaBanRecords.find((r) => r.id === file.don_vi_id);
    if (diaBan) {
      diaBan.so_luong_tai_lieu = db.hoSoDiaBanFiles.filter((f) => f.don_vi_id === file.don_vi_id).length;
    }
  }

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
  const list = (db.users || []).map((u) => stripUserSecrets(u));
  res.json(list);
});

app.post('/api/users', async (req, res) => {
  try {
    const { req: input, actor_name } = req.body;
    const db = readDb();

    if (!input?.ten_dang_nhap || !input?.mat_khau) {
      return res.status(400).json({ message: 'Tên đăng nhập và mật khẩu khởi tạo là bắt buộc' });
    }

    const createPwError = validatePasswordPolicy(input.mat_khau);
    if (createPwError) {
      return res.status(400).json({ message: createPwError });
    }

    if (db.users.some((u) => u.ten_dang_nhap.toLowerCase() === input.ten_dang_nhap.trim().toLowerCase())) {
      return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại trong hệ thống' });
    }

    const mat_khau_hash = await hashPasswordServer(input.mat_khau);

    const newUser = {
      id: `user-${Date.now()}`,
      ten_dang_nhap: input.ten_dang_nhap.trim(),
      mat_khau_hash,
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
    res.json(stripUserSecrets(newUser));
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ message: 'Lỗi khi tạo tài khoản' });
  }
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
    du_lieu_moi: JSON.stringify(stripUserSecrets(user)),
    thoi_gian: new Date().toISOString(),
  });

  writeDb(db);
  res.json({ success: true });
});

app.post('/api/users/reset-password', async (req, res) => {
  try {
    const { req: input, actor_name } = req.body;
    const db = readDb();
    const user = db.users.find((u) => u.id === input?.user_id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    if (!input?.mat_khau_moi) {
      return res.status(400).json({ message: 'Vui lòng cung cấp mật khẩu mới' });
    }

    const resetPwError = validatePasswordPolicy(input.mat_khau_moi);
    if (resetPwError) {
      return res.status(400).json({ message: resetPwError });
    }

    user.mat_khau_hash = await hashPasswordServer(input.mat_khau_moi);
    delete user.mat_khau;
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
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Lỗi khi đặt lại mật khẩu' });
  }
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
