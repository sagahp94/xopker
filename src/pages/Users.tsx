import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, getDocs, deleteDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useDemo } from '../contexts/DemoContext';
import { demoStore } from '../services/demoStore';
import { User, Role } from '../types';
import toast from 'react-hot-toast';
import { ShieldCheck, AlertTriangle, Shield } from 'lucide-react';

export const Users: React.FC = () => {
  const { user } = useAuth();
  const { isDemoMode, notifyDemoChange } = useDemo();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add User State
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('Staff');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit User Display Name State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // 2nd Confirmation for Role Change
  const [pendingRoleChange, setPendingRoleChange] = useState<{ user: User; newRole: Role } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      if (isDemoMode) {
        setUsers(demoStore.getUsers());
        setLoading(false);
        return;
      }

      const snap = await getDocs(collection(db, 'users'));
      const rawData = snap.docs.map(d => ({ id: d.id, ...d.data() } as any) as User);
      
      // Deduplicate users by email, preferring logged-in/activated accounts
      const userMap = new Map<string, User>();
      const docIdsToDelete: string[] = [];

      rawData.forEach(u => {
        const emailKey = u.email ? u.email.trim().toLowerCase() : u.id;
        if (!userMap.has(emailKey)) {
          userMap.set(emailKey, u);
        } else {
          const existing = userMap.get(emailKey)!;
          // Check which one is the logged-in profile vs placeholder
          const isULoggedIn = Boolean(u.uid && u.displayName && u.displayName !== 'Chưa đăng nhập');
          const isExistingLoggedIn = Boolean(existing.uid && existing.displayName && existing.displayName !== 'Chưa đăng nhập');

          if (isULoggedIn && !isExistingLoggedIn) {
            // Keep u, flag existing for deletion
            if (existing.id && existing.id !== u.id) {
              docIdsToDelete.push(existing.id);
            }
            userMap.set(emailKey, u);
          } else if (!isULoggedIn && isExistingLoggedIn) {
            // Keep existing, flag u for deletion
            if (u.id && u.id !== existing.id) {
              docIdsToDelete.push(u.id);
            }
          } else {
            // If both are logged in or both are placeholders, keep the newest one
            if ((u.createdAt || 0) >= (existing.createdAt || 0)) {
              if (existing.id && existing.id !== u.id) {
                docIdsToDelete.push(existing.id);
              }
              userMap.set(emailKey, u);
            } else {
              if (u.id && u.id !== existing.id) {
                docIdsToDelete.push(u.id);
              }
            }
          }
        }
      });

      const cleanUsers = Array.from(userMap.values());
      setUsers(cleanUsers);

      // Auto-clean any duplicate pre-approved documents from Firestore
      if (docIdsToDelete.length > 0) {
        for (const docId of docIdsToDelete) {
          try {
            await deleteDoc(doc(db, 'users', docId));
          } catch (e) {
            console.warn("Failed auto cleanup of duplicate user doc:", docId, e);
          }
        }
      }
    } catch (error: any) {
      toast.error('Lỗi khi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [isDemoMode]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!normalizedEmail) return;

    // Check if user with this email already exists
    const existing = users.find(u => u.email.trim().toLowerCase() === normalizedEmail);
    if (existing) {
      toast.error('Email người dùng này đã có trong danh sách!');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isDemoMode) {
        demoStore.addUser(normalizedEmail, newRole);
        notifyDemoChange();
        toast.success('[Sandbox Demo] Thêm người dùng thành công');
        setNewEmail('');
        setNewRole('Staff');
        fetchUsers();
        setIsSubmitting(false);
        return;
      }

      // We use email as the document ID for pre-approved users
      const userRef = doc(db, 'users', normalizedEmail);
      const newUser: Partial<User> = {
        email: normalizedEmail,
        role: newRole,
        isActive: true,
        createdAt: Date.now(),
        uid: '', // Will be filled when they sign in
        displayName: 'Chưa đăng nhập',
        photoURL: null,
      };

      await setDoc(userRef, newUser);
      toast.success('Thêm người dùng thành công');
      setNewEmail('');
      setNewRole('Staff');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi thêm người dùng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!editingUser) return;
    const newName = editDisplayName.trim();
    if (!newName) {
      toast.error('Tên hiển thị không được để trống');
      return;
    }
    setIsSavingName(true);
    try {
      if (isDemoMode) {
        demoStore.updateDisplayName(editingUser.id || editingUser.email, newName);
        notifyDemoChange();
        toast.success('[Sandbox Demo] Đã cập nhật tên hiển thị người dùng');
        setEditingUser(null);
        fetchUsers();
        setIsSavingName(false);
        return;
      }

      if (editingUser.id) {
        await setDoc(doc(db, 'users', editingUser.id), { displayName: newName }, { merge: true });
      }
      if (editingUser.email && editingUser.email !== editingUser.id) {
        try {
          await setDoc(doc(db, 'users', editingUser.email.trim().toLowerCase()), { displayName: newName }, { merge: true });
        } catch (e) {}
      }
      if (editingUser.uid && editingUser.uid !== editingUser.id) {
        try {
          await setDoc(doc(db, 'users', editingUser.uid), { displayName: newName }, { merge: true });
        } catch (e) {}
      }
      toast.success('Đã cập nhật tên hiển thị người dùng');
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error('Lỗi khi đổi tên người dùng');
      console.error(err);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleUpdateRole = async (targetUser: User, newRole: Role) => {
    if (targetUser.role === 'Admin') {
      toast.error('Không thể thay đổi phân quyền của tài khoản Admin');
      return;
    }
    if (targetUser.role === newRole) return;

    try {
      if (isDemoMode) {
        demoStore.updateRole(targetUser.id || targetUser.email, newRole);
        notifyDemoChange();
        const roleLabel = newRole === 'Admin' ? 'Quản Trị Viên' : newRole === 'Manager' ? 'Quản Lý' : 'Nhân Viên';
        toast.success(`[Sandbox Demo] Đã cập nhật quyền của ${targetUser.email} thành ${roleLabel}`);
        fetchUsers();
        return;
      }

      if (targetUser.id) {
        await setDoc(doc(db, 'users', targetUser.id), { role: newRole }, { merge: true });
      }
      if (targetUser.email && targetUser.email !== targetUser.id) {
        try {
          await setDoc(doc(db, 'users', targetUser.email.trim().toLowerCase()), { role: newRole }, { merge: true });
        } catch (e) {}
      }
      if (targetUser.uid && targetUser.uid !== targetUser.id) {
        try {
          await setDoc(doc(db, 'users', targetUser.uid), { role: newRole }, { merge: true });
        } catch (e) {}
      }
      const roleLabel = newRole === 'Admin' ? 'Quản Trị Viên' : newRole === 'Manager' ? 'Quản Lý' : 'Nhân Viên';
      toast.success(`Đã cập nhật quyền của ${targetUser.email} thành ${roleLabel}`);
      fetchUsers();
    } catch (error: any) {
      toast.error('Lỗi khi thay đổi phân quyền người dùng');
      console.error(error);
    }
  };

  const handleDeleteUser = async (u: User) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa người dùng ${u.email}?`)) return;
    
    try {
      if (isDemoMode) {
        demoStore.deleteUser(u.id || u.email);
        notifyDemoChange();
        toast.success('[Sandbox Demo] Xóa người dùng thành công');
        fetchUsers();
        return;
      }

      if (u.id) {
        await deleteDoc(doc(db, 'users', u.id));
      }
      if (u.email && u.email !== u.id) {
        try {
          await deleteDoc(doc(db, 'users', u.email.trim().toLowerCase()));
        } catch (e) {}
      }
      if (u.uid && u.uid !== u.id) {
        try {
          await deleteDoc(doc(db, 'users', u.uid));
        } catch (e) {}
      }
      toast.success('Xóa người dùng thành công');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi xóa người dùng');
    }
  };

  if (user?.role !== 'Admin') {
    return (
      <div className="p-8 text-center text-slate-500">
        Bạn không có quyền truy cập trang này.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-28 sm:pb-8">
      {/* Current User Info */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
        {user.photoURL ? (
          <img src={user.photoURL} alt={user.displayName || user.email} className="w-16 h-16 rounded-full border-4 border-slate-50 dark:border-slate-800" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-2xl shrink-0">
            {user.email?.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col items-center sm:items-start">
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
            {user.displayName || 'Chưa cập nhật tên'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">{user.email}</p>
          <span className="inline-block mt-2 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-full">
            Quyền: {user.role === 'Admin' ? 'Quản Trị Viên' : user.role === 'Manager' ? 'Quản Lý' : 'Nhân Viên'}
          </span>
        </div>
      </div>

      {/* Add User */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-5 sm:p-7 shadow-xl shadow-slate-900/5 border border-slate-200/80 dark:border-slate-800/80">
        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mb-4 sm:mb-6 uppercase tracking-tight">Thêm Người Dùng Mới</h3>
        <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <input 
              type="email" 
              placeholder="Email người dùng (@gmail.com)"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-full px-5 py-3.5 outline-none font-medium text-sm sm:text-base focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 backdrop-blur-md transition-all shadow-xs"
              required
            />
          </div>
          <div className="w-full sm:w-48">
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value as Role)}
              className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-full px-5 py-3.5 outline-none font-bold text-sm sm:text-base focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 backdrop-blur-md cursor-pointer transition-all shadow-xs text-slate-800 dark:text-slate-100"
            >
              <option value="Staff">Nhân Viên</option>
              <option value="Manager">Quản Lý</option>
              <option value="Admin">Quản Trị Viên</option>
            </select>
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-600 hover:to-purple-700 text-white font-black rounded-full transition-all duration-300 shadow-xl shadow-indigo-500/20 border border-sky-300/30 backdrop-blur-md active:scale-95 disabled:opacity-50 text-sm sm:text-base whitespace-nowrap cursor-pointer"
          >
            Thêm Ngay
          </button>
        </form>
      </div>

      {/* User List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase">Danh Sách Người Dùng</h3>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-slate-500 font-medium">Đang tải...</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map(u => (
              <div key={u.id || u.uid || u.email} className="p-4 sm:p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-3 sm:gap-4">
                  {u.photoURL ? (
                    <img src={u.photoURL} alt={u.email} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold text-lg sm:text-xl shrink-0">
                      {u.email.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                      {u.displayName || 'Chưa đăng nhập'}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-500 truncate max-w-[150px] sm:max-w-none">{u.email}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {u.role === 'Admin' ? (
                        <span 
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-500/15 to-indigo-500/15 text-purple-700 dark:text-purple-300 border border-purple-400/40 rounded-full text-xs font-black backdrop-blur-md shadow-xs" 
                          title="Tài khoản Admin không thể thay đổi phân quyền"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                          Quản Trị Viên
                        </span>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Phân quyền:</span>
                          <select
                            value={u.role}
                            onChange={(e) => {
                              const newRoleVal = e.target.value as Role;
                              if (newRoleVal !== u.role) {
                                setPendingRoleChange({ user: u, newRole: newRoleVal });
                              }
                            }}
                            className="bg-white/80 dark:bg-slate-900/80 border border-sky-400/40 dark:border-sky-400/50 rounded-full px-3.5 py-1 text-xs font-extrabold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 text-slate-800 dark:text-slate-100 cursor-pointer backdrop-blur-xl transition-all shadow-md hover:border-sky-400"
                          >
                            <option value="Staff">Nhân Viên</option>
                            <option value="Manager">Quản Lý</option>
                            <option value="Admin">Quản Trị Viên</option>
                          </select>
                        </div>
                      )}

                      {!u.isActive && (
                        <span className="text-[10px] font-bold px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full border border-red-200 dark:border-red-800">
                          Đã khóa
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingUser(u);
                      setEditDisplayName(u.displayName || '');
                    }}
                    className="p-2 sm:px-3 sm:py-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-colors font-bold text-xs sm:text-sm cursor-pointer"
                  >
                    Sửa Tên
                  </button>

                  {u.email !== user.email && (
                    <button
                      onClick={() => handleDeleteUser(u)}
                      className="p-2 sm:px-3 sm:py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors font-bold text-xs sm:text-sm cursor-pointer"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {users.length === 0 && (
              <div className="p-8 text-center text-slate-500">Chưa có người dùng nào.</div>
            )}
          </div>
        )}
      </div>

      {/* Edit Display Name Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">Sửa Tên Hiển Thị</h3>
            <p className="text-xs text-slate-500">
              Đổi tên hiển thị đại diện cho email <strong>{editingUser.email}</strong>
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Tên Hiển Thị Mới</label>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Nhập tên hiển thị..."
                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveDisplayName}
                disabled={isSavingName}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSavingName ? 'Đang lưu...' : 'Lưu Tên Hiển Thị'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 2nd Confirmation Modal Banner for Role Change */}
      {pendingRoleChange && (
        <div 
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPendingRoleChange(null)}
        >
          <div 
            className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-sky-400/40 dark:border-sky-400/30 space-y-5 text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10 border border-amber-400/30 backdrop-blur-md">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Xác Nhận Thay Đổi Phân Quyền
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                Bạn có chắc chắn muốn thay đổi quyền hạn tài khoản <strong className="text-sky-600 dark:text-sky-400 font-bold">{pendingRoleChange.user.email}</strong> từ <span className="px-2.5 py-1 rounded-full bg-slate-200/80 dark:bg-slate-800/80 font-bold text-xs text-slate-800 dark:text-slate-200">{pendingRoleChange.user.role === 'Admin' ? 'Quản Trị Viên' : pendingRoleChange.user.role === 'Manager' ? 'Quản Lý' : 'Nhân Viên'}</span> sang <strong className="px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-700 dark:text-sky-300 font-black text-xs border border-sky-400/30">{pendingRoleChange.newRole === 'Admin' ? 'Quản Trị Viên' : pendingRoleChange.newRole === 'Manager' ? 'Quản Lý' : 'Nhân Viên'}</strong>?
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingRoleChange(null)}
                className="flex-1 py-3 px-5 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs sm:text-sm rounded-full border border-slate-200/80 dark:border-slate-700/80 backdrop-blur-md transition-all cursor-pointer active:scale-95"
              >
                HỦY BỎ
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = pendingRoleChange.user;
                  const newRole = pendingRoleChange.newRole;
                  setPendingRoleChange(null);
                  await handleUpdateRole(target, newRole);
                }}
                className="flex-1 py-3 px-5 bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-600 hover:to-purple-700 text-white font-black text-xs sm:text-sm rounded-full transition-all duration-300 shadow-lg shadow-sky-500/25 border border-sky-300/40 backdrop-blur-md cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <Shield className="w-4 h-4" /> ĐỒNG Ý THAY ĐỔI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
