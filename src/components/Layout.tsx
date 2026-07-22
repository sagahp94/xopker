import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
import { getOfflineQueue, removeOfflineTransaction, syncSingleTransaction, OfflineTransaction } from '../lib/offlineSync';
import toast from 'react-hot-toast';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NAV_ITEMS = [
  { 
    path: '/', 
    label: 'Dashboard', 
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
    roles: ['Admin'],
    activeBg: 'bg-gradient-to-tr from-slate-700 to-slate-900 dark:from-slate-600 dark:to-slate-800 text-white ring-4 ring-slate-500/25 border-2 border-slate-300 dark:border-slate-400 shadow-md shadow-slate-500/20',
    inactiveBg: 'bg-slate-500/10 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 group-hover:bg-slate-500/20 dark:group-hover:bg-slate-500/30',
    activeText: 'text-slate-800 dark:text-slate-200',
    cardActiveBorder: 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
  },
];

export const Layout: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = React.useState<OfflineTransaction[]>([]);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncResults, setSyncResults] = React.useState<{ success: number; failed: { id: string; error: string; tx: OfflineTransaction }[] } | null>(null);

  const [showAccountModal, setShowAccountModal] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

  const greetingInfo = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) {
      return { text: 'Chào buổi sáng', icon: Sunrise, color: 'text-amber-500' };
    }
    if (hour >= 11 && hour < 14) {
      return { text: 'Chào buổi trưa', icon: Sun, color: 'text-amber-500' };
    }
    if (hour >= 14 && hour < 18) {
      return { text: 'Chào buổi chiều', icon: Sunset, color: 'text-orange-500' };
    }
    return { text: 'Chào buổi tối', icon: Moon, color: 'text-indigo-400' };
  }, []);

  const displayName = React.useMemo(() => {
    if (user?.displayName) {
      // Remove parenthetical nicknames like (SaGa)
      const clean = user.displayName.replace(/\s*\([^)]*\)/g, '').trim();
      const words = clean.split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        const vnSurnames = ['Lê', 'Nguyễn', 'Phạm', 'Trần', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đào', 'Đoàn', 'Hoàng', 'Huỳnh', 'Phan'];
        if (words.length > 1 && vnSurnames.includes(words[0])) {
          return words[words.length - 1]; // e.g. "Lê Công Thành" -> "Thành"
        }
        return words[0]; // e.g. "Thành Lê Công" -> "Thành"
      }
      return clean;
    }
    if (user?.email) {
      const handle = user.email.split('@')[0];
      const firstPart = handle.split(/[\._-]/)[0];
      return firstPart ? firstPart.charAt(0).toUpperCase() + firstPart.slice(1) : handle;
    }
    return 'bạn';
  }, [user]);

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
    let successCount = 0;
    const failedList: { id: string; error: string; tx: OfflineTransaction }[] = [];

    const itemsToSync = [...queue];

    for (const tx of itemsToSync) {
      try {
        await syncSingleTransaction(tx);
        removeOfflineTransaction(tx.id);
        successCount++;
      } catch (err: any) {
        console.error('Offline Sync Error:', err);
        failedList.push({
          id: tx.id,
          error: err.message || 'Lỗi không xác định',
          tx
        });
        
        if (err.message && err.message.includes('Không đủ tồn kho')) {
          // This transaction cannot be processed (business logic error)
          // We remove it from the main queue but record it in the failed list so the user knows
          removeOfflineTransaction(tx.id);
        } else {
          // Connection error or firestore permission error: stop to try again later
          toast.error('Gặp lỗi mạng hoặc hệ thống khi đồng bộ. Tạm dừng tiến trình.');
          break;
        }
      }
    }

    setIsSyncing(false);
    setSyncResults({
      success: successCount,
      failed: failedList
    });

    if (successCount > 0) {
      toast.success(`Đã đồng bộ thành công ${successCount} giao dịch ngoại tuyến!`);
    }
    if (failedList.length > 0) {
      toast.error(`Đồng bộ thất bại ${failedList.length} giao dịch.`);
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
          <div className="w-10 h-10 rounded-xl bg-[#B41C8C] flex items-center justify-center text-white shadow-sm flex-shrink-0">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-2xl tracking-tighter text-slate-800 dark:text-slate-100 leading-none">XỐPKER</span>
            <span className="text-[10px] font-bold text-[#B41C8C] mt-1 tracking-wider">v1.0</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {allowedNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-3.5 px-3 py-2.5 rounded-2xl transition-all duration-200 group cursor-pointer my-1 border",
                isActive 
                  ? cn(item.cardActiveBorder, "font-bold shadow-sm") 
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
              )}
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    "flex items-center justify-center transition-all duration-300 shrink-0 rounded-xl",
                    isActive 
                      ? cn("w-10 h-10 scale-105", item.activeBg) 
                      : cn("w-9 h-9", item.inactiveBg)
                  )}>
                    <item.icon className={cn("transition-transform", isActive ? "w-5 h-5 text-white" : "w-4.5 h-4.5")} />
                  </div>
                  <span className={cn("text-sm transition-all", isActive ? cn("font-black tracking-wide", item.activeText) : "font-semibold")}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={() => setShowAccountModal(true)}
            className="w-full text-left flex items-center gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all border border-slate-200/80 dark:border-slate-800 shadow-2xs group cursor-pointer"
            title="Xem thông tin tài khoản"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-500/30 shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div className="overflow-hidden flex-1 min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <greetingInfo.icon className={cn("w-3.5 h-3.5 shrink-0", greetingInfo.color)} />
                <p className="text-xs font-extrabold truncate text-slate-800 dark:text-slate-100">
                  {greetingInfo.text}, <strong className="font-black text-indigo-600 dark:text-indigo-400">{displayName}!</strong>
                </p>
              </div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                <Shield className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                {user?.role === 'Admin' ? 'Quản trị viên' : user?.role === 'Manager' ? 'Quản lý' : 'Nhân viên'}
              </p>
            </div>
            <User className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-3 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 z-20 gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-[#B41C8C] flex items-center justify-center text-white flex-shrink-0">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-base text-slate-800 dark:text-slate-100 leading-none">XỐPKER</span>
              <span className="text-[8px] font-bold text-[#B41C8C] mt-0.5 tracking-wider">v1.0</span>
            </div>
          </div>

          {/* Integrated Account & Greeting Button */}
          <button 
            onClick={() => setShowAccountModal(true)}
            className="flex items-center gap-2 py-1.5 px-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200/80 dark:border-slate-800 shadow-2xs active:scale-95 cursor-pointer min-w-0 max-w-[70%]"
            title="Thông tin tài khoản"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-7 h-7 rounded-full object-cover ring-2 ring-indigo-500/30 shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            
            <div className="flex items-center gap-1 min-w-0 truncate">
              <greetingInfo.icon className={cn("w-3.5 h-3.5 shrink-0", greetingInfo.color)} />
              <span className="truncate text-xs font-extrabold text-slate-800 dark:text-slate-100">
                {greetingInfo.text}, <strong className="font-black text-indigo-600 dark:text-indigo-400">{displayName}!</strong>
              </span>
            </div>
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
        <div className="md:hidden fixed bottom-0 left-0 right-0 overflow-x-auto bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 hide-scrollbar shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.5)] z-40 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
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
                  {({ isActive }) => (
                    <>
                      <div className={cn(
                        "flex items-center justify-center transition-all duration-300 shrink-0 rounded-xl",
                        isActive 
                          ? cn("w-11 h-11 -translate-y-2 scale-105 shadow-xl ring-4", item.activeBg) 
                          : cn("w-9 h-9 opacity-85 hover:opacity-100", item.inactiveBg)
                      )}>
                        <item.icon className={cn("transition-transform duration-300", isActive ? "w-5.5 h-5.5 text-white" : "w-5 h-5")} />
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
                  )}
                </NavLink>
              ))}
          </nav>
        </div>

        {/* Mobile Account Info Modal */}
        {showAccountModal && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex items-start justify-center pt-4 sm:pt-12 px-3 sm:px-4 animate-in fade-in duration-200"
            onClick={() => setShowAccountModal(false)}
          >
            <div 
              className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 relative animate-in slide-in-from-top-5 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setShowAccountModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header Profile Summary */}
              <div className="flex items-center gap-3.5 pr-8">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-12 h-12 rounded-full object-cover ring-4 ring-indigo-500/20 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-black text-lg flex items-center justify-center shadow-md shrink-0">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                    {user?.displayName || 'Người dùng'}
                  </h3>
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-0.5">
                    <Shield className="w-3.5 h-3.5" />
                    {user?.role === 'Admin' ? 'Quản trị viên' : user?.role === 'Manager' ? 'Quản lý' : 'Nhân viên'}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>

              {/* Account details list */}
              <div className="space-y-3">
                {/* Email */}
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email tài khoản</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 break-all">{user?.email || 'Chưa cập nhật'}</span>
                  </div>
                </div>

                {/* Role */}
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Loại tài khoản</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {user?.role === 'Admin' ? 'Quản trị viên (Admin)' : user?.role === 'Manager' ? 'Quản lý (Manager)' : 'Nhân viên (Staff)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Red Signout Button */}
              <div className="pt-2">
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full py-3.5 px-4 bg-red-600 hover:bg-red-700 active:scale-98 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all cursor-pointer"
                >
                  <LogOut className="w-4.5 h-4.5" />
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logout Confirmation Dialog */}
        {showLogoutConfirm && (
          <div 
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <div 
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 text-center animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto shadow-inner">
                <AlertTriangle className="w-7 h-7 animate-bounce" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Xác Nhận Đăng Xuất
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  Bạn có chắc chắn muốn đăng xuất khỏi tài khoản <strong className="text-slate-800 dark:text-slate-200">{user?.email}</strong> không?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={async () => {
                    setShowLogoutConfirm(false);
                    setShowAccountModal(false);
                    await handleSignOut();
                  }}
                  className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition-all cursor-pointer"
                >
                  Đăng Xuất
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
