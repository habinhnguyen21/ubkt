/**
 * Tiện ích đồng bộ nền không gây nháy màn hình (Zero-Flicker Background Sync Utilities)
 * - So sánh sâu dữ liệu cũ và mới (isSameData)
 * - Chỉ cập nhật đúng phần tử thay đổi theo id/key ổn định, giữ nguyên tham chiếu các phần tử không đổi (reconcileById)
 * - Bảo vệ ô input người dùng đang nhập (document.activeElement) không bị ghi đè
 */

export function stableSerialize(val: unknown): string {
  if (val === null || val === undefined) return String(val);
  if (typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) {
    return '[' + val.map((item) => stableSerialize(item)).join(',') + ']';
  }
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + stableSerialize(obj[k])).join(',') +
    '}'
  );
}

/**
 * So sánh sâu 2 giá trị hoặc 2 danh sách dữ liệu.
 * Trả về true nếu dữ liệu hoàn toàn giống nhau.
 */
export function isSameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }
  if (typeof a !== typeof b) return false;
  return stableSerialize(a) === stableSerialize(b);
}

/**
 * Đối chiếu danh sách mới với danh sách cũ theo id/key ổn định:
 * - Nếu phần tử không đổi: giữ nguyên tham chiếu object cũ để React không render lại dòng đó.
 * - Nếu toàn bộ danh sách không đổi: trả về chính mảng prevList để React bỏ qua re-render hoàn toàn.
 */
export function reconcileById<T>(
  prevList: T[],
  nextList: T[],
  getKey: (item: T) => string = (item: any) => String(item?.id ?? '')
): T[] {
  if (!Array.isArray(prevList) || prevList.length === 0) {
    return Array.isArray(nextList) && nextList.length === 0 ? prevList : nextList;
  }
  if (!Array.isArray(nextList)) return prevList;

  const prevMap = new Map<string, T>();
  for (const item of prevList) {
    if (item) {
      const k = getKey(item);
      if (k) prevMap.set(k, item);
    }
  }

  let hasAnyChange = prevList.length !== nextList.length;

  const reconciled = nextList.map((nextItem, idx) => {
    if (!nextItem) return nextItem;
    const key = getKey(nextItem);
    const prevItem = key ? prevMap.get(key) : undefined;

    if (prevItem && isSameData(prevItem, nextItem)) {
      if (prevList[idx] !== prevItem) {
        hasAnyChange = true;
      }
      return prevItem;
    }

    hasAnyChange = true;
    return nextItem;
  });

  return hasAnyChange ? reconciled : prevList;
}

/**
 * Đối chiếu cây phân cấp (DonViTreeItem[]) theo id ổn định:
 * Chỉ cập nhật đúng nhánh/node có thay đổi, giữ nguyên tham chiếu các node không đổi.
 */
export function reconcileTreeById<T extends { id: string; children?: T[] }>(
  prevTree: T[],
  nextTree: T[]
): T[] {
  if (!Array.isArray(prevTree) || prevTree.length === 0) {
    return Array.isArray(nextTree) && nextTree.length === 0 ? prevTree : nextTree;
  }
  if (!Array.isArray(nextTree)) return prevTree;

  const prevMap = new Map<string, T>();
  for (const node of prevTree) {
    if (node && node.id) prevMap.set(node.id, node);
  }

  let hasAnyChange = prevTree.length !== nextTree.length;

  const reconciled = nextTree.map((nextNode, idx) => {
    const prevNode = prevMap.get(nextNode.id);
    if (!prevNode) {
      hasAnyChange = true;
      return nextNode;
    }

    const prevChildren = prevNode.children || [];
    const nextChildren = nextNode.children || [];
    const reconciledChildren = reconcileTreeById(prevChildren, nextChildren);

    const prevShallow = { ...prevNode, children: undefined };
    const nextShallow = { ...nextNode, children: undefined };

    if (
      reconciledChildren === prevChildren &&
      isSameData(prevShallow, nextShallow)
    ) {
      if (prevTree[idx] !== prevNode) {
        hasAnyChange = true;
      }
      return prevNode;
    }

    hasAnyChange = true;
    return {
      ...nextNode,
      children: reconciledChildren,
    };
  });

  return hasAnyChange ? reconciled : prevTree;
}

/**
 * Kiểm tra xem người dùng có đang nhập liệu vào một ô input / textarea / select / contentEditable hay không
 */
export function isUserEditingInput(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement as HTMLElement | null;
  if (!active || active === document.body) return false;
  const tag = active.tagName?.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    const inputEl = active as HTMLInputElement;
    if (inputEl.type === 'checkbox' || inputEl.type === 'radio' || inputEl.type === 'button' || inputEl.type === 'submit') {
      return false;
    }
    return true;
  }
  if (active.isContentEditable) return true;
  return false;
}

export interface ActiveInputSnapshot {
  element: HTMLInputElement | HTMLTextAreaElement;
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
}

/**
 * Chụp lại trạng thái ô input đang focus (document.activeElement) trước khi đồng bộ nền
 */
export function captureActiveInput(): ActiveInputSnapshot | null {
  if (typeof document === 'undefined') return null;
  const active = document.activeElement;
  if (!active) return null;
  const tag = active.tagName?.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    const el = active as HTMLInputElement | HTMLTextAreaElement;
    const type = (el as HTMLInputElement).type;
    if (type === 'checkbox' || type === 'radio' || type === 'file' || type === 'button' || type === 'submit') {
      return null;
    }
    let selectionStart: number | null = null;
    let selectionEnd: number | null = null;
    try {
      selectionStart = el.selectionStart;
      selectionEnd = el.selectionEnd;
    } catch {
      // Một số loại input không hỗ trợ selectionStart
    }
    return {
      element: el,
      value: el.value,
      selectionStart,
      selectionEnd,
    };
  }
  return null;
}

/**
 * Khôi phục giá trị và con trỏ của ô input đang được người dùng nhập nếu bị tác động bởi render nền
 */
export function restoreActiveInput(snapshot: ActiveInputSnapshot | null): void {
  if (!snapshot || typeof document === 'undefined') return;
  const { element, value, selectionStart, selectionEnd } = snapshot;
  if (!document.contains(element)) return;

  if (document.activeElement !== element) {
    try {
      element.focus({ preventScroll: true });
    } catch {
      // ignore
    }
  }
  if (element.value !== value) {
    element.value = value;
  }
  if (selectionStart !== null && selectionEnd !== null) {
    try {
      element.setSelectionRange(selectionStart, selectionEnd);
    } catch {
      // ignore
    }
  }
}

