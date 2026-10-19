import { lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { LoginPage } from './pages/LoginPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './hooks/useAuth'
import { AppDataProvider } from './context/AppDataContext'
import { ToastProvider } from './hooks/useToast'
import { SelectedMonthProvider } from './hooks/useSelectedMonth'
import { TransactionModalProvider } from './hooks/useTransactionModal'
import { ToastContainer } from './components/ui/Toast'
import { useTheme } from './hooks/useTheme'
import { useRecurringProcessor } from './hooks/useRecurringProcessor'

// Lazy loaded secondary/heavy pages to prevent blocking the initial bundle
const DebtsPage = lazy(() => import('./pages/DebtsPage').then((m) => ({ default: m.DebtsPage })))
const RecurringPage = lazy(() => import('./pages/RecurringPage').then((m) => ({ default: m.RecurringPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const ToolsPage = lazy(() => import('./pages/ToolsPage').then((m) => ({ default: m.ToolsPage })))

function AppRoutes() {
  // Initialize and sync theme with user settings and localStorage
  useTheme()

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
        <Route path="debts" element={<DebtsPage />} />
        <Route path="tools" element={<ToolsPage />} />
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
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppDataProvider>
          <ToastProvider>
            <SelectedMonthProvider>
              <TransactionModalProvider>
                <AppRoutes />
                <ToastContainer />
              </TransactionModalProvider>
            </SelectedMonthProvider>
          </ToastProvider>
        </AppDataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
