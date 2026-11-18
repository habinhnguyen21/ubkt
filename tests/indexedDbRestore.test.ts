import { describe, it, expect, vi } from 'vitest';
import { restoreMigratedKeys, type RestoreDeps } from '../src/services/indexedDbStorage';

function makeDeps(local: Record<string, string>, idb: Record<string, unknown>, opts: { setThrows?: boolean } = {}) {
  const deleted: string[] = [];
  const deps: RestoreDeps = {
    getStored: (k) => (k in local ? local[k] : null),
    setStored: (k, v) => {
      if (opts.setThrows) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
      local[k] = v;
    },
    removeStored: (k) => {
      delete local[k];
    },
    readIdb: async (k) => idb[k],
    deleteIdb: async (k) => {
      deleted.push(k);
      delete idb[k];
    },
  };
  return { deps, deleted };
}
const PLACEHOLDER = JSON.stringify({ _migrated_to_idb: true });

describe('restoreMigratedKeys', () => {
  it('khôi phục dữ liệu thật từ IndexedDB về localStorage', async () => {
    const real = { users: [{ id: 'u' }], donViList: [{ id: 'd1' }], chuongTrinhList: [], auditLogs: [] };
    const local: Record<string, string> = { ubkt_mock_db: PLACEHOLDER };
    const { deps, deleted } = makeDeps(local, { ubkt_mock_db: real });
    const res = await restoreMigratedKeys(deps);
    expect(res.restored).toEqual(['ubkt_mock_db']);
    expect(JSON.parse(local.ubkt_mock_db)).toEqual(real);
    expect(deleted).toContain('ubkt_mock_db');
  });

  it('khôi phục được cả giá trị lưu dạng chuỗi', async () => {
    const local: Record<string, string> = { ubkt_ho_so_dia_ban_records: PLACEHOLDER };
    const { deps } = makeDeps(local, { ubkt_ho_so_dia_ban_records: '[{"id":"x"}]' });
    await restoreMigratedKeys(deps);
    expect(local.ubkt_ho_so_dia_ban_records).toBe('[{"id":"x"}]');
  });

  it('không có bản trong IndexedDB thì xóa khóa để ứng dụng nạp lại từ Cloud', async () => {
    const local: Record<string, string> = { ubkt_mock_db: PLACEHOLDER };
    const { deps } = makeDeps(local, {});
    const res = await restoreMigratedKeys(deps);
    expect(res.removed).toEqual(['ubkt_mock_db']);
    expect('ubkt_mock_db' in local).toBe(false);
  });

  it('đầy bộ nhớ khi ghi lại thì xóa khóa chứ không để nguyên bản đánh dấu', async () => {
    const local: Record<string, string> = { ubkt_mock_db: PLACEHOLDER };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { deps } = makeDeps(local, { ubkt_mock_db: { users: [] } }, { setThrows: true });
    const res = await restoreMigratedKeys(deps);
    expect(res.removed).toEqual(['ubkt_mock_db']);
    expect('ubkt_mock_db' in local).toBe(false);
    warn.mockRestore();
  });

  it('không đụng tới khóa chứa dữ liệu thật hoặc khóa không phải JSON hoặc khóa không tồn tại', async () => {
    const real = JSON.stringify({ users: [{ id: 'u' }], donViList: [{ id: 'd' }] });
    const local: Record<string, string> = { ubkt_mock_db: real, ubkt_bao_cao_thang: 'không phải json' };
    const { deps, deleted } = makeDeps(local, { ubkt_mock_db: { users: [] } });
    const res = await restoreMigratedKeys(deps);
    expect(res).toEqual({ restored: [], removed: [] });
    expect(local.ubkt_mock_db).toBe(real);
    expect(local.ubkt_bao_cao_thang).toBe('không phải json');
    expect(deleted).toEqual([]);
  });

  it('chạy lần hai không làm thay đổi gì thêm (idempotent)', async () => {
    const local: Record<string, string> = { ubkt_mock_db: PLACEHOLDER };
    const { deps } = makeDeps(local, { ubkt_mock_db: { users: [{ id: 'u' }], donViList: [] } });
    await restoreMigratedKeys(deps);
    const snapshot = { ...local };
    const res2 = await restoreMigratedKeys(deps);
    expect(res2).toEqual({ restored: [], removed: [] });
    expect(local).toEqual(snapshot);
  });
});
