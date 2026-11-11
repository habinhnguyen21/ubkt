import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  centralDataService,
  getBusinessContentDiff,
  VersionConflictError,
} from '../src/services/centralDataService';
import { isSameData } from '../src/utils/syncUtils';
import type { DiaBanRecord } from '../src/types';

class MemoryStorage implements Storage {
  private store: Record<string, string> = {};
  get length(): number {
    return Object.keys(this.store).length;
  }
  clear(): void {
    this.store = {};
  }
  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  key(index: number): string | null {
    return Object.keys(this.store)[index] || null;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

class MockWindow {
  private listeners: Record<string, Function[]> = {};
  addEventListener(event: string, fn: Function) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(fn);
  }
  removeEventListener(event: string, fn: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((l) => l !== fn);
  }
  dispatchEvent(e: any): boolean {
    (this.listeners[e.type] || []).forEach((fn) => fn(e));
    return true;
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new MemoryStorage();
}
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = new MockWindow();
}
if (typeof (globalThis as any).CustomEvent === 'undefined') {
  (globalThis as any).CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, init?: { detail?: any }) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
}

describe('Version Conflict & Single-path Save Logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseRecord: DiaBanRecord = {
    id: 'dv-01',
    ten_dia_ban: 'Chi bộ 1',
    loai_to_chuc: 'CHI_BO',
    trang_thai_to_chuc: 'DANG_HOAT_DONG',
    can_bo_phu_trach_id: 'u-1',
    can_bo_phu_trach_ten: 'Nguyễn Văn A',
    can_bo_chuc_vu: 'Ủy viên',
    thoi_gian_phan_cong: '01/01/2026',
    van_ban_phan_cong: 'QĐ 01',
    tinh_trang_bao_cao_thang: 'DA_NOP_DUNG_HAN',
    thang_hien_tai: 'T11/2026',
    so_van_de_theo_doi: 1,
    danh_sach_van_de: [
      {
        id: 'vd-1',
        noi_dung: 'Vấn đề theo dõi 1',
        muc_do: 'THUONG',
        ngay_ghi_nhan: '01/01/2026',
        trang_thai: 'DANG_THEO_DOI',
      },
    ],
    so_chi_dao_chua_hoan_thanh: 0,
    danh_sach_chi_dao: [],
    so_luong_tai_lieu: 0,
    version: 1,
    updated_at: '2026-01-01T00:00:00.000Z',
    updated_by: 'Nguyễn Văn A',
  };

  it('1. Lưu danh sách không đổi thì 0 lượt ghi vào Firestore', async () => {
    const records: DiaBanRecord[] = [
      { ...baseRecord, id: 'dv-01' },
      { ...baseRecord, id: 'dv-02', ten_dia_ban: 'Chi bộ 2' },
    ];

    const prevMap = new Map(records.map((r) => [r.id, r]));
    const saveDocSpy = vi.spyOn(centralDataService, 'saveDoc').mockResolvedValue(baseRecord);

    // Giả lập logic của saveRecords
    const changedRecords: DiaBanRecord[] = [];
    for (const r of records) {
      const oldR = prevMap.get(r.id);
      if (!oldR || !isSameData(oldR, r)) {
        changedRecords.push(r);
      }
    }

    for (const r of changedRecords) {
      await centralDataService.saveDoc('ho_so_dia_ban_records', r.id, r);
    }

    expect(changedRecords.length).toBe(0);
    expect(saveDocSpy).toHaveBeenCalledTimes(0);
  });

  it('2. Sửa 1 hồ sơ thì đúng 1 lượt ghi vào Firestore (tuần tự, không ghi cả danh sách)', async () => {
    const prevRecords: DiaBanRecord[] = [
      { ...baseRecord, id: 'dv-01', ten_dia_ban: 'Chi bộ 1' },
      { ...baseRecord, id: 'dv-02', ten_dia_ban: 'Chi bộ 2' },
    ];

    // Người dùng chỉ sửa tên của dv-01
    const newRecords: DiaBanRecord[] = [
      { ...baseRecord, id: 'dv-01', ten_dia_ban: 'Chi bộ 1 - Đổi tên' },
      { ...baseRecord, id: 'dv-02', ten_dia_ban: 'Chi bộ 2' },
    ];

    const saveDocSpy = vi.spyOn(centralDataService, 'saveDoc').mockImplementation(async (_col, _id, data) => {
      return { ...(data as any), version: 2 };
    });

    const prevMap = new Map(prevRecords.map((r) => [r.id, r]));
    const changedRecords: DiaBanRecord[] = [];
    for (const r of newRecords) {
      const oldR = prevMap.get(r.id);
      if (!oldR || !isSameData(oldR, r)) {
        changedRecords.push(r);
      }
    }

    expect(changedRecords.length).toBe(1);
    expect(changedRecords[0].id).toBe('dv-01');

    for (const r of changedRecords) {
      await centralDataService.saveDoc('ho_so_dia_ban_records', r.id, r);
    }

    expect(saveDocSpy).toHaveBeenCalledTimes(1);
    expect(saveDocSpy).toHaveBeenCalledWith('ho_so_dia_ban_records', 'dv-01', changedRecords[0]);
  });

  it('3. Sau khi lưu, version cục bộ bằng version Cloud và lưu lần hai liên tiếp không xung đột', async () => {
    let currentRecord: DiaBanRecord = { ...baseRecord, version: 1 };
    let cloudVersion = 1;

    const saveDocSpy = vi.spyOn(centralDataService, 'saveDoc').mockImplementation(async (_col, _id, data, options) => {
      const expectedVersion = options?.expectedVersion ?? (data as any).version;
      if (expectedVersion !== undefined && expectedVersion !== cloudVersion) {
        throw new VersionConflictError({
          collectionName: 'ho_so_dia_ban_records',
          id: 'dv-01',
          localData: data,
          cloudData: { ...data, version: cloudVersion },
          localVersion: expectedVersion,
          cloudVersion,
          updatedBy: 'Khác',
          updatedAt: '2026-01-01',
        });
      }
      cloudVersion++;
      return { ...(data as any), version: cloudVersion };
    });

    // Lần 1: sửa và lưu
    currentRecord = { ...currentRecord, ten_dia_ban: 'Tên mới lần 1' };
    const saved1 = await centralDataService.saveDoc('ho_so_dia_ban_records', currentRecord.id, currentRecord, {
      expectedVersion: currentRecord.version,
    });
    // Cập nhật version mới từ kết quả trả về
    currentRecord = { ...currentRecord, version: saved1.version };
    expect(currentRecord.version).toBe(2);

    // Lần 2: sửa tiếp và lưu ngay lập tức với expectedVersion = 2 (không bị xung đột)
    currentRecord = { ...currentRecord, ten_dia_ban: 'Tên mới lần 2' };
    const saved2 = await centralDataService.saveDoc('ho_so_dia_ban_records', currentRecord.id, currentRecord, {
      expectedVersion: currentRecord.version,
    });
    currentRecord = { ...currentRecord, version: saved2.version };

    expect(currentRecord.version).toBe(3);
    expect(saveDocSpy).toHaveBeenCalledTimes(2);
  });

  it('4. getBusinessContentDiff: chỉ khác trường meta thì coi như không khác biệt nội dung', () => {
    const local = {
      ...baseRecord,
      version: 2,
      updated_at: '2026-11-11T12:00:00.000Z',
      updated_by: 'admin',
      thoi_diem_cap_nhat_gan_nhat: '11/11/2026 12:00',
    };
    const cloud = {
      ...baseRecord,
      version: 5,
      updated_at: '2026-11-11T14:30:00.000Z',
      updated_by: 'system',
      thoi_diem_cap_nhat_gan_nhat: '11/11/2026 14:30',
    };

    const diffKeys = getBusinessContentDiff(local, cloud);
    expect(diffKeys).toEqual([]);
  });

  it('5. getBusinessContentDiff: có xung đột thật khi trường nghiệp vụ khác nhau', () => {
    const local = {
      ...baseRecord,
      ten_dia_ban: 'Chi bộ Đã Sửa Ở Máy A',
      so_van_de_theo_doi: 5,
    };
    const cloud = {
      ...baseRecord,
      ten_dia_ban: 'Chi bộ Đã Sửa Ở Máy B',
      so_van_de_theo_doi: 1,
    };

    const diffKeys = getBusinessContentDiff(local, cloud);
    expect(diffKeys).toContain('ten_dia_ban');
    expect(diffKeys).toContain('so_van_de_theo_doi');
    expect(diffKeys.length).toBe(2);
  });

  it('6. saveBackgroundDiaBanRecord: khi gặp xung đột không hiện hộp thoại, tự áp trường suy ra lên bản Cloud và thử lại', async () => {
    let attempts = 0;
    const cloudRecord: DiaBanRecord = {
      ...baseRecord,
      id: 'dv-bg',
      ten_dia_ban: 'Đơn vị đã sửa bởi cán bộ khác trên Cloud',
      so_van_de_theo_doi: 10,
      version: 3,
    };

    const windowEventSpy = vi.fn();
    window.addEventListener('ubkt_version_conflict', windowEventSpy);

    const saveDocSpy = vi.spyOn(centralDataService, 'saveDoc').mockImplementation(async (_col, _id, data, options) => {
      attempts++;
      expect(options?.skipConflictDialog).toBe(true);

      if (attempts === 1) {
        // Lần đầu: xung đột phiên bản (local version 1 vs cloud version 3)
        throw new VersionConflictError({
          collectionName: 'ho_so_dia_ban_records',
          id: 'dv-bg',
          localData: data,
          cloudData: cloudRecord,
          localVersion: 1,
          cloudVersion: 3,
          updatedBy: 'Cán bộ khác',
          updatedAt: '2026-11-11T10:00:00.000Z',
        });
      }

      // Lần 2: payload đã được tự gộp trường suy ra lên cloudRecord với version 3
      return { ...(data as any), version: 4 };
    });

    const backgroundData = {
      id: 'dv-bg',
      can_bo_phu_trach_id: 'u-auto-new',
      can_bo_phu_trach_ten: 'Đ/c Cán Bộ Tự Động',
      version: 1,
    };

    const saved = await centralDataService.saveBackgroundDiaBanRecord(
      'dv-bg',
      backgroundData,
      ['can_bo_phu_trach_id', 'can_bo_phu_trach_ten']
    );

    expect(saved).toBeDefined();
    expect(saved?.version).toBe(4);
    expect(saved?.can_bo_phu_trach_id).toBe('u-auto-new');
    expect(saved?.ten_dia_ban).toBe('Đơn vị đã sửa bởi cán bộ khác trên Cloud');
    // Tuyệt đối không bắn event xung đột hay mở modal
    expect(windowEventSpy).not.toHaveBeenCalled();
    expect(attempts).toBe(2);
    expect(saveDocSpy).toHaveBeenCalledTimes(2);

    window.removeEventListener('ubkt_version_conflict', windowEventSpy);
  });
});
