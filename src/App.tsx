/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { DemoProvider } from './contexts/DemoContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppDataProvider, useAppData } from './contexts/AppDataContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { Toaster } from 'react-hot-toast';
import { LoadingScreen } from './components/LoadingScreen';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
const FastExport = lazy(() => import('./pages/FastExport').then(m => ({ default: m.FastExport })));
const Import = lazy(() => import('./pages/Import').then(m => ({ default: m.Import })));
const BorrowReturn = lazy(() => import('./pages/BorrowReturn').then(m => ({ default: m.BorrowReturn })));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Users = lazy(() => import('./pages/Users').then(m => ({ default: m.Users })));
const StockCheck = lazy(() => import('./pages/StockCheck').then(m => ({ default: m.StockCheck })));
const ActivityLogs = lazy(() => import('./pages/ActivityLogs').then(m => ({ default: m.ActivityLogs })));

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode, roles: string[] }) => {
  const { user, loading: authLoading } = useAuth();
  const { isInitializing, isDataReady, initStep } = useAppData();
  
  if (authLoading || isInitializing) return <LoadingScreen isDone={isDataReady} step={initStep} />;
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
  const { isInitializing, isDataReady, initStep } = useAppData();
  const { loading: authLoading } = useAuth();

  const isLoading = authLoading || isInitializing;

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="loading-screen"
          initial={{ opacity: 1, scale: 1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ 
            opacity: 0, 
            scale: 1.15, 
            filter: 'blur(8px)',
            transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] } 
          }}
          className="w-full min-h-screen fixed inset-0 z-50 overflow-hidden bg-slate-950"
        >
          <LoadingScreen isDone={isDataReady} step={initStep} />
        </motion.div>
      ) : (
        <motion.div
          key="main-app"
          initial={{ opacity: 0, scale: 0.90 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="w-full min-h-screen"
        >
          <Suspense fallback={<LoadingScreen isDone={true} step="done" />}>
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
                <Route path="settings" element={<ProtectedRoute roles={['Admin', 'Manager', 'Staff']}><Settings /></ProtectedRoute>} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <DemoProvider>
        <AuthProvider>
          <AppDataProvider>
            <BrowserRouter>
              <AppRoutes />
              <Toaster 
                position="top-center" 
                toastOptions={{
                  duration: 3500,
                  className: '!rounded-full !px-6 !py-3.5 !font-medium !text-sm',
                  style: {
                    background: 'rgba(15, 23, 42, 0.78)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#f8fafc',
                    borderRadius: '9999px',
                    boxShadow: '0 20px 40px -15px rgba(14, 165, 233, 0.35), 0 0 20px rgba(56, 189, 248, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: '600',
                    letterSpacing: '0.01em',
                  },
                  success: {
                    iconTheme: {
                      primary: '#38bdf8',
                      secondary: '#0f172a',
                    },
                    style: {
                      background: 'rgba(15, 23, 42, 0.82)',
                      border: '1px solid rgba(56, 189, 248, 0.5)',
                      boxShadow: '0 20px 40px -15px rgba(14, 165, 233, 0.4), 0 0 25px rgba(56, 189, 248, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
                    }
                  },
                  error: {
                    iconTheme: {
                      primary: '#f43f5e',
                      secondary: '#ffffff',
                    },
                    style: {
                      background: 'rgba(24, 15, 26, 0.85)',
                      border: '1px solid rgba(244, 63, 94, 0.5)',
                      boxShadow: '0 20px 40px -15px rgba(244, 63, 94, 0.4), 0 0 25px rgba(244, 63, 94, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
                    }
                  }
                }}
              />
            </BrowserRouter>
          </AppDataProvider>
        </AuthProvider>
      </DemoProvider>
    </ThemeProvider>
  );
}
