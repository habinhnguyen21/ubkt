import { describe, it, expect } from 'vitest';
import {
  validatePasswordPolicy,
  generateSecurePassword,
} from '../src/utils/passwordCrypto';

describe('passwordCrypto - Chính sách mật khẩu & Trình tạo mật khẩu an toàn', () => {
  it('1. validatePasswordPolicy từ chối mật khẩu dưới 8 ký tự', () => {
    expect(validatePasswordPolicy('')).toContain('tối thiểu 8 ký tự');
    expect(validatePasswordPolicy('123456')).toContain('tối thiểu 8 ký tự');
    expect(validatePasswordPolicy('Ab1!')).toContain('tối thiểu 8 ký tự');
  });

  it('2. validatePasswordPolicy từ chối mật khẩu thiếu chữ hoa, chữ thường hoặc số', () => {
    // Thiếu chữ hoa
    expect(validatePasswordPolicy('abcdefg1')).toContain('chữ cái viết hoa');
    // Thiếu chữ thường
    expect(validatePasswordPolicy('ABCDEFG1')).toContain('chữ cái viết thường');
    // Thiếu số
    expect(validatePasswordPolicy('Abcdefgh')).toContain('chữ số');
    // Mật khẩu yếu 12345678
    expect(validatePasswordPolicy('12345678')).toContain('chữ cái viết hoa');
  });

  it('3. validatePasswordPolicy chấp nhận mật khẩu thỏa mãn chính sách', () => {
    expect(validatePasswordPolicy('MatKhau@123')).toBeNull();
    expect(validatePasswordPolicy('AdminUbkt2026!')).toBeNull();
    expect(validatePasswordPolicy('Xyz987654A')).toBeNull();
  });

  it('4. generateSecurePassword tạo mật khẩu 12 ký tự luôn thỏa mãn chính sách', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateSecurePassword();
      expect(pw.length).toBe(12);
      expect(validatePasswordPolicy(pw)).toBeNull();
      // Phải có chữ hoa
      expect(/[A-Z]/.test(pw)).toBe(true);
      // Phải có chữ thường
      expect(/[a-z]/.test(pw)).toBe(true);
      // Phải có số
      expect(/[0-9]/.test(pw)).toBe(true);
      // Phải có ký hiệu
      expect(/[@#$%&*!~?=+-]/.test(pw)).toBe(true);
    }
  });

  it('5. generateSecurePassword có thể nhận độ dài tùy chỉnh', () => {
    const pw16 = generateSecurePassword(16);
    expect(pw16.length).toBe(16);
    expect(validatePasswordPolicy(pw16)).toBeNull();
  });
});
