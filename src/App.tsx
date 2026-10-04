import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { RecurringPage } from './pages/RecurringPage'
import { ReportsPage } from './pages/ReportsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { SettingsPage } from './pages/SettingsPage'
import { LoginPage } from './pages/LoginPage'
import { useTheme } from './hooks/useTheme'

export function App() {
  // Initialize and apply theme to documentElement
  useTheme()

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Route without shell */}
        <Route path="/login" element={<LoginPage />} />

        {/* Application Routes wrapped in AppShell */}
        <Route path="/" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="recurring" element={<RecurringPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
