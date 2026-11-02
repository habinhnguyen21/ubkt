const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

/**
 * Kiểm tra chính sách mật khẩu: tối thiểu 8 ký tự, có chữ hoa, chữ thường, chữ số.
 */
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

/**
 * Xác minh người gọi đã đăng nhập và có vai_tro == 'ADMIN' trong users/{uid}.
 */
async function assertCallerIsAdmin(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Yêu cầu đăng nhập để thực hiện thao tác quản trị.');
  }

  const callerUid = request.auth.uid;
  const callerSnap = await db.collection('users').doc(callerUid).get();

  if (!callerSnap.exists) {
    throw new HttpsError('permission-denied', 'Không tìm thấy hồ sơ quản trị viên của người gọi.');
  }

  const callerData = callerSnap.data() || {};
  if (callerData.trang_thai === 0 || callerData.vai_tro !== 'ADMIN') {
    throw new HttpsError(
      'permission-denied',
      'Từ chối truy cập: Chỉ Quản trị viên (ADMIN) mới có quyền thực hiện thao tác này.'
    );
  }

  return { callerUid, callerData };
}

/**
 * Cloud Function v2 (onCall): Đặt lại mật khẩu cho người dùng trong Firebase Authentication.
 * - Kiểm tra người gọi đã đăng nhập và users/{uid}.vai_tro == 'ADMIN' (đọc bằng Admin SDK).
 * - Nhận uid mục tiêu và mật khẩu mới, kiểm tra chính sách mật khẩu (>=8 ký tự, hoa, thường, số).
 * - Gọi admin.auth().updateUser(uid, { password }).
 * - Đặt must_change_password = true trong users/{uid} và ghi audit log.
 */
exports.adminResetPassword = onCall({ cors: true, region: 'asia-southeast1' }, async (request) => {
  const { callerUid, callerData } = await assertCallerIsAdmin(request);

  const payload = request.data || {};
  const targetUid = String(payload.uid || payload.user_id || '').trim();
  const newPassword = String(payload.password || payload.mat_khau_moi || '');

  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'Thiếu mã định danh người dùng (uid) cần đặt lại mật khẩu.');
  }

  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) {
    throw new HttpsError('invalid-argument', policyError);
  }

  const targetUserRef = db.collection('users').doc(targetUid);
  const targetSnap = await targetUserRef.get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Không tìm thấy hồ sơ người dùng trong Firestore.');
  }
  const targetData = targetSnap.data() || {};

  try {
    await auth.updateUser(targetUid, { password: newPassword });
  } catch (err) {
    throw new HttpsError(
      'internal',
      `Không thể cập nhật mật khẩu trong Firebase Authentication: ${err.message || String(err)}`
    );
  }

  const now = new Date().toISOString();

  await targetUserRef.set(
    {
      must_change_password: true,
      updated_at: now,
    },
    { merge: true }
  );

  const logId = `log-reset-pw-${Date.now()}`;
  await db.collection('audit_logs').doc(logId).set({
    id: logId,
    nguoi_dung_id: callerUid,
    ten_nguoi_dung: callerData.ho_ten || callerData.ten_dang_nhap || 'Quản trị viên',
    hanh_dong: `Cấp lại mật khẩu Firebase Auth cho cán bộ: ${targetData.ho_ten || targetUid} (${targetData.ten_dang_nhap || ''})`,
    bang_anh_huong: 'users',
    ban_ghi_id: targetUid,
    du_lieu_cu: null,
    du_lieu_moi: JSON.stringify({ must_change_password: true }),
    thoi_gian: now,
  });

  return {
    success: true,
    uid: targetUid,
    must_change_password: true,
    updated_at: now,
  };
});

/**
 * Cloud Function v2 (onCall): Tạo tài khoản người dùng mới trong Firebase Authentication + Firestore.
 */
exports.adminCreateUser = onCall({ cors: true, region: 'asia-southeast1' }, async (request) => {
  const { callerUid, callerData } = await assertCallerIsAdmin(request);

  const payload = request.data || {};
  const tenDangNhap = String(payload.ten_dang_nhap || '').trim().toLowerCase();
  const hoTen = String(payload.ho_ten || '').trim();
  const password = String(payload.mat_khau || payload.password || '');
  const vaiTro = ['ADMIN', 'BIEN_TAP', 'XEM'].includes(payload.vai_tro) ? payload.vai_tro : 'XEM';
  const chucDanh = String(payload.chuc_danh || 'Chuyên viên UBKT').trim();

  if (!tenDangNhap || tenDangNhap.length < 2) {
    throw new HttpsError('invalid-argument', 'Tên đăng nhập không hợp lệ (tối thiểu 2 ký tự).');
  }
  if (!hoTen) {
    throw new HttpsError('invalid-argument', 'Họ và tên không được để trống.');
  }

  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    throw new HttpsError('invalid-argument', policyError);
  }

  const email = tenDangNhap.includes('@') ? tenDangNhap : `${tenDangNhap}@ubkt.local`;

  let userRecord;
  try {
    userRecord = await auth.createUser({
      email,
      password,
      displayName: hoTen,
      disabled: false,
    });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Tên đăng nhập này đã tồn tại trong Firebase Authentication.');
    }
    throw new HttpsError('internal', `Lỗi tạo tài khoản Firebase Auth: ${err.message || String(err)}`);
  }

  const now = new Date().toISOString();
  const newUserDoc = {
    id: userRecord.uid,
    ten_dang_nhap: tenDangNhap,
    email,
    ho_ten: hoTen,
    vai_tro: vaiTro,
    chuc_danh: chucDanh,
    trang_thai: 1,
    must_change_password: true,
    created_at: now,
    updated_at: now,
  };

  await db.collection('users').doc(userRecord.uid).set(newUserDoc);

  const logId = `log-create-user-${Date.now()}`;
  await db.collection('audit_logs').doc(logId).set({
    id: logId,
    nguoi_dung_id: callerUid,
    ten_nguoi_dung: callerData.ho_ten || callerData.ten_dang_nhap || 'Quản trị viên',
    hanh_dong: `Tạo tài khoản cán bộ mới: ${hoTen} (${tenDangNhap})`,
    bang_anh_huong: 'users',
    ban_ghi_id: userRecord.uid,
    du_lieu_cu: null,
    du_lieu_moi: JSON.stringify({ ten_dang_nhap: tenDangNhap, vai_tro: vaiTro }),
    thoi_gian: now,
  });

  return {
    success: true,
    user: newUserDoc,
  };
});

