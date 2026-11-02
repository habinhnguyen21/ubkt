import bcrypt from 'bcryptjs';

export const PBKDF2_ITERATIONS = 100000;
export const BCRYPT_COST = 10;

// Hash bcrypt (cost 10) khởi tạo mặc định cho tài khoản seed khi hệ thống chưa có dữ liệu (bắt buộc đổi ngay lần đầu must_change_password = true)
export const INITIAL_SEED_ADMIN_HASH =
  '$2b$10$oPqHubEEvKVDcP7UmBgqUu9FTfNn3abZbbi.kdAwgDPOqouEgxxve';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : '0' + hex;
  const arr = new Uint8Array(clean.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Băm mật khẩu phía client bằng Web Crypto PBKDF2 (SHA-256, salt ngẫu nhiên 16 byte, 100.000 vòng),
 * hoặc dự phòng bcryptjs (cost 10) nếu môi trường không có Web Crypto.
 */
export async function hashPasswordClient(password: string): Promise<string> {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    globalThis.crypto.subtle
  ) {
    const salt = new Uint8Array(16);
    globalThis.crypto.getRandomValues(salt);
    const enc = new TextEncoder();
    const keyMaterial = await globalThis.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derivedBits = await globalThis.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    const saltHex = bytesToHex(salt);
    const hashHex = bytesToHex(new Uint8Array(derivedBits));
    return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
  }

  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Kiểm tra mật khẩu khớp với chuỗi băm (hỗ trợ cả PBKDF2 SHA-256 và bcryptjs $2a$/$2b$/$2y$).
 */
export async function verifyPasswordClient(
  password: string,
  storedHash?: string | null
): Promise<boolean> {
  if (!password || !storedHash) return false;

  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const saltHex = parts[2];
    const expectedHashHex = parts[3];
    if (!iterations || !saltHex || !expectedHashHex) return false;

    if (
      typeof globalThis !== 'undefined' &&
      globalThis.crypto &&
      globalThis.crypto.subtle
    ) {
      const salt = hexToBytes(saltHex);
      const enc = new TextEncoder();
      const keyMaterial = await globalThis.crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      const derivedBits = await globalThis.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt as BufferSource,
          iterations,
          hash: 'SHA-256',
        },
        keyMaterial,
        256
      );
      const actualHashHex = bytesToHex(new Uint8Array(derivedBits));
      return timingSafeEqualHex(actualHashHex, expectedHashHex);
    }
    return false;
  }

  if (
    storedHash.startsWith('$2a$') ||
    storedHash.startsWith('$2b$') ||
    storedHash.startsWith('$2y$')
  ) {
    return bcrypt.compare(password, storedHash);
  }

  return false;
}

/**
 * Kiểm tra chính sách mật khẩu mạnh: tối thiểu 8 ký tự, có chữ hoa, chữ thường và chữ số.
 */
export function validatePasswordPolicy(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Mật khẩu phải có tối thiểu 8 ký tự.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Mật khẩu phải chứa ít nhất 1 chữ cái viết hoa (A-Z).';
  }
  if (!/[a-z]/.test(password)) {
    return 'Mật khẩu phải chứa ít nhất 1 chữ cái viết thường (a-z).';
  }
  if (!/[0-9]/.test(password)) {
    return 'Mật khẩu phải chứa ít nhất 1 chữ số (0-9).';
  }
  return null;
}

/**
 * Loại bỏ hoàn toàn mọi trường mật khẩu (mat_khau, mat_khau_hash, password, passwordHash)
 * trước khi lưu hoặc đồng bộ lên Firestore Cloud (xác thực do Firebase Authentication đảm nhiệm).
 */
export function sanitizeUserForCloud<T extends Record<string, any>>(
  user: T
): Omit<T, 'mat_khau' | 'mat_khau_hash' | 'password' | 'passwordHash'> {
  if (!user || typeof user !== 'object') return user;
  const copy: Record<string, any> = { ...user };
  delete copy.mat_khau;
  delete copy.mat_khau_hash;
  delete copy.password;
  delete copy.passwordHash;
  return copy as Omit<T, 'mat_khau' | 'mat_khau_hash' | 'password' | 'passwordHash'>;
}

/**
 * Loại bỏ cả mat_khau và mat_khau_hash trước khi trả thông tin User về giao diện.
 */
export function stripSecretsFromUser<T extends Record<string, any>>(
  user: T
): Omit<T, 'mat_khau' | 'mat_khau_hash'> {
  if (!user || typeof user !== 'object') return user;
  const copy: Record<string, any> = { ...user };
  delete copy.mat_khau;
  delete copy.mat_khau_hash;
  return copy as Omit<T, 'mat_khau' | 'mat_khau_hash'>;
}

