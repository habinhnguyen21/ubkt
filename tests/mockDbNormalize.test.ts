import { describe, it, expect } from 'vitest';
import { isMigrationPlaceholder, normalizeMockDb } from '../src/utils/mockDbNormalize';

const defaultUsers = () => [{ id: 'seed-admin' }];

describe('isMigrationPlaceholder', () => {
  it('nhận ra bản đánh dấu di trú', () => {
    expect(isMigrationPlaceholder({ _migrated_to_idb: true })).toBe(true);
  });
  it('không coi dữ liệu thật là bản đánh dấu, kể cả khi còn sót cờ', () => {
    expect(isMigrationPlaceholder({ _migrated_to_idb: true, donViList: [{ id: 'a' }] })).toBe(false);
    expect(isMigrationPlaceholder({ users: [], donViList: [] })).toBe(false);
  });
  it('không coi giá trị khác kiểu là bản đánh dấu', () => {
    expect(isMigrationPlaceholder(null)).toBe(false);
    expect(isMigrationPlaceholder([])).toBe(false);
    expect(isMigrationPlaceholder('x')).toBe(false);
    expect(isMigrationPlaceholder({ _migrated_to_idb: false })).toBe(false);
  });
});

describe('normalizeMockDb', () => {
  it('luôn có đủ các mảng bắt buộc để donViList.filter không bao giờ lỗi', () => {
    const db = normalizeMockDb<{ donViList: unknown[]; chuongTrinhList: unknown[]; auditLogs: unknown[]; users: unknown[] }>(
      { _migrated_to_idb: true },
      defaultUsers
    );
    expect(() => db.donViList.filter(() => true)).not.toThrow();
    expect(db.donViList).toEqual([]);
    expect(db.chuongTrinhList).toEqual([]);
    expect(db.auditLogs).toEqual([]);
    expect(db.users).toEqual([{ id: 'seed-admin' }]);
    expect('_migrated_to_idb' in db).toBe(false);
  });
  it('giữ nguyên dữ liệu thật và không sửa đối tượng đầu vào', () => {
    const input = { users: [{ id: 'u1' }], donViList: [{ id: 'd1' }], chuongTrinhList: [], auditLogs: [] };
    const out = normalizeMockDb<typeof input>(input, defaultUsers);
    expect(out.donViList).toEqual([{ id: 'd1' }]);
    expect(out.users).toEqual([{ id: 'u1' }]);
    expect(out).not.toBe(input);
  });
  it('xử lý đầu vào không hợp lệ (null, mảng, chuỗi)', () => {
    for (const bad of [null, undefined, [], 'abc', 42]) {
      const db = normalizeMockDb<{ donViList: unknown[]; users: unknown[] }>(bad, defaultUsers);
      expect(Array.isArray(db.donViList)).toBe(true);
      expect(db.users.length).toBe(1);
    }
  });
  it('mảng bắt buộc sai kiểu thì thay bằng [] ; mảng tùy chọn sai kiểu thì bỏ, thiếu thì không tự tạo', () => {
    const db = normalizeMockDb<Record<string, unknown>>(
      { users: [{ id: 'u' }], donViList: { oops: 1 }, chuongTrinhList: 'x', auditLogs: [], donThuList: 'x' },
      defaultUsers
    );
    expect(db.donViList).toEqual([]);
    expect(db.chuongTrinhList).toEqual([]);
    expect('donThuList' in db).toBe(false);
    expect('diaBanRecords' in db).toBe(false);
  });
});
