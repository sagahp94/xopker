import { BagTypeID, User, AppSettings, BorrowReturn, ActivityLog } from '../types';
import { DEFAULT_SETTINGS, SYSTEM_DEPARTMENTS } from '../constants';

export interface DemoImportExportItem {
  id: string;
  departmentId: string;
  bagTypeId: BagTypeID;
  quantity: number;
  timestamp: number;
  userId: string;
  userEmail: string;
  conversionRateAtTime?: number;
}

export interface DemoStockCheckRecord {
  id: string;
  departmentId: string;
  bagTypeId: BagTypeID;
  systemQty: number;
  actualQty: number;
  difference: number;
  timestamp: number;
  userId: string;
  userEmail: string;
}

const INITIAL_INVENTORY: Record<string, number> = {
  BAO15: 1250, // in kg
  BAO20: 320,  // in bao
  BAO25: 450,  // in bao
  BAO30: 280,  // in bao
  BAO37: 180,  // in bao
};

const INITIAL_SETTINGS = {
  bao15ConversionRate: DEFAULT_SETTINGS.bao15ConversionRate || 10,
  allowCustomExportDate: DEFAULT_SETTINGS.allowCustomExportDate ?? true,
  adminDisplayName: 'Admin Demo',
  updatedAt: Date.now(),
  updatedBy: 'demo',
};

const INITIAL_USERS: User[] = [
  {
    uid: 'demo-manager-uid',
    email: 'demomanager@xopker.com',
    displayName: 'Demo Quản Lý',
    photoURL: null,
    role: 'Manager',
    isActive: true,
    createdAt: Date.now() - 86400000 * 30,
    isDemo: true,
  },
  {
    uid: 'demo-staff-uid',
    email: 'demostaff@xopker.com',
    displayName: 'Demo Nhân Viên',
    photoURL: null,
    role: 'Staff',
    isActive: true,
    createdAt: Date.now() - 86400000 * 20,
    isDemo: true,
  },
  {
    uid: 'staff-1',
    email: 'nhanvien.kho@xopker.com',
    displayName: 'Nguyễn Văn Nam (Nhân Viên)',
    photoURL: null,
    role: 'Staff',
    isActive: true,
    createdAt: Date.now() - 86400000 * 10,
  },
  {
    uid: 'manager-1',
    email: 'quanly.kho@xopker.com',
    displayName: 'Trần Thị Mai (Quản Lý)',
    photoURL: null,
    role: 'Manager',
    isActive: true,
    createdAt: Date.now() - 86400000 * 15,
  },
];

const generateSampleLogs = (): ActivityLog[] => {
  const now = Date.now();
  return [
    {
      id: 'log-1',
      userId: 'demo-manager-uid',
      userEmail: 'demomanager@xopker.com',
      timestamp: now - 3600000,
      deviceInfo: 'Demo Sandbox Session',
      transactionType: 'IMPORT',
      afterData: { bagTypeId: 'BAO20', quantity: 50 },
    },
    {
      id: 'log-2',
      userId: 'demo-staff-uid',
      userEmail: 'demostaff@xopker.com',
      timestamp: now - 7200000,
      deviceInfo: 'Demo Sandbox Session',
      transactionType: 'EXPORT',
      afterData: { bagTypeId: 'BAO15', quantity: 100 },
    },
  ];
};

const generateSampleImports = (): DemoImportExportItem[] => {
  const now = Date.now();
  return [
    {
      id: 'demo-imp-1',
      departmentId: SYSTEM_DEPARTMENTS[0].id,
      bagTypeId: 'BAO20',
      quantity: 50,
      timestamp: now - 3600000,
      userId: 'demo-manager-uid',
      userEmail: 'demomanager@xopker.com',
    },
    {
      id: 'demo-imp-2',
      departmentId: SYSTEM_DEPARTMENTS[0].id,
      bagTypeId: 'BAO15',
      quantity: 500,
      timestamp: now - 86400000,
      userId: 'demo-staff-uid',
      userEmail: 'demostaff@xopker.com',
    },
  ];
};

const generateSampleExports = (): DemoImportExportItem[] => {
  const now = Date.now();
  return [
    {
      id: 'demo-exp-1',
      departmentId: SYSTEM_DEPARTMENTS[0].id,
      bagTypeId: 'BAO15',
      quantity: 100,
      timestamp: now - 7200000,
      userId: 'demo-staff-uid',
      userEmail: 'demostaff@xopker.com',
      conversionRateAtTime: 10,
    },
    {
      id: 'demo-exp-2',
      departmentId: SYSTEM_DEPARTMENTS[0].id,
      bagTypeId: 'BAO25',
      quantity: 20,
      timestamp: now - 14400000,
      userId: 'demo-manager-uid',
      userEmail: 'demomanager@xopker.com',
    },
  ];
};

const generateSampleBorrows = (): BorrowReturn[] => {
  const now = Date.now();
  return [
    {
      id: 'demo-br-1',
      lendingDepartmentId: 'Bộ Phận Sản Xuất A',
      borrowingDepartmentId: SYSTEM_DEPARTMENTS[0].id,
      bagTypeId: 'BAO30',
      quantityBorrowed: 30,
      quantityReturned: 10,
      timestamp: now - 86400000,
      userId: 'demo-staff-uid',
      userEmail: 'demostaff@xopker.com',
      status: 'PARTIAL',
    },
  ];
};

class DemoStore {
  private inventory: Record<string, number> = { ...INITIAL_INVENTORY };
  private settings = { ...INITIAL_SETTINGS };
  private users: User[] = [...INITIAL_USERS];
  private imports: DemoImportExportItem[] = generateSampleImports();
  private exports: DemoImportExportItem[] = generateSampleExports();
  private borrowReturns: BorrowReturn[] = generateSampleBorrows();
  private activityLogs: ActivityLog[] = generateSampleLogs();
  private stockChecks: DemoStockCheckRecord[] = [];

  resetToInitial() {
    this.inventory = { ...INITIAL_INVENTORY };
    this.settings = { ...INITIAL_SETTINGS };
    this.users = [...INITIAL_USERS];
    this.imports = generateSampleImports();
    this.exports = generateSampleExports();
    this.borrowReturns = generateSampleBorrows();
    this.activityLogs = generateSampleLogs();
    this.stockChecks = [];
  }

  // Stock & Inventory
  getInventory(): Record<string, number> {
    return { ...this.inventory };
  }

  getStocks(): Record<string, number> {
    return this.getInventory();
  }

  // Settings
  getSettings() {
    return { ...this.settings };
  }

  updateSettings(rateOrSettings: number | Partial<typeof INITIAL_SETTINGS>, allowCustomExportDate?: boolean) {
    if (typeof rateOrSettings === 'number') {
      this.settings = {
        ...this.settings,
        bao15ConversionRate: rateOrSettings,
        allowCustomExportDate: allowCustomExportDate ?? this.settings.allowCustomExportDate,
        updatedAt: Date.now(),
      };
    } else {
      this.settings = {
        ...this.settings,
        ...rateOrSettings,
        updatedAt: Date.now(),
      };
    }
  }

  resetAllData() {
    this.clearAllData();
  }

  // Users
  getUsers(): User[] {
    return [...this.users];
  }

  addUser(emailOrUser: string | User, role?: any) {
    if (typeof emailOrUser === 'string') {
      const newUser: User = {
        uid: `demo-user-${Date.now()}`,
        email: emailOrUser,
        displayName: emailOrUser.split('@')[0],
        photoURL: null,
        role: role || 'Staff',
        isActive: true,
        createdAt: Date.now(),
        isDemo: true,
      };
      this.users = [newUser, ...this.users];
      return newUser;
    } else {
      this.users = [emailOrUser, ...this.users];
      return emailOrUser;
    }
  }

  updateUser(uid: string, updates: Partial<User>) {
    this.users = this.users.map(u => (u.uid === uid || u.id === uid ? { ...u, ...updates } : u));
  }

  updateDisplayName(uid: string, displayName: string) {
    this.updateUser(uid, { displayName });
  }

  updateRole(uid: string, role: any) {
    this.updateUser(uid, { role });
  }

  deleteUser(uid: string) {
    this.users = this.users.filter(u => u.uid !== uid && u.id !== uid);
  }

  // Activity Logs
  getActivityLogs(): ActivityLog[] {
    return [...this.activityLogs].sort((a, b) => b.timestamp - a.timestamp);
  }

  addActivityLog(log: Omit<ActivityLog, 'id'>) {
    const newLog: ActivityLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    this.activityLogs = [newLog, ...this.activityLogs];
    return newLog;
  }

  // Imports
  getImports(): DemoImportExportItem[] {
    return [...this.imports].sort((a, b) => b.timestamp - a.timestamp);
  }

  executeImport(entries: [BagTypeID, number][], timestamp: number, user: User | null) {
    const createdRecords: DemoImportExportItem[] = [];

    entries.forEach(([bagTypeId, qty]) => {
      // Stock update
      const current = this.inventory[bagTypeId] || 0;
      this.inventory[bagTypeId] = current + qty;

      const record: DemoImportExportItem = {
        id: `demo-imp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        departmentId: SYSTEM_DEPARTMENTS[0].id,
        bagTypeId,
        quantity: qty,
        timestamp,
        userId: user?.uid || 'demo-user',
        userEmail: user?.email || 'demo@xopker.com',
      };
      this.imports.push(record);
      createdRecords.push(record);

      this.addActivityLog({
        userId: user?.uid || 'demo-user',
        userEmail: user?.email || 'demo@xopker.com',
        timestamp: Date.now(),
        deviceInfo: 'Demo Mode (Sandbox)',
        transactionType: 'IMPORT',
        afterData: { bagTypeId, quantity: qty, newTotal: this.inventory[bagTypeId] },
      });
    });

    return createdRecords;
  }

  // Exports
  getExports(): DemoImportExportItem[] {
    return [...this.exports].sort((a, b) => b.timestamp - a.timestamp);
  }

  executeExport(entries: [BagTypeID, number][], timestamp: number, user: User | null) {
    const createdRecords: DemoImportExportItem[] = [];
    const conversionRate = this.settings.bao15ConversionRate;

    entries.forEach(([bagTypeId, qty]) => {
      // For BAO15, qty is in kg, stock is in kg. For others, qty is in bao, stock is in bao.
      const current = this.inventory[bagTypeId] || 0;
      this.inventory[bagTypeId] = Math.max(0, current - qty);

      const record: DemoImportExportItem = {
        id: `demo-exp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        departmentId: SYSTEM_DEPARTMENTS[0].id,
        bagTypeId,
        quantity: qty,
        timestamp,
        userId: user?.uid || 'demo-user',
        userEmail: user?.email || 'demo@xopker.com',
        conversionRateAtTime: conversionRate,
      };
      this.exports.push(record);
      createdRecords.push(record);

      this.addActivityLog({
        userId: user?.uid || 'demo-user',
        userEmail: user?.email || 'demo@xopker.com',
        timestamp: Date.now(),
        deviceInfo: 'Demo Mode (Sandbox)',
        transactionType: 'EXPORT',
        afterData: { bagTypeId, quantity: qty, newTotal: this.inventory[bagTypeId] },
      });
    });

    return createdRecords;
  }

  // Borrow / Return
  getBorrowReturns(): BorrowReturn[] {
    return [...this.borrowReturns].sort((a, b) => b.timestamp - a.timestamp);
  }

  getBorrows(): BorrowReturn[] {
    return this.getBorrowReturns();
  }

  borrow(lenderId: string, borrowerOrBagType: string, bagTypeOrQty: any, qtyOrUser?: any, userObj?: User | null) {
    let bagTypeId: BagTypeID;
    let quantity: number;
    let user: User | null = null;

    if (typeof bagTypeOrQty === 'number') {
      // (lenderId, bagTypeId, quantity, user)
      bagTypeId = borrowerOrBagType as BagTypeID;
      quantity = bagTypeOrQty;
      user = qtyOrUser as User | null;
    } else {
      // (lenderId, borrowerId, bagTypeId, quantity, user)
      bagTypeId = bagTypeOrQty as BagTypeID;
      quantity = Number(qtyOrUser) || 0;
      user = userObj || null;
    }

    return this.executeBorrow(lenderId, bagTypeId, quantity, user);
  }

  returnBorrow(borrowId: string, returnQty: number, user: User | null) {
    return this.executeReturn(borrowId, returnQty, user);
  }

  executeBorrow(lenderId: string, bagTypeId: BagTypeID, quantity: number, user: User | null) {
    // Borrow adds stock to main department
    const current = this.inventory[bagTypeId] || 0;
    this.inventory[bagTypeId] = current + quantity;

    const record: BorrowReturn = {
      id: `demo-br-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      lendingDepartmentId: lenderId,
      borrowingDepartmentId: SYSTEM_DEPARTMENTS[0].id,
      bagTypeId,
      quantityBorrowed: quantity,
      quantityReturned: 0,
      timestamp: Date.now(),
      userId: user?.uid || 'demo-user',
      userEmail: user?.email || 'demo@xopker.com',
      status: 'OPEN',
      conversionRateAtTime: this.settings.bao15ConversionRate,
    };

    this.borrowReturns.push(record);

    this.addActivityLog({
      userId: user?.uid || 'demo-user',
      userEmail: user?.email || 'demo@xopker.com',
      timestamp: Date.now(),
      deviceInfo: 'Demo Mode (Sandbox)',
      transactionType: 'BORROW',
      afterData: { lenderId, bagTypeId, quantity },
    });

    return record;
  }

  executeReturn(borrowId: string, returnQty: number, user: User | null) {
    const index = this.borrowReturns.findIndex(b => b.id === borrowId);
    if (index === -1) throw new Error('Không tìm thấy phiếu vay');

    const borrow = this.borrowReturns[index];
    const newReturned = borrow.quantityReturned + returnQty;

    if (newReturned > borrow.quantityBorrowed) {
      throw new Error('Số lượng trả vượt quá số lượng còn nợ');
    }

    // Return subtracts stock from main department
    const current = this.inventory[borrow.bagTypeId] || 0;
    this.inventory[borrow.bagTypeId] = Math.max(0, current - returnQty);

    const isCompleted = newReturned >= borrow.quantityBorrowed;
    const updated: BorrowReturn = {
      ...borrow,
      quantityReturned: newReturned,
      status: isCompleted ? 'COMPLETED' : 'PARTIAL',
    };

    this.borrowReturns[index] = updated;

    this.addActivityLog({
      userId: user?.uid || 'demo-user',
      userEmail: user?.email || 'demo@xopker.com',
      timestamp: Date.now(),
      deviceInfo: 'Demo Mode (Sandbox)',
      transactionType: 'RETURN',
      afterData: { borrowId, returnQty, status: updated.status },
    });

    return updated;
  }

  // Stock Check / Adjustment / Reset / Init
  getStockChecks(): DemoStockCheckRecord[] {
    return [...this.stockChecks].sort((a, b) => b.timestamp - a.timestamp);
  }

  stockCheckAdjust(bagTypeId: BagTypeID, actualQty: number, user: User | null) {
    return this.executeStockAdjust(bagTypeId, actualQty, user);
  }

  adminResetStock(clearHistory: boolean, user: User | null) {
    return this.executeResetStock(clearHistory, user);
  }

  adminInitStock(initValuesOrSummary: Record<BagTypeID, number> | Record<string, number>, timestampOrClear: number | boolean, clearHistoryOrUser?: boolean | User | null, userObj?: User | null) {
    if (typeof timestampOrClear === 'number') {
      const clearHist = typeof clearHistoryOrUser === 'boolean' ? clearHistoryOrUser : false;
      const user = userObj || (typeof clearHistoryOrUser === 'object' ? clearHistoryOrUser : null);
      return this.executeInitStock(initValuesOrSummary as Record<BagTypeID, number>, clearHist, user);
    } else {
      const clearHist = Boolean(timestampOrClear);
      const user = (clearHistoryOrUser as User | null) || null;
      return this.executeInitStock(initValuesOrSummary as Record<BagTypeID, number>, clearHist, user);
    }
  }

  executeStockAdjust(bagTypeId: BagTypeID, actualQty: number, user: User | null) {
    const systemQty = this.inventory[bagTypeId] || 0;
    const diff = actualQty - systemQty;

    this.inventory[bagTypeId] = actualQty;

    const checkRecord: DemoStockCheckRecord = {
      id: `demo-chk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      departmentId: SYSTEM_DEPARTMENTS[0].id,
      bagTypeId,
      systemQty,
      actualQty,
      difference: diff,
      timestamp: Date.now(),
      userId: user?.uid || 'demo-user',
      userEmail: user?.email || 'demo@xopker.com',
    };

    this.stockChecks.push(checkRecord);

    this.addActivityLog({
      userId: user?.uid || 'demo-user',
      userEmail: user?.email || 'demo@xopker.com',
      timestamp: Date.now(),
      deviceInfo: 'Demo Mode (Sandbox)',
      transactionType: 'CHECK',
      afterData: { bagTypeId, systemQty, actualQty, diff },
    });

    return checkRecord;
  }

  executeInitStock(initValues: Record<BagTypeID, number>, clearHistory: boolean, user: User | null) {
    Object.entries(initValues).forEach(([bagTypeId, qty]) => {
      this.inventory[bagTypeId as BagTypeID] = qty;
    });

    if (clearHistory) {
      this.imports = [];
      this.exports = [];
      this.borrowReturns = [];
      this.stockChecks = [];
    }

    this.addActivityLog({
      userId: user?.uid || 'demo-user',
      userEmail: user?.email || 'demo@xopker.com',
      timestamp: Date.now(),
      deviceInfo: 'Demo Mode (Sandbox)',
      transactionType: 'SETTINGS',
      afterData: { action: 'INIT_STOCK', initValues, clearHistory },
    });
  }

  executeResetStock(clearHistory: boolean, user: User | null) {
    Object.keys(INITIAL_INVENTORY).forEach(bagTypeId => {
      this.inventory[bagTypeId] = 0;
    });

    if (clearHistory) {
      this.imports = [];
      this.exports = [];
      this.borrowReturns = [];
      this.stockChecks = [];
      this.activityLogs = [];
    }

    this.addActivityLog({
      userId: user?.uid || 'demo-user',
      userEmail: user?.email || 'demo@xopker.com',
      timestamp: Date.now(),
      deviceInfo: 'Demo Mode (Sandbox)',
      transactionType: 'SETTINGS',
      afterData: { action: 'RESET_STOCK', clearHistory },
    });
  }

  // Undo
  undoTransaction(docId: string, type: 'IMPORT' | 'EXPORT', bagTypeId: BagTypeID, qtyInBao: number, user: User | null) {
    const current = this.inventory[bagTypeId] || 0;

    if (type === 'IMPORT') {
      this.inventory[bagTypeId] = Math.max(0, current - qtyInBao);
      this.imports = this.imports.filter(i => i.id !== docId);
    } else {
      this.inventory[bagTypeId] = current + qtyInBao;
      this.exports = this.exports.filter(e => e.id !== docId);
    }

    this.addActivityLog({
      userId: user?.uid || 'demo-user',
      userEmail: user?.email || 'demo@xopker.com',
      timestamp: Date.now(),
      deviceInfo: 'Demo Mode (Sandbox)',
      transactionType: type === 'IMPORT' ? 'CHECK' : 'CHECK',
      afterData: { action: `UNDO_${type}`, docId, bagTypeId, newQty: this.inventory[bagTypeId] },
    });
  }

  clearAllData() {
    this.resetToInitial();
  }
}

export const demoStore = new DemoStore();
