import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './services/firebase.ts'
import { indexedDbStorage } from './services/indexedDbStorage.ts'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// Tự động khởi tạo và di trú IndexedDB ngay khi mở web
indexedDbStorage.init().catch(console.error);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
