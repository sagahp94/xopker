export interface VersionRelease {
  version: string;
  date?: string;
  title: string;
  isLatest?: boolean;
  tagline?: string;
  changes: string[];
}

export const VERSION_HISTORY: VersionRelease[] = [
  {
    version: 'v3.1.0',
    date: '06/08/2026',
    title: 'Nâng Cấp Giao Diện Metallic Blue & Tùy Chỉnh Biểu Đồ',
    isLatest: true,
    tagline: 'Phiên bản hiện tại',
    changes: [
      'Cập nhật màu chủ đạo Metallic Blue (Xanh lam ánh kim) sang trọng trên toàn bộ logo và huy hiệu phiên bản.',
      'Thêm tính năng xem biểu đồ theo khoảng ngày tùy chỉnh (tối đa 31 ngày) tại trang Báo Cáo.',
      'Tối ưu hiệu ứng viền sáng nổi bật phản hồi mượt mà khi bấm "Làm mới" dữ liệu ở trang Tổng Quan.',
      'Bổ sung mục "Lịch sử phiên bản" trực quan khi nhấn vào Avatar người dùng.',
      'Tối ưu hóa cấu trúc mã nguồn, loại bỏ các file và thư viện không sử dụng.'
    ]
  },
  {
    version: 'v3.0.0',
    date: '01/08/2026',
    title: 'Giao Diện Glassmorphism & Đồng Bộ Ngoại Tuyến',
    changes: [
      'Nâng cấp phong cách thiết kế kính mờ Glassmorphism cao cấp trên các bảng điều khiển.',
      'Tích hợp tính năng đồng bộ ngoại tuyến (Offline Sync) tự động lưu giao dịch khi mất kết nối Internet.',
      'Bổ sung huy hiệu sao tỏa sáng cho Version Badge trên Sidebar và Header.',
      'Tối ưu hóa tốc độ tải trang và phản hồi giao diện thời gian thực.'
    ]
  },
  {
    version: 'v2.5.0',
    date: '20/07/2026',
    title: 'Quản Lý Mượn/Trả Kho & Báo Cáo PDF/Excel',
    changes: [
      'Thêm trang Quản lý Vay / Trả kho chuyên biệt cho các đơn vị hợp tác.',
      'Hỗ trợ xuất báo cáo định dạng PDF và Excel chính xác theo từng chủng loại bao.',
      'Hỗ trợ linh hoạt cấu hình tỷ lệ quy đổi (kg/bao) cho Bao 16kg (BAO15) trong Cài Đặt.'
    ]
  },
  {
    version: 'v2.0.0',
    date: '10/07/2026',
    title: 'Phân Quyền Người Dùng & Nhật Ký Hoạt Động',
    changes: [
      'Tích hợp phân quyền chi tiết (Quản Trị Viên, Quản Lý, Nhân Viên) đảm bảo an toàn dữ liệu.',
      'Thêm trang Nhật Ký Hoạt Động chi tiết theo thời gian thực.',
      'Tính năng Hoàn tác (Undo) giao dịch vừa thực hiện nhanh chóng.',
      'Hỗ trợ tùy chọn giao diện Tối/Sáng (Dark/Light mode) và phong cách icon đa dạng.'
    ]
  },
  {
    version: 'v1.0.0',
    date: '01/07/2026',
    title: 'Khởi Tạo Hệ Thống Quản Lý Kho XỐPKER',
    changes: [
      'Phát hành phiên bản đầu tiên của ứng dụng Quản lý kho XỐPKER.',
      'Hỗ trợ các nghiệp vụ cốt lõi: Xuất Nhanh, Nhập Kho, Kiểm Kê và Báo cáo tổng quan.',
      'Tích hợp Firebase Firestore lưu trữ dữ liệu đám mây an toàn, ổn định.'
    ]
  }
];
