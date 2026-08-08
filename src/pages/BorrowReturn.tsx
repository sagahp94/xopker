import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, runTransaction, query, getDocs, where, orderBy, limit } from 'firebase/firestore';
import { BAG_TYPES, SYSTEM_DEPARTMENTS, DEFAULT_SETTINGS } from '../constants';
import { BagTypeID, BorrowReturn as BorrowReturnType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useDemo } from '../contexts/DemoContext';
import { demoStore } from '../services/demoStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export const BorrowReturn: React.FC = () => {
  const { user } = useAuth();
  const { isDemoMode, notifyDemoChange } = useDemo();
  const [tab, setTab] = useState<'BORROW' | 'RETURN'>('BORROW');
  
  // Borrow State
  const [lenderId, setLenderId] = useState('');
  const [borrowerId] = useState('DEP_MAIN');
  const [borrowBagType, setBorrowBagType] = useState<BagTypeID>('BAO15');
  const [borrowQty, setBorrowQty] = useState('');

  // Return State
  const [activeBorrows, setActiveBorrows] = useState<BorrowReturnType[]>([]);
  const [selectedBorrowId, setSelectedBorrowId] = useState('');
  const [returnQty, setReturnQty] = useState('');
  const [loadingBorrows, setLoadingBorrows] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History State
  const [borrowRecords, setBorrowRecords] = useState<BorrowReturnType[]>([]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchActiveBorrows = async () => {
    setLoadingBorrows(true);
    try {
      if (isDemoMode) {
        const borrows = demoStore.getBorrows().filter(b => 
          (b.status === 'OPEN' || b.status === 'PARTIAL') && b.borrowingDepartmentId === 'DEP_MAIN'
        );
        setActiveBorrows(borrows);
        setLoadingBorrows(false);
        return;
      }

      const q = query(
        collection(db, 'borrowReturns'),
        where('status', 'in', ['OPEN', 'PARTIAL']),
        where('borrowingDepartmentId', '==', 'DEP_MAIN')
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as BorrowReturnType));
      setActiveBorrows(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBorrows(false);
    }
  };

  const fetchBorrowRecords = async () => {
    try {
      if (isDemoMode) {
        setBorrowRecords(demoStore.getBorrows());
        return;
      }

      const q = query(collection(db, 'borrowReturns'), orderBy('timestamp', 'desc'), limit(100));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as BorrowReturnType));
      setBorrowRecords(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBorrowRecords();
    if (tab === 'RETURN') {
      fetchActiveBorrows();
    }
  }, [tab, isDemoMode]);

  const handleBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lenderId.trim() === 'Cashier' || lenderId.trim() === 'Kho Chính' || lenderId.trim().toLowerCase() === 'dep_main') {
      toast.error('Bên cho vay không được là Cashier');
      return;
    }
    const qty = Number(borrowQty);
    if (!qty || qty <= 0) {
      toast.error('Số lượng không hợp lệ');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isDemoMode) {
        demoStore.borrow(lenderId, borrowerId, borrowBagType, qty, user);
        notifyDemoChange();
        toast.success('[Sandbox Demo] Ghi nhận vay thành công!');
        setBorrowQty('');
        fetchBorrowRecords();
        setIsSubmitting(false);
        return;
      }

      await runTransaction(db, async (t) => {
        // Reads
        const settingsRef = doc(db, 'settings', 'global');
        const settingsDoc = await t.get(settingsRef);
        let conversionRate = DEFAULT_SETTINGS.bao15ConversionRate;
        if (settingsDoc.exists()) {
          conversionRate = settingsDoc.data().bao15ConversionRate || conversionRate;
        }

        const borrowerInvId = `${borrowerId}_${borrowBagType}`;
        const borrowerInvRef = doc(db, 'inventory', borrowerInvId);

        const borrowerDoc = await t.get(borrowerInvRef);
        let currentBorrowerQty = borrowerDoc.exists() ? borrowerDoc.data().quantity || 0 : 0;

        // Writes
        t.set(borrowerInvRef, {
          id: borrowerInvId,
          departmentId: borrowerId,
          bagTypeId: borrowBagType,
          quantity: currentBorrowerQty + qty,
          updatedAt: Date.now()
        }, { merge: true });

        // Record Borrow
        const borrowRef = doc(collection(db, 'borrowReturns'));
        t.set(borrowRef, {
          id: borrowRef.id,
          lendingDepartmentId: lenderId,
          borrowingDepartmentId: borrowerId,
          bagTypeId: borrowBagType,
          quantityBorrowed: qty,
          quantityReturned: 0,
          timestamp: Date.now(),
          userId: user?.uid,
          userEmail: user?.email,
          status: 'OPEN',
          conversionRateAtTime: conversionRate,
        });

        const logRef = doc(collection(db, 'activityLogs'));
        t.set(logRef, {
          id: logRef.id,
          userId: user?.uid,
          userEmail: user?.email,
          timestamp: Date.now(),
          deviceInfo: navigator.userAgent,
          transactionType: 'BORROW',
          beforeData: { borrowerQty: currentBorrowerQty },
          afterData: { borrowerQty: currentBorrowerQty + qty },
          conversionRateAtTime: conversionRate,
        });
      });
      toast.success('Ghi nhận vay thành công!');
      setBorrowQty('');
      fetchBorrowRecords();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBorrowId) {
      toast.error('Vui lòng chọn khoản vay để trả');
      return;
    }
    const qtyToReturn = Number(returnQty);
    if (!qtyToReturn || qtyToReturn <= 0) {
      toast.error('Số lượng không hợp lệ');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isDemoMode) {
        demoStore.returnBorrow(selectedBorrowId, qtyToReturn, user);
        notifyDemoChange();
        toast.success('[Sandbox Demo] Trả kho thành công!');
        setReturnQty('');
        setSelectedBorrowId('');
        fetchActiveBorrows();
        fetchBorrowRecords();
        setIsSubmitting(false);
        return;
      }

      await runTransaction(db, async (t) => {
        const borrowRef = doc(db, 'borrowReturns', selectedBorrowId);
        const borrowDoc = await t.get(borrowRef);
        if (!borrowDoc.exists()) throw new Error('Không tìm thấy khoản vay');
        
        const borrowData = borrowDoc.data() as BorrowReturnType;
        const remaining = borrowData.quantityBorrowed - borrowData.quantityReturned;

        if (qtyToReturn > remaining) {
          throw new Error(`Chỉ còn nợ ${remaining}, không thể trả nhiều hơn!`);
        }

        // Deduct from borrower (current warehouse)
        const borrowerInvId = `${borrowData.borrowingDepartmentId}_${borrowData.bagTypeId}`;
        const borrowerInvRef = doc(db, 'inventory', borrowerInvId);

        // Perform all reads first
        const settingsRef = doc(db, 'settings', 'global');
        const settingsDoc = await t.get(settingsRef);
        let conversionRate = DEFAULT_SETTINGS.bao15ConversionRate;
        if (settingsDoc.exists()) {
          conversionRate = settingsDoc.data().bao15ConversionRate || conversionRate;
        }

        const borrowerDoc = await t.get(borrowerInvRef);
        let currentBorrowerQty = borrowerDoc.exists() ? borrowerDoc.data().quantity || 0 : 0;

        if (currentBorrowerQty < qtyToReturn) {
          throw new Error('Số lượng tồn kho không đủ để thực hiện trả mượn!');
        }

        // Perform all writes after
        t.set(borrowerInvRef, {
          id: borrowerInvId,
          departmentId: borrowData.borrowingDepartmentId,
          bagTypeId: borrowData.bagTypeId,
          quantity: currentBorrowerQty - qtyToReturn,
          updatedAt: Date.now()
        }, { merge: true });

        // Update Borrow Record
        const newReturned = borrowData.quantityReturned + qtyToReturn;
        const newStatus = newReturned >= borrowData.quantityBorrowed ? 'COMPLETED' : 'PARTIAL';
        t.update(borrowRef, {
          quantityReturned: newReturned,
          status: newStatus
        });

        const logRef = doc(collection(db, 'activityLogs'));
        t.set(logRef, {
          id: logRef.id,
          userId: user?.uid,
          userEmail: user?.email,
          timestamp: Date.now(),
          deviceInfo: navigator.userAgent,
          transactionType: 'RETURN',
          beforeData: { borrowerQty: currentBorrowerQty },
          afterData: { borrowerQty: currentBorrowerQty - qtyToReturn },
          conversionRateAtTime: conversionRate,
        });
      });
      toast.success('Trả kho thành công!');
      setReturnQty('');
      setSelectedBorrowId('');
      fetchActiveBorrows();
      fetchBorrowRecords();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRecords = borrowRecords.filter(b => {
    // Status Filter
    const isPaid = b.status === 'COMPLETED';
    if (filterStatus === 'UNPAID' && isPaid) return false;
    if (filterStatus === 'PAID' && !isPaid) return false;

    // Search Term
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const lender = b.lendingDepartmentId.toLowerCase();
      const borrower = b.borrowingDepartmentId.toLowerCase();
      const email = (b.userEmail || '').toLowerCase();
      return lender.includes(term) || borrower.includes(term) || email.includes(term);
    }

    return true;
  });

  return (
    <div className="space-y-8 max-w-4xl mx-auto px-1 sm:px-4 pb-28 sm:pb-8">
      {/* Top Card: Form */}
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex bg-slate-100/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-full p-1.5 mb-6 sm:mb-8 border border-slate-200/80 dark:border-slate-700/80">
          <button 
            type="button"
            onClick={() => setTab('BORROW')}
            className={`flex-1 py-2.5 sm:py-3 rounded-full font-black text-xs sm:text-sm transition-all duration-300 backdrop-blur-md ${
              tab === 'BORROW' 
                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/25 border border-sky-300/40 ring-2 ring-sky-400/30' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            MƯỢN (VAY)
          </button>
          <button 
            type="button"
            onClick={() => setTab('RETURN')}
            className={`flex-1 py-2.5 sm:py-3 rounded-full font-black text-xs sm:text-sm transition-all duration-300 backdrop-blur-md ${
              tab === 'RETURN' 
                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/25 border border-sky-300/40 ring-2 ring-sky-400/30' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            TRẢ LẠI
          </button>
        </div>

        {tab === 'BORROW' && (
          <form onSubmit={handleBorrow} className="space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Bên cho vay</label>
                <input 
                  type="text"
                  placeholder="Nhập tên bên cho vay"
                  value={lenderId} onChange={e => setLenderId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-3.5 outline-none font-medium text-sm sm:text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Bên vay (Kho hiện tại)</label>
                <input 
                  type="text"
                  value="Cashier"
                  disabled
                  className="w-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-3.5 outline-none font-bold text-sm sm:text-base text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Loại Bao</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {BAG_TYPES.map(bag => (
                  <button
                    type="button" 
                    key={bag.id} 
                    onClick={() => setBorrowBagType(bag.id)}
                    className={`py-3 px-3 rounded-full text-xs sm:text-sm font-extrabold transition-all duration-300 backdrop-blur-md cursor-pointer ${
                      borrowBagType === bag.id 
                        ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white border border-sky-300/40 shadow-md shadow-sky-500/25 ring-2 ring-sky-400/30' 
                        : 'bg-white/60 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-sky-400/50'
                    }`}
                  >
                    {bag.name}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Số lượng (bao)</label>
              <input 
                type="number" min="1" value={borrowQty} onChange={e => setBorrowQty(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-3.5 outline-none font-bold text-lg sm:text-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" required
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-600 hover:to-purple-700 text-white font-black text-base sm:text-lg py-4 px-8 rounded-full mt-6 sm:mt-8 transition-all duration-300 shadow-xl shadow-indigo-500/25 border border-sky-300/30 backdrop-blur-md cursor-pointer disabled:opacity-50 active:scale-98"
            >
              XÁC NHẬN VAY
            </button>
          </form>
        )}

        {tab === 'RETURN' && (
          <form onSubmit={handleReturn} className="space-y-5 sm:space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Khoản vay chưa trả</label>
              {loadingBorrows ? (
                <div className="p-4 text-center text-slate-500 font-medium">Đang tải...</div>
              ) : (
                <select 
                  value={selectedBorrowId} onChange={e => setSelectedBorrowId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-3.5 outline-none font-medium text-sm sm:text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" required
                >
                  <option value="">-- Chọn khoản vay --</option>
                  {activeBorrows.map(b => {
                    const lender = b.lendingDepartmentId === 'DEP_MAIN' ? 'Cashier' : b.lendingDepartmentId;
                    const borrower = b.borrowingDepartmentId === 'DEP_MAIN' ? 'Cashier' : b.borrowingDepartmentId;
                    const remaining = b.quantityBorrowed - b.quantityReturned;
                    const unit = 'bao';
                    return (
                      <option key={b.id} value={b.id}>
                        {borrower} nợ {lender}: {remaining} {unit} ({b.bagTypeId})
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {selectedBorrowId && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Số lượng trả</label>
                <input 
                  type="number" min="1" value={returnQty} onChange={e => setReturnQty(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-3.5 outline-none font-bold text-lg sm:text-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" required
                />
              </div>
            )}

            <button 
              type="submit" 
              disabled={isSubmitting || !selectedBorrowId} 
              className="w-full bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-600 hover:to-purple-700 text-white font-black text-base sm:text-lg py-4 px-8 rounded-full mt-6 sm:mt-8 transition-all duration-300 shadow-xl shadow-indigo-500/25 border border-sky-300/30 backdrop-blur-md cursor-pointer disabled:opacity-50 active:scale-98"
            >
              XÁC NHẬN TRẢ
            </button>
          </form>
        )}
      </div>

      {/* Bottom Card: History & Slips */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/15">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <FileText className="w-5.5 h-5.5 text-indigo-500" /> Lịch Sử Vay Trả & Phiếu Vay
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Danh sách các phiếu mượn bao bì giữa các bộ phận</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Tìm theo bộ phận, email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
            />
            <div className="flex bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full p-1 text-xs font-bold border border-slate-200/80 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-3.5 py-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  filterStatus === 'ALL' 
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20 border border-sky-300/30' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('UNPAID')}
                className={`px-3.5 py-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  filterStatus === 'UNPAID' 
                    ? 'bg-gradient-to-r from-rose-500 to-amber-600 text-white shadow-md shadow-rose-500/20 border border-rose-300/30' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Chưa trả đủ
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('PAID')}
                className={`px-3.5 py-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  filterStatus === 'PAID' 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 border border-emerald-300/30' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Đã trả xong
              </button>
            </div>
          </div>
        </div>

        <div>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Mã Phiếu</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Thời gian</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Bên Cho Vay</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">→</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Bên Vay</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Chi Tiết Vay</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 font-medium">
                      Không có phiếu vay nào phù hợp bộ lọc
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(b => {
                    const remaining = b.quantityBorrowed - b.quantityReturned;
                    const unit = 'bao';
                    const percent = Math.min(100, Math.max(0, Math.round((b.quantityReturned / b.quantityBorrowed) * 100)));

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30 transition-colors">
                        {/* Slip Code */}
                        <td className="py-4 px-4 font-mono font-bold text-slate-400">
                          #{b.id.substring(0, 6).toUpperCase()}
                        </td>

                        {/* Time */}
                        <td className="py-4 px-4 font-medium text-slate-500 whitespace-nowrap">
                          {format(new Date(b.timestamp), 'dd/MM/yyyy HH:mm')}
                        </td>

                        {/* Lender */}
                        <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">
                          {b.lendingDepartmentId === 'DEP_MAIN' ? 'Cashier' : b.lendingDepartmentId}
                        </td>

                        {/* Arrow */}
                        <td className="py-4 px-4 text-center text-slate-400 font-bold">
                          →
                        </td>

                        {/* Borrower */}
                        <td className="py-4 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                          {b.borrowingDepartmentId === 'DEP_MAIN' ? 'Cashier' : b.borrowingDepartmentId}
                        </td>

                        {/* Borrow details */}
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <div className="font-bold text-slate-800 dark:text-slate-200">
                              Mượn: {b.quantityBorrowed.toLocaleString('vi-VN')} {unit} ({b.bagTypeId})
                            </div>
                            <div className="text-[10px] text-slate-400 font-semibold">
                              Đã trả: {b.quantityReturned.toLocaleString('vi-VN')} | Còn nợ: {remaining.toLocaleString('vi-VN')}
                            </div>
                            {/* Mini Progress Bar */}
                            <div className="w-32 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  b.status === 'COMPLETED' 
                                    ? 'bg-emerald-500' 
                                    : b.status === 'PARTIAL' 
                                      ? 'bg-amber-500' 
                                      : 'bg-red-500'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="flex flex-col items-end gap-1">
                            {b.status === 'COMPLETED' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Đã trả đủ
                              </span>
                            ) : b.status === 'PARTIAL' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full">
                                <Clock className="w-3.5 h-3.5" /> Trả một phần
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2.5 py-1 rounded-full">
                                <AlertCircle className="w-3.5 h-3.5" /> Chưa trả
                              </span>
                            )}
                            <span className="text-[9px] text-slate-400 font-medium" title={b.userEmail}>
                              Ghi bởi: {b.userEmail?.split('@')[0]}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="block md:hidden p-4 space-y-3">
            {filteredRecords.length === 0 ? (
              <div className="py-8 text-center text-slate-500 font-medium text-xs">
                Không có phiếu vay nào phù hợp bộ lọc
              </div>
            ) : (
              filteredRecords.map(b => {
                const remaining = b.quantityBorrowed - b.quantityReturned;
                const percent = Math.min(100, Math.max(0, Math.round((b.quantityReturned / b.quantityBorrowed) * 100)));

                return (
                  <div key={b.id} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
                      <span className="font-mono font-bold text-xs text-slate-400">
                        #{b.id.substring(0, 6).toUpperCase()}
                      </span>
                      {b.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Đã trả đủ
                        </span>
                      ) : b.status === 'PARTIAL' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full">
                          <Clock className="w-3 h-3" /> Trả 1 phần
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2.5 py-1 rounded-full">
                          <AlertCircle className="w-3 h-3" /> Chưa trả
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-900 dark:text-white">{b.lendingDepartmentId === 'DEP_MAIN' ? 'Cashier' : b.lendingDepartmentId}</span>
                      <span className="text-slate-400 font-black">→</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{b.borrowingDepartmentId === 'DEP_MAIN' ? 'Cashier' : b.borrowingDepartmentId}</span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl text-xs space-y-1.5 border border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                        <span>Số lượng vay ({b.bagTypeId}):</span>
                        <span className="text-indigo-600 dark:text-indigo-400">{b.quantityBorrowed.toLocaleString('vi-VN')} bao</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Đã trả: {b.quantityReturned.toLocaleString('vi-VN')} bao</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">Còn nợ: {remaining.toLocaleString('vi-VN')} bao</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            b.status === 'COMPLETED' ? 'bg-emerald-500' : b.status === 'PARTIAL' ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>{format(new Date(b.timestamp), 'dd/MM/yyyy HH:mm')}</span>
                      <span>Ghi bởi: {b.userEmail?.split('@')[0]}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
