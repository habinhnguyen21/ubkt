import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './services/firebase.ts'
import { restoreMigratedKeys } from './services/indexedDbStorage.ts'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// Khôi phục dữ liệu đã bị di trú nhầm sang IndexedDB về lại localStorage TRƯỚC khi ứng dụng chạy
// (ứng dụng vẫn đọc trực tiếp localStorage). Giới hạn 3 giây để không làm chậm việc mở trang.
async function bootstrap() {
  try {
    const result = await Promise.race([
      restoreMigratedKeys(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ])
    if (result && (result.restored.length > 0 || result.removed.length > 0)) {
      console.info('[Khôi phục dữ liệu cục bộ]', result)
    }
  } catch (err) {
    console.warn('[Khôi phục dữ liệu cục bộ] thất bại:', err)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}

void bootstrap()
