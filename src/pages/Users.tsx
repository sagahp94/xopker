import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, getDocs, deleteDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { User, Role } from '../types';
import toast from 'react-hot-toast';

export const Users: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add User State
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('Staff');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
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
  }, []);

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

  const handleDeleteUser = async (u: User) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa người dùng ${u.email}?`)) return;
    
    try {
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
            Quyền: {user.role}
          </span>
        </div>
      </div>

      {/* Add User */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mb-4 sm:mb-6 uppercase">Thêm Người Dùng Mới</h3>
        <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <input 
              type="email" 
              placeholder="Email người dùng (@gmail.com)"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-3.5 outline-none font-medium text-sm sm:text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              required
            />
          </div>
          <div className="w-full sm:w-48">
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value as Role)}
              className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-3.5 outline-none font-medium text-sm sm:text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="Staff">Nhân viên (Staff)</option>
              <option value="Manager">Quản lý (Manager)</option>
              <option value="Admin">Quản trị (Admin)</option>
            </select>
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-3 sm:py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 text-sm sm:text-base whitespace-nowrap"
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
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                        {u.role}
                      </span>
                      {!u.isActive && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md">
                          Đã khóa
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {u.email !== user.email && (
                  <button
                    onClick={() => handleDeleteUser(u)}
                    className="p-2 sm:p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors font-bold text-xs sm:text-sm cursor-pointer"
                  >
                    Xóa
                  </button>
                )}
              </div>
            ))}
            
            {users.length === 0 && (
              <div className="p-8 text-center text-slate-500">Chưa có người dùng nào.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
