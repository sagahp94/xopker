export type Role = 'Admin' | 'Manager' | 'Staff';

export interface User {
  id?: string;
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: Role;
  isActive: boolean;
  createdAt: number;
}

export type BagTypeID = 'BAO15' | 'BAO20' | 'BAO25' | 'BAO30' | 'BAO37';

export interface BagType {
  id: BagTypeID;
  name: string;
  order: number;
}

export interface Department {
  id: string;
  name: string;
}

// Global Settings
export interface AppSettings {
  bao15ConversionRate: number; // kg per 1 bao
  updatedAt: number;
  updatedBy: string;
}

export interface InventoryItem {
  id: string;
  departmentId: string;
  bagTypeId: BagTypeID;
  quantity: number; // In kg for BAO15, in bao for others
  updatedAt: number;
}

export interface Transaction {
  id: string;
  type: 'IMPORT' | 'EXPORT' | 'BORROW' | 'RETURN' | 'CHECK';
  departmentId: string;
  bagTypeId: BagTypeID;
  quantity: number; // In kg for BAO15, in bao for others
  timestamp: number;
  userId: string;
  userEmail: string;
  notes?: string;
}

export interface BorrowReturn {
  id: string;
  lendingDepartmentId: string;
  borrowingDepartmentId: string;
  bagTypeId: BagTypeID;
  quantityBorrowed: number; // In kg for BAO15, in bao for others
  quantityReturned: number;
  timestamp: number;
  userId: string;
  userEmail: string;
  status: 'OPEN' | 'PARTIAL' | 'COMPLETED';
}

export interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  timestamp: number;
  deviceInfo: string;
  transactionType: 'IMPORT' | 'EXPORT' | 'BORROW' | 'RETURN' | 'CHECK' | 'SETTINGS' | 'USER_MANAGEMENT';
  beforeData?: any;
  afterData?: any;
}
