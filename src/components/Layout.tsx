import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDemo } from '../contexts/DemoContext';
import { useTheme, IconStyle } from '../contexts/ThemeContext';
import { 
  LayoutDashboard, 
  PackagePlus, 
  PackageMinus, 
  ArrowRightLeft, 
  ClipboardCheck, 
  BarChart3, 
  Settings, 
  Users,
  LogOut,
  ShoppingBag,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  X,
  CheckCircle2,
  History,
  User,
  Mail,
  Calendar,
  Shield,
  Sun,
  Moon,
  Sunrise,
  Sunset
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getOfflineQueue, removeOfflineTransaction, syncSingleTransaction, processOfflineQueue, OfflineTransaction } from '../lib/offlineSync';
import { formatMainName } from '../constants';
import { LuxuryGlassLogo, VersionBadge } from './BrandLogo';
import { VersionHistoryModal } from './VersionHistoryModal';
import toast from 'react-hot-toast';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getIconBadgeStyles = (isActive: boolean, item: typeof NAV_ITEMS[0], style: IconStyle) => {
  if (style === 'minimal') {
    if (isActive) {
      return {
        container: "w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm ring-2 ring-slate-400/30",
        icon: "w-5 h-5 text-white dark:text-slate-900"
      };
    }
    return {
      container: "w-9 h-9 rounded-xl bg-transparent border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700",
      icon: "w-4.5 h-4.5 text-slate-600 dark:text-slate-400"
    };
  }

  if (style === 'rounded') {
    if (isActive) {
      return {
        container: cn("w-10 h-10 rounded-full scale-105 shadow-md ring-2 ring-indigo-500/20", item.activeBg),
        icon: "w-5 h-5 text-white"
      };
    }
    return {
      container: cn("w-9 h-9 rounded-full", item.inactiveBg),
      icon: "w-4.5 h-4.5"
    };
  }

  if (style === 'monochrome') {
    if (isActive) {
      return {
        container: "w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md ring-2 ring-slate-500/30",
        icon: "w-5 h-5 text-white dark:text-slate-900"
      };
    }
    return {
      container: "w-9 h-9 rounded-xl bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300",
      icon: "w-4.5 h-4.5"
    };
  }

  // Default 'vibrant'
  if (isActive) {
    return {
      container: cn("w-10 h-10 rounded-xl scale-105", item.activeBg),
      icon: "w-5 h-5 text-white"
    };
  }
  return {
    container: cn("w-9 h-9 rounded-xl", item.inactiveBg),
    icon: "w-4.5 h-4.5"
  };
};

const NAV_ITEMS = [
  { 
    path: '/', 
    label: 'Tổng Quan', 
    icon: LayoutDashboard, 
    roles: ['Admin', 'Manager'],
    activeBg: 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white ring-4 ring-blue-500/25 border-2 border-blue-300 dark:border-blue-400 shadow-md shadow-blue-500/20',
    inactiveBg: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20 dark:group-hover:bg-blue-500/30',
    activeText: 'text-blue-600 dark:text-blue-400',
    cardActiveBorder: 'bg-blue-50/80 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
  },
  { 
    path: '/export', 
    label: 'Xuất Nhanh', 
    icon: PackageMinus, 
    roles: ['Admin', 'Manager', 'Staff'],
    activeBg: 'bg-gradient-to-tr from-rose-500 to-amber-500 text-white ring-4 ring-rose-500/25 border-2 border-rose-300 dark:border-rose-400 shadow-md shadow-rose-500/20',
    inactiveBg: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500/20 dark:group-hover:bg-rose-500/30',
    activeText: 'text-rose-600 dark:text-rose-400',
    cardActiveBorder: 'bg-rose-50/80 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50',
  },
  { 
    path: '/import', 
    label: 'Nhập Kho', 
    icon: PackagePlus, 
    roles: ['Admin', 'Manager', 'Staff'],
    activeBg: 'bg-gradient-to-tr from-emerald-500 to-teal-500 text-white ring-4 ring-emerald-500/25 border-2 border-emerald-300 dark:border-emerald-400 shadow-md shadow-emerald-500/20',
    inactiveBg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20 dark:group-hover:bg-emerald-500/30',
    activeText: 'text-emerald-600 dark:text-emerald-400',
    cardActiveBorder: 'bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50',
  },
  { 
    path: '/borrow-return', 
    label: 'Vay / Trả', 
    icon: ArrowRightLeft, 
    roles: ['Admin', 'Manager', 'Staff'],
    activeBg: 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white ring-4 ring-amber-500/25 border-2 border-amber-300 dark:border-amber-400 shadow-md shadow-amber-500/20',
    inactiveBg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/20 dark:group-hover:bg-amber-500/30',
    activeText: 'text-amber-600 dark:text-amber-400',
    cardActiveBorder: 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
  },
  { 
    path: '/check', 
    label: 'Kiểm Kê', 
    icon: ClipboardCheck, 
    roles: ['Admin', 'Manager', 'Staff'],
    activeBg: 'bg-gradient-to-tr from-cyan-500 to-sky-600 text-white ring-4 ring-cyan-500/25 border-2 border-cyan-300 dark:border-cyan-400 shadow-md shadow-cyan-500/20',
    inactiveBg: 'bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-500/20 dark:group-hover:bg-cyan-500/30',
    activeText: 'text-cyan-600 dark:text-cyan-400',
    cardActiveBorder: 'bg-cyan-50/80 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/50',
  },
  { 
    path: '/reports', 
    label: 'Báo Cáo', 
    icon: BarChart3, 
    roles: ['Admin', 'Manager'],
    activeBg: 'bg-gradient-to-tr from-purple-600 to-pink-500 text-white ring-4 ring-purple-500/25 border-2 border-purple-300 dark:border-purple-400 shadow-md shadow-purple-500/20',
    inactiveBg: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500/20 dark:group-hover:bg-purple-500/30',
    activeText: 'text-purple-600 dark:text-purple-400',
    cardActiveBorder: 'bg-purple-50/80 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/50',
  },
  { 
    path: '/logs', 
    label: 'Nhật Ký', 
    icon: History, 
    roles: ['Admin', 'Manager'],
    activeBg: 'bg-gradient-to-tr from-amber-600 to-orange-500 text-white ring-4 ring-amber-500/25 border-2 border-amber-300 dark:border-amber-400 shadow-md shadow-amber-500/20',
    inactiveBg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/20 dark:group-hover:bg-amber-500/30',
    activeText: 'text-amber-600 dark:text-amber-400',
    cardActiveBorder: 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
  },
  { 
    path: '/users', 
    label: 'Người Dùng', 
    icon: Users, 
    roles: ['Admin'],
    activeBg: 'bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white ring-4 ring-violet-500/25 border-2 border-violet-300 dark:border-violet-400 shadow-md shadow-violet-500/20',
    inactiveBg: 'bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 group-hover:bg-violet-500/20 dark:group-hover:bg-violet-500/30',
    activeText: 'text-violet-600 dark:text-violet-400',
    cardActiveBorder: 'bg-violet-50/80 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/50',
  },
  { 
    path: '/settings', 
    label: 'Cài Đặt', 
    icon: Settings, 
    roles: ['Admin', 'Manager', 'Staff'],
    activeBg: 'bg-gradient-to-tr from-slate-700 to-slate-900 dark:from-slate-600 dark:to-slate-800 text-white ring-4 ring-slate-500/25 border-2 border-slate-300 dark:border-slate-400 shadow-md shadow-slate-500/20',
    inactiveBg: 'bg-slate-500/10 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 group-hover:bg-slate-500/20 dark:group-hover:bg-slate-500/30',
    activeText: 'text-slate-800 dark:text-slate-200',
    cardActiveBorder: 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
  },
];

export const Layout: React.FC = () => {
  const { user, adminDisplayName, signOut } = useAuth();
  const { isDemoMode } = useDemo();
  const { iconStyle } = useTheme();
  const navigate = useNavigate();

  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = React.useState<OfflineTransaction[]>([]);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncResults, setSyncResults] = React.useState<{ success: number; failed: { id: string; error: string; tx: OfflineTransaction }[] } | null>(null);

  const [showAccountModal, setShowAccountModal] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [showVersionModal, setShowVersionModal] = React.useState(false);

  // Trigger welcome greeting floating toast notification when opening the application
  React.useEffect(() => {
    const hasGreeted = sessionStorage.getItem('xopker_app_opened_greeting');
    const nameToGreet = user ? formatMainName(user.displayName || user.email) : adminDisplayName;
    if (!hasGreeted && nameToGreet) {
      sessionStorage.setItem('xopker_app_opened_greeting', 'true');
      const hour = new Date().getHours();
      let greetingText = 'Chào buổi tối';
      if (hour >= 5 && hour < 12) {
        greetingText = 'Chào buổi sáng';
      } else if (hour >= 12 && hour < 18) {
        greetingText = 'Chào buổi trưa';
      }

      toast.success(`${greetingText}, ${nameToGreet}!`, {
        duration: 4500,
        icon: '👋',
      });
    }
  }, [user, adminDisplayName]);

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Đã kết nối lại mạng! Hệ thống đang tự động đồng bộ...');
      handleSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Đã ngắt kết nối mạng! Các giao dịch mới sẽ được lưu tạm ngoại tuyến.');
    };
    const handleQueueChange = () => {
      setOfflineQueue(getOfflineQueue());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-queue-changed', handleQueueChange);

    // Initial load
    setOfflineQueue(getOfflineQueue());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-changed', handleQueueChange);
    };
  }, []);

  const handleSync = async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;
    if (!navigator.onLine) {
      toast.error('Không có kết nối mạng để đồng bộ!');
      return;
    }

    setIsSyncing(true);
    setSyncResults(null);

    const result = await processOfflineQueue();

    setIsSyncing(false);

    if (result.successCount > 0) {
      toast.success(`Đã đồng bộ thành công ${result.successCount} giao dịch ngoại tuyến!`);
    }
    if (result.failedCount > 0) {
      toast.error(`Đồng bộ thất bại ${result.failedCount} giao dịch.`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const allowedNavItems = NAV_ITEMS.filter(item => item.roles.includes(user?.role || 'Staff'));

  return (
    <div className="flex h-[100dvh] w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans relative">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 shadow-sm z-10">
        <div className="p-4 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
          <LuxuryGlassLogo size="md" />
          <div className="flex flex-col gap-1">
            <span className="font-black text-2xl tracking-tighter text-slate-800 dark:text-slate-100 leading-none">XỐPKER</span>
            <VersionBadge size="sm" />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {allowedNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-3.5 px-4 py-3 rounded-full transition-all duration-300 group cursor-pointer my-1 backdrop-blur-md",
                isActive 
                  ? "bg-gradient-to-r from-sky-500/15 via-indigo-500/15 to-purple-500/15 dark:from-sky-500/25 dark:via-indigo-500/20 dark:to-purple-500/25 border border-sky-400/60 dark:border-sky-400/70 shadow-[0_8px_24px_0_rgba(14,165,233,0.2)] ring-2 ring-sky-400/30 font-black" 
                  : "border border-transparent text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60 hover:border-sky-400/30 hover:text-slate-900 dark:hover:text-slate-100 font-bold"
              )}
            >
              {({ isActive }) => {
                const badge = getIconBadgeStyles(isActive, item, iconStyle);
                return (
                  <>
                    <div className={cn(
                      "flex items-center justify-center transition-all duration-300 shrink-0",
                      badge.container
                    )}>
                      <item.icon className={cn("transition-transform", badge.icon)} />
                    </div>
                    <span className={cn("text-sm transition-all", isActive ? cn("font-black tracking-wide", item.activeText) : "font-semibold")}>
                      {item.label}
                    </span>
                  </>
                );
              }}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <button 
            type="button"
            onClick={() => setShowAccountModal(true)}
            className="w-full text-left flex items-center gap-2.5 p-2.5 rounded-full bg-white/70 dark:bg-slate-900/70 hover:bg-white/90 dark:hover:bg-slate-800/90 transition-all duration-300 border border-sky-400/40 dark:border-sky-400/50 shadow-lg shadow-sky-500/10 backdrop-blur-xl group cursor-pointer"
            title="Xem thông tin tài khoản"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-9 h-9 rounded-full object-cover ring-2 ring-sky-400/40 shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-xs font-black truncate text-slate-800 dark:text-slate-100">
                {user?.displayName || user?.email}
              </p>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                <Shield className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                {user?.role === 'Admin' ? 'Quản trị viên' : user?.role === 'Manager' ? 'Quản lý' : 'Nhân viên'}
              </p>
            </div>
            <User className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0 mr-1" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
        {/* Demo Mode Sandbox Banner */}
        {isDemoMode && (
          <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-3 sm:px-4 py-2 shadow-md flex items-center justify-between gap-2.5 z-30 shrink-0 border-b border-amber-400/40">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold min-w-0">
              <span className="bg-black/30 text-amber-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 border border-amber-300/30">
                SANDBOX
              </span>
              <span className="truncate">
                Đang dùng <strong className="text-amber-100 font-black">{user?.displayName}</strong> — Dữ liệu thử nghiệm <u className="underline decoration-amber-300">KHÔNG</u> ghi vào hệ thống thật.
              </span>
            </div>
            <button
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
              className="bg-white/20 hover:bg-white/30 text-white font-black text-xs px-3 py-1 rounded-full border border-white/40 backdrop-blur-md shrink-0 transition-all cursor-pointer active:scale-95 shadow-xs"
            >
              Thoát Demo
            </button>
          </div>
        )}

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-3 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 z-20 gap-2">
          <div className="flex items-center gap-2.5 shrink-0">
            <LuxuryGlassLogo size="sm" />
            <div className="flex flex-col gap-0.5">
              <span className="font-black text-base text-slate-800 dark:text-slate-100 leading-none">XỐPKER</span>
              <VersionBadge size="sm" />
            </div>
          </div>

          {/* Avatar Only Button in Top Menu Header */}
          <button 
            onClick={() => setShowAccountModal(true)}
            className="p-1 rounded-full hover:opacity-90 transition-all active:scale-95 cursor-pointer shrink-0"
            title="Thông tin tài khoản"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-9 h-9 rounded-full object-cover ring-2 ring-sky-400/60 shadow-md" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-black flex items-center justify-center text-xs shadow-md ring-2 ring-sky-400/60">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </button>
        </header>

        {/* Connection & Sync Status Banner */}
        {(!isOnline || offlineQueue.length > 0) && (
          <div className={cn(
            "px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-bold transition-colors shadow-sm border-b z-20",
            !isOnline 
              ? "bg-amber-500/10 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/20" 
              : "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border-indigo-500/20"
          )}>
            <div className="flex items-center gap-2">
              {!isOnline ? (
                <WifiOff className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
              ) : (
                <Wifi className="w-4 h-4 text-indigo-500 shrink-0" />
              )}
              <span>
                {!isOnline ? 'Bạn đang ngoại tuyến.' : 'Đã kết nối Internet.'}{' '}
                {offlineQueue.length > 0 && (
                  <span>
                    Có <strong className="underline">{offlineQueue.length} giao dịch</strong> đang lưu tạm trên máy chờ đồng bộ.
                  </span>
                )}
              </span>
            </div>
            
            {offlineQueue.length > 0 && (
              <button
                onClick={handleSync}
                disabled={isSyncing || !isOnline}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] uppercase font-black transition-all cursor-pointer",
                  !isOnline 
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed" 
                    : "bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 shadow-sm"
                )}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
                {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
              </button>
            )}
          </div>
        )}

        {/* Sync results notification dialog */}
        {syncResults && (
          <div className="mx-4 mt-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg relative flex flex-col gap-2.5 max-w-2xl z-20">
            <button 
              onClick={() => setSyncResults(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Kết quả đồng bộ hóa
            </h3>
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <p>Đồng bộ thành công: <strong className="text-emerald-600 dark:text-emerald-400">{syncResults.success}</strong> giao dịch.</p>
              {syncResults.failed.length > 0 && (
                <div className="mt-2">
                  <p className="text-red-500 font-bold mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Có {syncResults.failed.length} giao dịch bị lỗi (Không thể ghi nhận):
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-1 bg-red-500/5 dark:bg-red-500/10 p-2 rounded-xl text-[11px]">
                    {syncResults.failed.map((fail, idx) => (
                      <li key={idx} className="text-slate-700 dark:text-slate-300">
                        <strong>{fail.tx.type === 'EXPORT' ? 'Xuất' : 'Nhập'} {fail.tx.bagTypeId} ({fail.tx.quantity} {fail.tx.bagTypeId === 'BAO15' && fail.tx.type === 'EXPORT' ? 'kg' : 'bao'})</strong>: {fail.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Viewport */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 pb-28 md:pb-8 relative bg-slate-100 dark:bg-slate-950">
          <div className="max-w-6xl mx-auto min-h-full pb-8 md:pb-0">
            <Outlet />
          </div>
        </main>

        {/* Mobile Fixed Bottom Fast Menu */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 overflow-x-auto bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/80 hide-scrollbar shadow-[0_-8px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.5)] z-40 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
             style={{ WebkitOverflowScrolling: 'touch' }}>
          <nav className="flex px-3 pt-4 pb-2 gap-1.5 min-w-max justify-around items-end">
             {allowedNavItems.map((item) => (
                <NavLink
                  key={`fast-${item.path}`}
                  to={item.path}
                  className={({ isActive }) => cn(
                    "flex flex-col items-center justify-end min-w-[60px] px-1 transition-all duration-300 relative group cursor-pointer"
                  )}
                >
                  {({ isActive }) => {
                    const badge = getIconBadgeStyles(isActive, item, iconStyle);
                    return (
                      <>
                        <div className={cn(
                          "flex items-center justify-center transition-all duration-300 shrink-0",
                          badge.container,
                          isActive ? "-translate-y-1.5 shadow-xl ring-4" : "opacity-85 hover:opacity-100"
                        )}>
                          <item.icon className={cn("transition-transform duration-300", badge.icon)} />
                        </div>
                        <span className={cn(
                          "text-[10px] whitespace-nowrap transition-all duration-300",
                          isActive 
                            ? cn("font-black -mt-0.5 tracking-tight scale-105", item.activeText) 
                            : "font-semibold text-slate-500 dark:text-slate-400 mt-0.5"
                        )}>
                          {item.label}
                        </span>
                      </>
                    );
                  }}
                </NavLink>
              ))}
          </nav>
        </div>

        {/* Mobile & Desktop Account Info Modal with Glassmorphism */}
        {showAccountModal && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-start sm:items-center justify-center pt-6 sm:pt-0 px-3 sm:px-4 animate-in fade-in duration-200"
            onClick={() => setShowAccountModal(false)}
          >
            <div 
              className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl w-full sm:max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border border-sky-400/30 dark:border-sky-400/20 space-y-5 relative animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header Profile Summary */}
              <div className="flex items-center gap-3.5 pr-8">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-12 h-12 rounded-full object-cover ring-4 ring-sky-400/30 shrink-0 shadow-md" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-lg shrink-0 border border-white/20">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                    {user?.displayName || 'Người dùng'}
                  </h3>
                  <p className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-0.5">
                    <Shield className="w-3.5 h-3.5" />
                    {user?.role === 'Admin' ? 'Quản Trị Viên' : user?.role === 'Manager' ? 'Quản Lý' : 'Nhân Viên'}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200/60 dark:border-slate-800/60 my-1"></div>

              {/* Account details list */}
              <div className="space-y-3">
                {/* Email */}
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Email tài khoản</span>
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 break-all">{user?.email || 'Chưa cập nhật'}</span>
                  </div>
                </div>

                {/* Role */}
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Loại tài khoản</span>
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      {user?.role === 'Admin' ? 'Quản Trị Viên' : user?.role === 'Manager' ? 'Quản Lý' : 'Nhân Viên'}
                    </span>
                  </div>
                </div>

                {/* Version History Action Card */}
                <button
                  type="button"
                  onClick={() => setShowVersionModal(true)}
                  className="w-full text-left flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-blue-500/10 hover:from-sky-500/20 hover:to-blue-500/20 border border-sky-400/40 dark:border-sky-400/30 transition-all duration-300 group cursor-pointer active:scale-98 shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400 shrink-0">
                      <History className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">Lịch sử phiên bản</span>
                      <span className="text-[10px] font-extrabold text-sky-600 dark:text-sky-400">v3.1.0 (Mới nhất)</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-full border border-sky-400/30 group-hover:bg-sky-500 group-hover:text-white transition-all">
                    Xem chi tiết ➔
                  </span>
                </button>
              </div>

              {/* Red Signout Button - Glassmorphism */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full py-3.5 px-5 bg-gradient-to-r from-red-500/20 via-rose-500/20 to-red-600/20 hover:from-red-500/30 hover:to-rose-600/30 text-red-700 dark:text-red-300 border border-red-400/50 dark:border-red-500/50 rounded-full font-black text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-red-500/10 backdrop-blur-xl transition-all duration-300 active:scale-95 cursor-pointer ring-2 ring-red-400/20 hover:border-red-400"
                >
                  <LogOut className="w-4.5 h-4.5" />
                  ĐĂNG XUẤT TÀI KHOẢN
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Version History Modal */}
        <VersionHistoryModal 
          isOpen={showVersionModal} 
          onClose={() => setShowVersionModal(false)} 
        />

        {/* Logout Confirmation Dialog with Glassmorphism Banner */}
        {showLogoutConfirm && (
          <div 
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <div 
              className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-red-500/30 dark:border-red-500/40 space-y-5 text-center animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto shadow-lg shadow-red-500/10 border border-red-400/30 backdrop-blur-md">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-black text-red-900 dark:text-red-200 uppercase tracking-tight">
                  Xác Nhận Đăng Xuất
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                  Bạn có chắc chắn muốn đăng xuất khỏi tài khoản <strong className="text-red-600 dark:text-red-400 font-bold">{user?.email}</strong> không?
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-3 px-5 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs sm:text-sm rounded-full border border-slate-200/80 dark:border-slate-700/80 backdrop-blur-md transition-all cursor-pointer active:scale-95"
                >
                  HỦY BỎ
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowLogoutConfirm(false);
                    setShowAccountModal(false);
                    await handleSignOut();
                  }}
                  className="flex-1 py-3 px-5 bg-gradient-to-r from-red-500 via-rose-500 to-red-600 hover:from-red-600 hover:to-rose-600 text-white font-black text-xs sm:text-sm rounded-full transition-all duration-300 shadow-lg shadow-red-500/25 border border-red-300/40 backdrop-blur-md cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                >
                  <LogOut className="w-4 h-4" /> ĐỒNG Ý ĐĂNG XUẤT
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
