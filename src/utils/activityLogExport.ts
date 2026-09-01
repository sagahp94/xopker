import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { BAG_TYPES } from '../constants';
import { UnifiedLog, TRANSACTION_TYPES } from '../pages/ActivityLogs';

export function getLogBagQuantity(
  log: UnifiedLog,
  targetBagTypeId: string,
  conversionRate: number = 20
): number {
  let totalBao = 0;

  const processItem = (bTypeId?: string, qty?: number, unitHint?: string) => {
    if (!bTypeId || bTypeId !== targetBagTypeId || qty === undefined || qty === null) return;
    const absQty = Math.abs(qty);

    if (bTypeId === 'BAO15') {
      const isExportOrBorrowOrKg = log.transactionType === 'EXPORT' || log.transactionType === 'BORROW' || unitHint === 'kg';
      if (isExportOrBorrowOrKg) {
        const rate = conversionRate || 20;
        totalBao += Number((absQty / rate).toFixed(2));
      } else {
        totalBao += absQty;
      }
    } else {
      totalBao += absQty;
    }
  };

  if (log.items && log.items.length > 0) {
    log.items.forEach(item => {
      processItem(item.bagTypeId, item.quantity, item.unit);
    });
  } else if (log.bagTypeId && log.quantity !== undefined) {
    processItem(log.bagTypeId, log.quantity);
  } else if (log.beforeData && log.afterData && log.bagTypeId) {
    const diff = Math.abs((log.afterData.quantity || 0) - (log.beforeData.quantity || 0));
    processItem(log.bagTypeId, diff);
  }

  return totalBao;
}

export function exportActivityLogsExcel(params: {
  logs: UnifiedLog[];
  dateFilter: string;
  customStartDate?: string;
  customEndDate?: string;
  selectedType: string;
  conversionRate: number;
  getUserDisplayName: (email: string) => string;
}) {
  const {
    logs,
    dateFilter,
    customStartDate,
    customEndDate,
    selectedType,
    conversionRate,
    getUserDisplayName,
  } = params;

  // 1. Determine period label
  let periodText = 'Tất cả thời gian';
  if (dateFilter === 'TODAY') {
    periodText = `Hôm nay (${format(new Date(), 'dd/MM/yyyy')})`;
  } else if (dateFilter === 'THIS_WEEK') {
    periodText = 'Tuần này (7 ngày gần nhất)';
  } else if (dateFilter === 'THIS_MONTH') {
    periodText = `Tháng ${format(new Date(), 'MM/yyyy')}`;
  } else if (dateFilter === 'THIS_YEAR') {
    periodText = `Năm ${format(new Date(), 'yyyy')}`;
  } else if (dateFilter === 'CUSTOM') {
    periodText = `Từ ${customStartDate ? format(new Date(customStartDate), 'dd/MM/yyyy') : '...'} đến ${customEndDate ? format(new Date(customEndDate), 'dd/MM/yyyy') : '...'}`;
  }

  // 2. Transaction type label
  let typeText = 'Tất cả loại giao dịch';
  if (selectedType !== 'ALL' && TRANSACTION_TYPES[selectedType]) {
    typeText = TRANSACTION_TYPES[selectedType].label;
  }

  const wb = XLSX.utils.book_new();

  // ----------------------------------------------------
  // SHEET 1: CHI TIẾT NHẬT KÝ GIAO DỊCH
  // ----------------------------------------------------
  const aoaDetails: any[][] = [];

  // Header Box
  aoaDetails.push(['BÁO CÁO NHẬT KÝ GIAO DỊCH - CHI TIẾT SỐ LƯỢNG BAO']);
  aoaDetails.push(['Khoảng thời gian:', periodText]);
  aoaDetails.push(['Loại giao dịch:', typeText]);
  aoaDetails.push(['Thời gian xuất:', format(new Date(), 'dd/MM/yyyy HH:mm:ss')]);
  aoaDetails.push(['Tổng số nhật ký:', logs.length]);
  aoaDetails.push([]); // Empty row

  // Table Headers
  const bagHeaders = BAG_TYPES.map(b => `${b.name} (bao)`);
  const tableHeader = [
    'STT',
    'Ngày thực hiện',
    'Loại giao dịch',
    'Người thực hiện',
    ...bagHeaders,
    'TỔNG SỐ LƯỢNG BAO',
    'Ghi chú / Thiết bị'
  ];
  aoaDetails.push(tableHeader);

  // Totals tracker across all logs
  const colTotalsPerBag: Record<string, number> = {};
  BAG_TYPES.forEach(b => { colTotalsPerBag[b.id] = 0; });
  let grandTotalBaoAllLogs = 0;

  // Data Rows
  logs.forEach((log, index) => {
    const dateStr = format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm');
    const typeLabel = TRANSACTION_TYPES[log.transactionType]?.label || log.transactionType;
    const userName = getUserDisplayName(log.userEmail);

    let rowTotalBao = 0;
    const bagQtyValues = BAG_TYPES.map(b => {
      const q = getLogBagQuantity(log, b.id, conversionRate);
      colTotalsPerBag[b.id] += q;
      rowTotalBao += q;
      return q;
    });

    grandTotalBaoAllLogs += rowTotalBao;

    const notesStr = log.notes || (log.deviceInfo !== 'Không có thông tin' ? log.deviceInfo : '') || '-';

    aoaDetails.push([
      index + 1,
      dateStr,
      typeLabel,
      userName,
      ...bagQtyValues,
      rowTotalBao,
      notesStr
    ]);
  });

  // Bottom Summary Row
  const totalRow = [
    'TỔNG CỘNG',
    '',
    '',
    '',
    ...BAG_TYPES.map(b => colTotalsPerBag[b.id]),
    grandTotalBaoAllLogs,
    ''
  ];
  aoaDetails.push(totalRow);

  const wsDetails = XLSX.utils.aoa_to_sheet(aoaDetails);

  // Column width config
  const detailsCols = [
    { wch: 6 },  // STT
    { wch: 18 }, // Ngày thực hiện
    { wch: 16 }, // Loại giao dịch
    { wch: 22 }, // Người thực hiện
    ...BAG_TYPES.map(() => ({ wch: 15 })), // Bag types
    { wch: 22 }, // Tổng số lượng bao
    { wch: 30 }  // Ghi chú
  ];
  wsDetails['!cols'] = detailsCols;

  XLSX.utils.book_append_sheet(wb, wsDetails, 'Chi_Tiet_Giao_Dich');

  // ----------------------------------------------------
  // SHEET 2: TỔNG HỢP SỐ LƯỢNG BAO THEO NGÀY
  // ----------------------------------------------------
  const aoaDaily: any[][] = [];

  aoaDaily.push(['BÁO CÁO TỔNG HỢP SỐ LƯỢNG BAO THEO NGÀY THỰC HIỆN']);
  aoaDaily.push(['Khoảng thời gian:', periodText]);
  aoaDaily.push(['Loại giao dịch:', typeText]);
  aoaDaily.push([]);

  const dailyHeader = [
    'STT',
    'Ngày thực hiện',
    'Số lượt giao dịch',
    ...bagHeaders,
    'TỔNG SỐ LƯỢNG BAO TRONG NGÀY'
  ];
  aoaDaily.push(dailyHeader);

  // Group logs by day string (dd/MM/yyyy)
  const dayGroups: Record<string, UnifiedLog[]> = {};
  logs.forEach(log => {
    const dayKey = format(new Date(log.timestamp), 'dd/MM/yyyy');
    if (!dayGroups[dayKey]) dayGroups[dayKey] = [];
    dayGroups[dayKey].push(log);
  });

  let dayIndex = 1;
  const dailyColTotalsPerBag: Record<string, number> = {};
  BAG_TYPES.forEach(b => { dailyColTotalsPerBag[b.id] = 0; });
  let dailyGrandTotalBao = 0;
  let dailyGrandTotalLogs = 0;

  Object.entries(dayGroups).forEach(([dayStr, dayLogs]) => {
    let dayTotalBao = 0;
    const dayBagValues = BAG_TYPES.map(b => {
      let bQty = 0;
      dayLogs.forEach(l => {
        bQty += getLogBagQuantity(l, b.id, conversionRate);
      });
      dailyColTotalsPerBag[b.id] += bQty;
      dayTotalBao += bQty;
      return bQty;
    });

    dailyGrandTotalBao += dayTotalBao;
    dailyGrandTotalLogs += dayLogs.length;

    aoaDaily.push([
      dayIndex++,
      dayStr,
      dayLogs.length,
      ...dayBagValues,
      dayTotalBao
    ]);
  });

  // Daily summary total row
  aoaDaily.push([
    'TỔNG CỘNG',
    '',
    dailyGrandTotalLogs,
    ...BAG_TYPES.map(b => dailyColTotalsPerBag[b.id]),
    dailyGrandTotalBao
  ]);

  const wsDaily = XLSX.utils.aoa_to_sheet(aoaDaily);
  wsDaily['!cols'] = [
    { wch: 6 },  // STT
    { wch: 16 }, // Ngày
    { wch: 18 }, // Lượt giao dịch
    ...BAG_TYPES.map(() => ({ wch: 15 })), // Bag types
    { wch: 25 }  // Tổng bao
  ];

  XLSX.utils.book_append_sheet(wb, wsDaily, 'Tong_Hop_Theo_Ngay');

  // Save Excel file
  const fileName = `NhatKy_GiaoDich_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
