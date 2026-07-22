import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, runTransaction, query, getDocs, where } from 'firebase/firestore';
import { BAG_TYPES, SYSTEM_DEPARTMENTS, DEFAULT_SETTINGS } from '../constants';
import { BagTypeID, BorrowReturn as BorrowReturnType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export const BorrowReturn: React.FC = () => {
  const { user } = useAuth();
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
      const q = query(collection(db, 'borrowReturns'));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as BorrowReturnType));
      data.sort((a, b) => b.timestamp - a.timestamp);
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
  }, [tab]);

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
      await runTransaction(db, async (t) => {
        // References
        const borrowerInvId = `${borrowerId}_${borrowBagType}`;
        const borrowerInvRef = doc(db, 'inventory', borrowerInvId);

        // Perform all reads first
        const borrowerDoc = await t.get(borrowerInvRef);
        let currentBorrowerQty = borrowerDoc.exists() ? borrowerDoc.data().quantity || 0 : 0;

        // Perform all writes
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
          status: 'OPEN'
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
          afterData: { borrowerQty: currentBorrowerQty + qty }
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
          afterData: { borrowerQty: currentBorrowerQty - qtyToReturn }
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
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1.5 mb-6 sm:mb-8">
          <button 
            onClick={() => setTab('BORROW')}
            className={`flex-1 py-2.5 sm:py-3 rounded-lg font-black text-xs sm:text-sm transition-all ${tab === 'BORROW' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700'}`}
          >
            MƯỢN (VAY)
          </button>
          <button 
            onClick={() => setTab('RETURN')}
            className={`flex-1 py-2.5 sm:py-3 rounded-lg font-black text-xs sm:text-sm transition-all ${tab === 'RETURN' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700'}`}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {BAG_TYPES.map(bag => (
                  <button
                    type="button" key={bag.id} onClick={() => setBorrowBagType(bag.id)}
                    className={`py-2.5 sm:py-3 px-2 rounded-xl border-2 text-xs sm:text-sm font-bold transition-all ${borrowBagType === bag.id ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-500 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200 text-slate-600 hover:border-slate-300'}`}
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

            <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base sm:text-lg py-3.5 sm:py-4 rounded-xl mt-6 sm:mt-8 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
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

            <button type="submit" disabled={isSubmitting || !selectedBorrowId} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base sm:text-lg py-3.5 sm:py-4 rounded-xl mt-6 sm:mt-8 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
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
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 text-xs font-bold">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${filterStatus === 'ALL' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setFilterStatus('UNPAID')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${filterStatus === 'UNPAID' ? 'bg-white dark:bg-slate-700 shadow-sm text-red-600 dark:text-red-400' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Chưa trả đủ
              </button>
              <button
                onClick={() => setFilterStatus('PAID')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${filterStatus === 'PAID' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Đã trả xong
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
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
      </div>
    </div>
  );
};
