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
    version: 'v3.3.1',
    date: '01/09/2026',
    title: 'Sửa Lỗi Hook React & Tương Thích Gói Animation',
    isLatest: true,
    tagline: 'Phiên bản mới nhất',
    changes: [
      'Chuyển đổi các import animation sang motion/react chính thức để tương thích hoàn toàn với React 19.',
      'Khắc phục triệt để lỗi Invalid Hook Call và Cannot read properties of null (reading useContext) khi khởi chạy ứng dụng.',
      'Cải thiện tính ổn định của cơ chế Tooltip tùy chỉnh trên biểu đồ thống kê.'
    ]
  },
  {
    version: 'v3.3.0',
    date: '01/09/2026',
    title: 'Bổ Sung Biểu Đồ Thống Kê Sử Dụng Túi Đa Chế Độ',
    tagline: 'Phiên bản trước',
    changes: [
      'Tích hợp khu vực biểu đồ thống kê sử dụng túi trực tiếp vào trang Báo Cáo với 2 chế độ: Biểu đồ đường Xu hướng và Biểu đồ cột Tổng sử dụng.',
      'Hỗ trợ 5 loại túi (16, 20, 25, 30, 37) với tính năng tương tác bật/tắt nhanh từng loại trên thanh chú giải.',
      'Tự động gom nhóm dữ liệu theo từng mức thời gian của bộ lọc (ngày, tuần, tháng, năm, tùy chọn khoảng ngày).',
      'Đồng bộ dữ liệu chuẩn xác với bảng báo cáo, xử lý tỷ lệ quy đổi túi 16 theo thời điểm giao dịch và tối ưu hiển thị trên di động.'
    ]
  },
  {
    version: 'v3.2.2',
    date: '01/09/2026',
    title: 'Tinh Chỉnh Giao Diện Báo Cáo',
    tagline: 'Phiên bản trước',
    changes: [
      'Loại bỏ phần biểu đồ xu hướng trong mục Báo Cáo theo yêu cầu người dùng.',
      'Tối ưu không gian hiển thị tập trung vào bảng số liệu tổng hợp và chi tiết kỳ báo cáo.'
    ]
  },
  {
    version: 'v3.2.1',
    date: '01/09/2026',
    title: 'Tối Ưu Cấu Hình & Khởi Động Lại Máy Chủ',
    tagline: 'Phiên bản trước',
    changes: [
      'Tối ưu hóa cấu hình máy chủ phát triển Vite với cổng 3000 và host 0.0.0.0 ổn định.',
      'Khởi động lại và làm mới tiến trình máy chủ phát triển (Dev Server) để khôi phục hoạt động ứng dụng.',
      'Đảm bảo khả năng tải trang mượt mà và kết nối cơ sở dữ liệu thời gian thực.'
    ]
  },
  {
    version: 'v3.2.0',
    date: '23/08/2026',
    title: 'Cảnh Báo Thiếu Dữ Liệu Nhật Ký & Giám Sát Tổng Quan',
    tagline: 'Phiên bản trước',
    changes: [
      'Tự động kiểm tra thời gian ghi nhận cuối cùng trong Nhật ký và hiển thị cảnh báo đỏ tại trang Tổng Quan khi thiếu dữ liệu lớn hơn 2 ngày.',
      'Cung cấp thông tin chi tiết số ngày thiếu dữ liệu kèm ngày ghi nhận gần nhất và các nút điều hướng bổ sung nhanh.',
      'Tối ưu hóa khả năng đồng bộ dữ liệu thời gian thực giữa các phân hệ giao dịch và bảng điều khiển Tổng Quan.'
    ]
  },
  {
    version: 'v3.1.1',
    date: '12/08/2026',
    title: 'Đồng Bộ Định Dạng Ngày & Cấu Hình PWA',
    tagline: 'Phiên bản trước',
    changes: [
      'Đồng bộ định dạng hiển thị ngày tháng chuẩn DD/MM/YYYY cho các ô chọn ngày và hộp thoại xác nhận Nhập kho & Xuất nhanh.',
      'Tối ưu hóa cấu hình Progressive Web App (PWA) giúp cài đặt ứng dụng độc lập trên thiết bị di động và máy tính.',
      'Cập nhật nhãn phiên bản ứng dụng lên v3.1.1.'
    ]
  },
  {
    version: 'v3.1.0',
    date: '06/08/2026',
    title: 'Nâng Cấp Giao Diện Metallic Blue & Tùy Chỉnh Biểu Đồ',
    tagline: 'Phiên bản trước',
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

export const CURRENT_APP_VERSION = VERSION_HISTORY[0]?.version || 'v3.2.2';
