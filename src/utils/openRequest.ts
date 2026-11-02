/**
 * Cơ chế "mở đúng mục" từ chuông nhắc việc.
 * Màn hình đích có thể chưa được mount khi người dùng bấm vào nhắc việc (đang ở tab khác),
 * nên yêu cầu được lưu tạm trong bộ nhớ và đồng thời phát sự kiện cho màn hình đã mount sẵn.
 */

export type OpenRequestType = 'CHUONG_TRINH' | 'DON_THU';

export interface OpenRequest {
  type: OpenRequestType;
  id: string;
}

export const OPEN_REQUEST_EVENT = 'ubkt_open_item';

let pending: OpenRequest | null = null;

export function requestOpenItem(req: OpenRequest): void {
  pending = req;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<OpenRequest>(OPEN_REQUEST_EVENT, { detail: req }));
  }
}

/** Trả về yêu cầu đang chờ của đúng loại và xóa nó (chỉ xử lý một lần) */
export function consumePendingOpen(type: OpenRequestType): OpenRequest | null {
  if (pending && pending.type === type) {
    const req = pending;
    pending = null;
    return req;
  }
  return null;
}

export function clearPendingOpen(type: OpenRequestType): void {
  if (pending && pending.type === type) pending = null;
}
