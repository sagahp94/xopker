/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { FastExport } from './pages/FastExport';
import { Toaster } from 'react-hot-toast';

import { Import } from './pages/Import';
import { BorrowReturn } from './pages/BorrowReturn';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Users } from './pages/Users';
import { StockCheck } from './pages/StockCheck';
import { ActivityLogs } from './pages/ActivityLogs';

// Placeholder components for other pages to avoid errors
const Placeholder = ({ title }: { title: string }) => <div className="p-4 text-xl font-bold">{title}</div>;


const ProtectedRoute = ({ children, roles }: { children: React.ReactNode, roles: string[] }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  
  return <>{children}</>;
};

const DashboardRoute = () => {
  const { user } = useAuth();
  if (user?.role === 'Staff') {
    return <Navigate to="/export" replace />;
  }
  return <Dashboard />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute roles={['Admin', 'Manager', 'Staff']}><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardRoute />} />
        <Route path="export" element={<FastExport />} />
        <Route path="import" element={<ProtectedRoute roles={['Admin', 'Manager', 'Staff']}><Import /></ProtectedRoute>} />
        <Route path="borrow-return" element={<BorrowReturn />} />
        <Route path="check" element={<StockCheck />} />
        <Route path="reports" element={<ProtectedRoute roles={['Admin', 'Manager']}><Reports /></ProtectedRoute>} />
        <Route path="logs" element={<ProtectedRoute roles={['Admin', 'Manager']}><ActivityLogs /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute roles={['Admin']}><Users /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute roles={['Admin']}><Settings /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-center" toastOptions={{
            style: {
              background: '#333',
              color: '#fff',
              borderRadius: '12px',
            },
          }}/>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
