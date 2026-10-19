import React from 'react'
import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import { AppShellSkeleton } from './skeletons/AppShellSkeleton'

export const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <AppShellSkeleton />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
