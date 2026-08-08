import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { BAG_TYPES } from '../constants';

export interface BagReport {
  bagTypeId: string;
  name: string;
  currentStock: number; // in native units (kg for BAO15, bao for others)
  totalImport: number; // in native units in period
  totalExport: number; // total outbound in period (Direct Export + Borrowed Out)
  totalUsage: number; // direct usage (exports) in period
  avgDailyUsage: number; // average daily direct usage (based on 30-day window)
  daysRemaining: number | null; // null if no usage, 0 if out of stock
  depletionDate: string | null;
  rawBorrows: number;
}

export interface MonthlyBreakdownItem {
  month: number; // 1..12
  monthName: string; // "Tháng 01", "Tháng 02", ...
  totalImportBao: number;
  totalImportKg: number;
  totalExportBao: number;
  totalExportKg: number;
  importsByBag: Record<string, number>;
  exportsByBag: Record<string, number>;
}

export const getUserFullName = (u: any): string => {
  if (!u) return 'Hệ thống';
  let name = u.displayName || u.email?.split('@')[0] || 'Hệ thống';
  // Remove nicknames in parentheses or square brackets e.g. "Lê Công Thành (Thành)" -> "Lê Công Thành"
  name = name.replace(/\s*[\(\[][^\)\]]*[\)\]]/g, '').trim();
  return name || 'Hệ thống';
};

export const getBagWeightKg = (bagTypeId: string, rate: number): number => {
  if (bagTypeId === 'BAO15') return rate || 20;
  return 20;
};

export const getPeriodText = (
  filterType: string,
  customStartDate?: string,
  customEndDate?: string
): string => {
  const now = new Date();
  if (filterType === 'TODAY') {
    return `Hôm nay (${format(now, 'dd/MM/yyyy')})`;
  } else if (filterType === 'WEEK') {
    const start = startOfWeek(now);
    const end = endOfWeek(now);
    return `Tuần này (${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')})`;
  } else if (filterType === 'MONTH') {
    return `Tháng ${format(now, 'MM/yyyy')}`;
  } else if (filterType === 'YEAR') {
    return `Năm ${format(now, 'yyyy')}`;
  } else if (filterType === 'CUSTOM') {
    const s = customStartDate ? format(new Date(customStartDate), 'dd/MM/yyyy') : '...';
    const e = customEndDate ? format(new Date(customEndDate), 'dd/MM/yyyy') : '...';
    return `Tùy chọn (${s} - ${e})`;
  }
  return '';
};

// Pure JS OKLCH to sRGB parser to guarantee no unsupported color strings are passed to html2canvas
const parseOklchToRgb = (str: string): string => {
  try {
    const match = str.match(/oklch\(\s*([\d.%]+)[\s,]+([\d.%-]+)[\s,]+([\d.%-]+)(?:\s*[/,]\s*([\d.%]+))?\s*\)/i);
    if (!match) return 'rgb(0,0,0)';

    let l = match[1].endsWith('%') ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
    let c = match[2].endsWith('%') ? (parseFloat(match[2]) / 100) * 0.4 : parseFloat(match[2]);
    let h = parseFloat(match[3]);
    let alpha = match[4] ? (match[4].endsWith('%') ? parseFloat(match[4]) / 100 : parseFloat(match[4])) : 1;

    const hRad = (h * Math.PI) / 180;
    const aLab = c * Math.cos(hRad);
    const bLab = c * Math.sin(hRad);

    const l_ = l + 0.3963377774 * aLab + 0.2158037573 * bLab;
    const m_ = l - 0.1055613458 * aLab - 0.0638541728 * bLab;
    const s_ = l - 0.0894841775 * aLab - 1.2914855480 * bLab;

    const l3 = l_ * l_ * l_;
    const m3 = m_ * m_ * m_;
    const s3 = s_ * s_ * s_;

    let rLin = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    let gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    let bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

    const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);

    let r = Math.min(255, Math.max(0, Math.round(gamma(rLin) * 255)));
    let g = Math.min(255, Math.max(0, Math.round(gamma(gLin) * 255)));
    let b = Math.min(255, Math.max(0, Math.round(gamma(bLin) * 255)));

    if (isNaN(r)) r = 0;
    if (isNaN(g)) g = 0;
    if (isNaN(b)) b = 0;

    if (alpha < 1) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return 'rgb(0,0,0)';
  }
};

// Pure JS OKLAB to sRGB parser
const parseOklabToRgb = (str: string): string => {
  try {
    const match = str.match(/oklab\(\s*([\d.%]+)[\s,]+([\d.%-]+)[\s,]+([\d.%-]+)(?:\s*[/,]\s*([\d.%]+))?\s*\)/i);
    if (!match) return 'rgb(0,0,0)';

    let l = match[1].endsWith('%') ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
    let aLab = match[2].endsWith('%') ? (parseFloat(match[2]) / 100) * 0.4 : parseFloat(match[2]);
    let bLab = match[3].endsWith('%') ? (parseFloat(match[3]) / 100) * 0.4 : parseFloat(match[3]);
    let alpha = match[4] ? (match[4].endsWith('%') ? parseFloat(match[4]) / 100 : parseFloat(match[4])) : 1;

    const l_ = l + 0.3963377774 * aLab + 0.2158037573 * bLab;
    const m_ = l - 0.1055613458 * aLab - 0.0638541728 * bLab;
    const s_ = l - 0.0894841775 * aLab - 1.2914855480 * bLab;

    const l3 = l_ * l_ * l_;
    const m3 = m_ * m_ * m_;
    const s3 = s_ * s_ * s_;

    let rLin = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    let gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    let bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

    const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);

    let r = Math.min(255, Math.max(0, Math.round(gamma(rLin) * 255)));
    let g = Math.min(255, Math.max(0, Math.round(gamma(gLin) * 255)));
    let b = Math.min(255, Math.max(0, Math.round(gamma(bLin) * 255)));

    if (isNaN(r)) r = 0;
    if (isNaN(g)) g = 0;
    if (isNaN(b)) b = 0;

    if (alpha < 1) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return 'rgb(0,0,0)';
  }
};

const convertValue = (val: string): string => {
  if (!val) return val;
  let res = val;
  if (/oklch/i.test(res)) {
    res = res.replace(/oklch\([^)]+\)/gi, (m) => parseOklchToRgb(m));
  }
  if (/oklab/i.test(res)) {
    res = res.replace(/oklab\([^)]+\)/gi, (m) => parseOklabToRgb(m));
  }
  if (/lch\(/i.test(res)) {
    res = res.replace(/lch\([^)]+\)/gi, 'rgb(0,0,0)');
  }
  if (/lab\(/i.test(res)) {
    res = res.replace(/lab\([^)]+\)/gi, 'rgb(0,0,0)');
  }
  if (/color\(/i.test(res)) {
    res = res.replace(/color\([^)]+\)/gi, 'rgb(0,0,0)');
  }
  return res;
};

const needsConversion = (text: string) => /(oklch|oklab|lch|lab|color\()/i.test(text);

export const exportPdfFromElement = async (element: HTMLElement): Promise<void> => {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
    windowWidth: Math.max(document.documentElement.clientWidth, 1200),
    windowHeight: Math.max(document.documentElement.clientHeight, 2000),
    ignoreElements: (el) => el.tagName === 'SCRIPT' || el.tagName === 'NOSCRIPT',
    onclone: (clonedDoc) => {
      // Remove all script & noscript tags to prevent script execution inside html2canvas iframe
      const scripts = Array.from(clonedDoc.querySelectorAll('script, noscript'));
      scripts.forEach((s) => s.remove());

      // Find cloned target container and unclip height/overflow
      const clonedPdf = clonedDoc.querySelector('[data-pdf-content]') as HTMLElement;
      if (clonedPdf) {
        clonedPdf.style.overflow = 'visible';
        clonedPdf.style.maxHeight = 'none';
        clonedPdf.style.height = 'auto';
        clonedPdf.style.position = 'static';
        clonedPdf.style.transform = 'none';
      }

      // Unclip all overflow containers in clonedDoc to prevent cutting off tables/content
      const allEls = Array.from(clonedDoc.querySelectorAll('*'));
      allEls.forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.classList) {
          if (htmlEl.classList.contains('overflow-x-auto') || htmlEl.classList.contains('overflow-y-auto') || htmlEl.classList.contains('overflow-hidden')) {
            htmlEl.style.overflow = 'visible';
            htmlEl.style.maxHeight = 'none';
          }
        }
      });

      // 1. Convert all <style> elements textContent
      const styleElements = Array.from(clonedDoc.querySelectorAll('style'));
      styleElements.forEach((styleEl) => {
        if (styleEl.textContent && needsConversion(styleEl.textContent)) {
          styleEl.textContent = convertValue(styleEl.textContent);
        }
      });

      // 2. Convert all styleSheet rules in clonedDoc
      try {
        Array.from(clonedDoc.styleSheets).forEach((sheet) => {
          try {
            const rules = sheet.cssRules || sheet.rules;
            if (!rules) return;
            Array.from(rules).forEach((rule) => {
              if (rule.cssText && needsConversion(rule.cssText)) {
                const styleRule = rule as CSSStyleRule;
                if (styleRule.style) {
                  for (let i = 0; i < styleRule.style.length; i++) {
                    const prop = styleRule.style[i];
                    const val = styleRule.style.getPropertyValue(prop);
                    if (val && needsConversion(val)) {
                      const fixed = convertValue(val);
                      styleRule.style.setProperty(prop, fixed, styleRule.style.getPropertyPriority(prop));
                    }
                  }
                }
              }
            });
          } catch {
            // ignore cross-origin sheet access
          }
        });
      } catch {
        // ignore
      }

      // 3. Convert inline styles & computed color properties on all elements
      const propertiesToFix = [
        'color',
        'background-color',
        'border-color',
        'border-top-color',
        'border-right-color',
        'border-bottom-color',
        'border-left-color',
        'outline-color',
        'fill',
        'stroke',
        'box-shadow'
      ];

      const allElements = Array.from(clonedDoc.querySelectorAll('*'));
      const iframeView = clonedDoc.defaultView;

      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (iframeView) {
          try {
            const computed = iframeView.getComputedStyle(htmlEl);
            if (computed) {
              propertiesToFix.forEach((prop) => {
                const val = computed.getPropertyValue(prop);
                if (val && needsConversion(val)) {
                  const fixed = convertValue(val);
                  htmlEl.style.setProperty(prop, fixed, 'important');
                }
              });
            }
          } catch {
            // ignore
          }
        }

        // Fix inline style attribute
        const styleAttr = htmlEl.getAttribute?.('style');
        if (styleAttr && needsConversion(styleAttr)) {
          htmlEl.setAttribute('style', convertValue(styleAttr));
        }
      });
    }
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pdfHeight;

  while (heightLeft > 0) {
    position -= pdfHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
  }

  pdf.save(`BaoCao_Kho_Xop_${format(new Date(), 'ddMMyyyy_HHmm')}.pdf`);
};

export const generateExcelReport = (params: {
  reportData: BagReport[];
  monthlyBreakdown: MonthlyBreakdownItem[];
  filterType: string;
  customStartDate: string;
  customEndDate: string;
  user: any;
  conversionRate: number;
  totalPeriodImports: number;
  totalPeriodImportsKg: number;
  totalPeriodExports: number;
  totalPeriodExportsKg: number;
  totalCurrentStock: number;
  totalCurrentStockKg: number;
  logs: any[];
}) => {
  const {
    reportData,
    monthlyBreakdown,
    filterType,
    customStartDate,
    customEndDate,
    user,
    conversionRate,
    totalPeriodImports,
    totalPeriodImportsKg,
    totalPeriodExports,
    totalPeriodExportsKg,
    totalCurrentStock,
    totalCurrentStockKg,
    logs
  } = params;

  const wb = XLSX.utils.book_new();
  const now = new Date();
  const periodStr = getPeriodText(filterType, customStartDate, customEndDate);
  const authorName = getUserFullName(user);
  const reportCode = `Mã BC: RPT-${format(now, 'yyyyMMdd-HHmm')}`;
  const reportCreated = `Ngày tạo: ${format(now, 'dd/MM/yyyy HH:mm')}`;

  let cycleName = 'Tháng';
  let timeRangeStr = '';

  if (filterType === 'TODAY') {
    cycleName = 'Ngày';
    timeRangeStr = format(now, 'dd/MM/yyyy');
  } else if (filterType === 'WEEK') {
    cycleName = 'Tuần';
    const start = startOfWeek(now);
    const end = endOfWeek(now);
    timeRangeStr = `${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`;
  } else if (filterType === 'MONTH') {
    cycleName = 'Tháng';
    timeRangeStr = format(now, 'MM/yyyy');
  } else if (filterType === 'YEAR') {
    cycleName = 'Năm';
    timeRangeStr = format(now, 'yyyy');
  } else if (filterType === 'CUSTOM') {
    cycleName = 'Tùy chọn';
    const s = customStartDate ? format(new Date(customStartDate), 'dd/MM/yyyy') : '...';
    const e = customEndDate ? format(new Date(customEndDate), 'dd/MM/yyyy') : '...';
    timeRangeStr = `${s} - ${e}`;
  }

  // 1. Primary Sheet: Standard Formatted Document Layout
  const totalCols = Math.max(reportData.length + 3, 4);
  const emptyColsForSig = Math.max(0, totalCols - 2);

  const aoa: any[][] = [];

  // Header section
  aoa.push(["HỆ THỐNG QUẢN LÝ KHO BAO XỐP (XOPKER)", ...Array(Math.max(0, totalCols - 3)).fill(''), reportCode, ""]);
  aoa.push(["Báo Cáo Nhập - Xuất - Tồn Kho & Dự Báo Cạn Stock", ...Array(Math.max(0, totalCols - 3)).fill(''), reportCreated, ""]);
  aoa.push([]);

  // Main Title
  aoa.push(["BÁO CÁO NHẬP - XUẤT - TỒN KHO & DỰ BÁO CẠN STOCK"]);
  aoa.push([`Kỳ Báo Cáo: ${periodStr}`]);
  aoa.push([`Người lập báo cáo: ${authorName}`]);
  aoa.push([]);

  // Summary Box
  aoa.push(["TỔNG QUAN TỔNG THỂ TRONG KỲ"]);
  aoa.push(["Hạng Mục", "Tổng Nhập Trong Kỳ", "Tổng Xuất Trong Kỳ", "Tồn Kho Hiện Tại"]);
  aoa.push(["Số lượng (bao)", totalPeriodImports, totalPeriodExports, totalCurrentStock]);
  aoa.push(["Trọng lượng (kg)", totalPeriodImportsKg, totalPeriodExportsKg, totalCurrentStockKg]);
  aoa.push([]);

  // Table Header
  const tableHeader = [
    "Chỉ Số Báo Cáo",
    "Đơn Vị",
    ...reportData.map(item => `${item.name} (${getBagWeightKg(item.bagTypeId, conversionRate)}kg/bao)`),
    "TỔNG CỘNG"
  ];
  aoa.push(["CHI TIẾT THEO LOẠI BAO XỐP"]);
  aoa.push(tableHeader);

  // Rows
  // 1. Tồn Kho
  aoa.push(["Tồn Kho Hiện Tại", "bao", ...reportData.map(i => i.currentStock), totalCurrentStock]);
  aoa.push(["Tồn Kho Hiện Tại", "kg", ...reportData.map(i => i.currentStock * getBagWeightKg(i.bagTypeId, conversionRate)), totalCurrentStockKg]);

  // 2. Nhập Trong Kỳ
  aoa.push(["Nhập Trong Kỳ", "bao", ...reportData.map(i => i.totalImport), totalPeriodImports]);
  aoa.push(["Nhập Trong Kỳ", "kg", ...reportData.map(i => i.totalImport * getBagWeightKg(i.bagTypeId, conversionRate)), totalPeriodImportsKg]);

  // 3. Xuất Trong Kỳ
  aoa.push(["Xuất Trong Kỳ", "bao", ...reportData.map(i => i.totalExport), totalPeriodExports]);
  aoa.push(["Xuất Trong Kỳ", "kg", ...reportData.map(i => i.totalExport * getBagWeightKg(i.bagTypeId, conversionRate)), totalPeriodExportsKg]);

  // 4. TB Dùng / Ngày
  aoa.push(["TB Dùng / Ngày", "bao", ...reportData.map(i => Number(i.avgDailyUsage.toFixed(1))), "-"]);
  aoa.push(["TB Dùng / Ngày", "kg", ...reportData.map(i => Number((i.avgDailyUsage * getBagWeightKg(i.bagTypeId, conversionRate)).toFixed(1))), "-"]);

  // 5. Dự Báo Cạn Kho
  aoa.push([
    "Dự Báo Cạn Kho",
    "Thời gian",
    ...reportData.map(i => {
      if (i.daysRemaining === null) return 'An toàn';
      if (i.daysRemaining === 0) return 'HẾT HÀNG';
      return `Còn ~${Math.ceil(i.daysRemaining)}d (${i.depletionDate})`;
    }),
    "-"
  ]);

  aoa.push([]);
  aoa.push(["* Ghi chú: Định mức hao hụt trung bình ngày dựa trên số liệu xuất dùng thực tế trong 30 ngày gần nhất. Các ô số liệu chỉ chứa con số thuần túy giúp dễ dàng copy và xử lý dữ liệu Excel."]);
  aoa.push([]);

  // Signature
  aoa.push([...Array(emptyColsForSig).fill(''), "NGƯỜI LẬP BÁO CÁO"]);
  aoa.push([...Array(emptyColsForSig).fill(''), "(Ký & ghi rõ họ tên)"]);
  aoa.push([]);
  aoa.push([]);
  aoa.push([...Array(emptyColsForSig).fill(''), authorName]);

  const wsSummary = XLSX.utils.aoa_to_sheet(aoa);

  // Apply column widths
  const colsInfo = [
    { wch: 22 }, // Col 0
    { wch: 12 }, // Col 1
    ...reportData.map(() => ({ wch: 20 })), // Bag type cols
    { wch: 18 }  // Total col
  ];
  wsSummary['!cols'] = colsInfo;

  // Apply merges
  wsSummary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, totalCols - 3) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(0, totalCols - 3) } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols - 1 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols - 1 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: totalCols - 1 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 3 } },
    { s: { r: 12, c: 0 }, e: { r: 12, c: totalCols - 1 } },
    { s: { r: 14, c: 0 }, e: { r: 15, c: 0 } },
    { s: { r: 16, c: 0 }, e: { r: 17, c: 0 } },
    { s: { r: 18, c: 0 }, e: { r: 19, c: 0 } },
    { s: { r: 20, c: 0 }, e: { r: 21, c: 0 } },
    { s: { r: 24, c: 0 }, e: { r: 24, c: totalCols - 1 } },
    { s: { r: 26, c: emptyColsForSig }, e: { r: 26, c: totalCols - 1 } },
    { s: { r: 27, c: emptyColsForSig }, e: { r: 27, c: totalCols - 1 } },
    { s: { r: 30, c: emptyColsForSig }, e: { r: 30, c: totalCols - 1 } }
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, "BaoCao_TongHop");

  // 2. Sheet 2: Unit = "bao" only
  const baoRows = reportData.map((item, index) => ({
    'STT': index + 1,
    'Chu kỳ': cycleName,
    'Thời gian': timeRangeStr,
    'Loại Túi': item.name,
    'Đơn Vị Tính': 'bao',
    'Tồn Kho': item.currentStock,
    'Số lượng Nhập': item.totalImport,
    'Số lượng Xuất': item.totalExport,
    'TB Dùng/Ngày': Number(item.avgDailyUsage.toFixed(1))
  }));
  const wsBao = XLSX.utils.json_to_sheet(baoRows);
  XLSX.utils.book_append_sheet(wb, wsBao, "BaoCao_Theo_Bao");

  // 3. Sheet 3: Unit = "kg" only
  const kgRows = reportData.map((item, index) => {
    const w = getBagWeightKg(item.bagTypeId, conversionRate);
    return {
      'STT': index + 1,
      'Chu kỳ': cycleName,
      'Thời gian': timeRangeStr,
      'Loại Túi': item.name,
      'Đơn Vị Tính': 'kg',
      'Tồn Kho': item.currentStock * w,
      'Số lượng Nhập': item.totalImport * w,
      'Số lượng Xuất': item.totalExport * w,
      'TB Dùng/Ngày': Number((item.avgDailyUsage * w).toFixed(1))
    };
  });
  const wsKg = XLSX.utils.json_to_sheet(kgRows);
  XLSX.utils.book_append_sheet(wb, wsKg, "BaoCao_Theo_Kg");

  // 4. Sheet 4: Yearly Monthly Breakdown (when filterType === 'YEAR')
  if (filterType === 'YEAR') {
    const monthlyRows = monthlyBreakdown.map(item => {
      const rowObj: Record<string, any> = {
        'Tháng': item.monthName,
        'Tổng Nhập (bao)': item.totalImportBao,
        'Tổng Nhập (kg)': Math.round(item.totalImportKg * 10) / 10,
        'Tổng Xuất (bao)': item.totalExportBao,
        'Tổng Xuất (kg)': Math.round(item.totalExportKg * 10) / 10,
      };
      BAG_TYPES.forEach(bag => {
        rowObj[`Nhập - ${bag.name} (bao)`] = item.importsByBag[bag.id] || 0;
        rowObj[`Xuất - ${bag.name} (bao)`] = item.exportsByBag[bag.id] || 0;
      });
      return rowObj;
    });
    const wsMonthly = XLSX.utils.json_to_sheet(monthlyRows);
    XLSX.utils.book_append_sheet(wb, wsMonthly, "ChiTiet_12_Thang");
  }

  // 5. Sheet 5: Detailed Transaction Logs (Admin only)
  if (user?.role === 'Admin') {
    const logsData = logs.map(log => ({
      'Thời gian': format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm'),
      'Loại': log.transactionType,
      'Người thực hiện': log.userEmail,
      'Thiết bị': log.deviceInfo
    }));
    const ws2 = XLSX.utils.json_to_sheet(logsData);
    XLSX.utils.book_append_sheet(wb, ws2, "LichSu_ChiTiet");
  }

  XLSX.writeFile(wb, `BaoCao_Xopker_${format(new Date(), 'ddMMyyyy')}.xlsx`);
};
