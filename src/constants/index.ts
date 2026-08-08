import { BagType } from '../types';

export const BAG_TYPES: BagType[] = [
  { id: 'BAO15', name: 'Bao 16', order: 1 },
  { id: 'BAO20', name: 'Bao 20', order: 2 },
  { id: 'BAO25', name: 'Bao 25', order: 3 },
  { id: 'BAO30', name: 'Bao 30', order: 4 },
  { id: 'BAO37', name: 'Bao 37', order: 5 },
];

export const SYSTEM_DEPARTMENTS = [
  { id: 'DEP_MAIN', name: 'Cashier' },
  { id: 'DEP_QUAY1', name: 'Quầy 1' },
  { id: 'DEP_QUAY2', name: 'Quầy 2' },
  { id: 'DEP_QUAY3', name: 'Quầy 3' },
];

export const DEFAULT_SETTINGS = {
  bao15ConversionRate: 20,
  allowCustomExportDate: false,
};

export const LOW_STOCK_THRESHOLDS: Record<string, number> = {
  BAO15: 3,
  BAO20: 10,
  BAO25: 10,
  BAO30: 15,
  BAO37: 15,
};

export function getLowStockThreshold(bagTypeId: string): number {
  return LOW_STOCK_THRESHOLDS[bagTypeId] ?? 10;
}

export function isLowStock(bagTypeId: string, currentStockBao: number): boolean {
  return currentStockBao <= getLowStockThreshold(bagTypeId);
}

export function getGreetingText(): { text: string; iconName: 'Sunrise' | 'Sun' | 'Moon' } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { text: 'Chào buổi sáng', iconName: 'Sunrise' };
  }
  if (hour >= 12 && hour < 18) {
    return { text: 'Chào buổi trưa', iconName: 'Sun' };
  }
  return { text: 'Chào buổi tối', iconName: 'Moon' };
}

export function formatMainName(nameOrEmail?: string): string {
  if (!nameOrEmail) return 'Hệ thống';
  const input = nameOrEmail.trim();
  if (!input || input.toLowerCase() === 'hệ thống' || input.toLowerCase() === 'he thong') return 'Hệ thống';

  // If input contains @ (email), parse the handle if it's raw email
  let nameStr = input;
  if (input.includes('@')) {
    const handle = input.split('@')[0];
    const firstPart = handle.split(/[\._-]/)[0];
    nameStr = firstPart ? firstPart.charAt(0).toUpperCase() + firstPart.slice(1) : handle;
  }

  // Remove parenthetical nicknames like (SaGa)
  const clean = nameStr.replace(/\s*\([^)]*\)/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length > 0) {
    const vnSurnames = [
      'Lê', 'Le', 'Nguyễn', 'Nguyen', 'Phạm', 'Pham', 'Trần', 'Tran', 'Vũ', 'Vu', 
      'Võ', 'Vo', 'Đặng', 'Dang', 'Bùi', 'Bui', 'Đỗ', 'Do', 'Hồ', 'Ho', 
      'Ngô', 'Ngo', 'Dương', 'Duong', 'Lý', 'Ly', 'Đào', 'Dao', 'Đoàn', 'Doan', 
      'Hoàng', 'Hoang', 'Huỳnh', 'Huynh', 'Phan'
    ];
    if (words.length > 1 && vnSurnames.includes(words[0])) {
      return words[words.length - 1]; // e.g. "Lê Công Thành" -> "Thành"
    }
    return words[0]; // e.g. "Thành"
  }

  return clean || input;
}
