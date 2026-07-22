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
};
