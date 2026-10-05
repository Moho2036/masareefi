import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { RecurringPage } from './pages/RecurringPage'
import { ReportsPage } from './pages/ReportsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { SettingsPage } from './pages/SettingsPage'
import { LoginPage } from './pages/LoginPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './hooks/useAuth'
import { ToastProvider } from './hooks/useToast'
import { SelectedMonthProvider } from './hooks/useSelectedMonth'
import { TransactionModalProvider } from './hooks/useTransactionModal'
import { ToastContainer } from './components/ui/Toast'
import { useTheme } from './hooks/useTheme'
import { useRecurringProcessor } from './hooks/useRecurringProcessor'

function AppRoutes() {
  // Process any due recurring transactions when user is logged in
  useRecurringProcessor()

  return (
    <Routes>
      {/* Auth Route without shell (redirects to / if already logged in) */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Application Routes wrapped in AppShell */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
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
  )
}

export function App() {
  // Initialize and apply theme to documentElement
  useTheme()

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SelectedMonthProvider>
            <TransactionModalProvider>
              <AppRoutes />
              <ToastContainer />
            </TransactionModalProvider>
          </SelectedMonthProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
