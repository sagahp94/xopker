# Project Guidelines & Rules

## Version History & Auto-Versioning Rules
- **Đánh giá và tự động cập nhật số hiệu phiên bản (Semantic Versioning)**: Mỗi khi có yêu cầu thay đổi từ người dùng, luôn đánh giá mức độ thay đổi để tự động tăng số hiệu phiên bản (`version`) và thêm mục mới vào đầu danh sách trong `src/constants/versionHistory.ts`:
  - **PATCH (vX.Y.Z -> vX.Y.Z+1)**: Sửa lỗi (bug fixes), tinh chỉnh giao diện, sửa logic nhỏ, cập nhật cấu hình PWA, định dạng ngày tháng, tối ưu hiệu năng hoặc bảo trì code.
  - **MINOR (vX.Y.Z -> vX.Y+1.0)**: Thêm tính năng mới, thêm màn hình/trang mới, thêm modal công cụ mới, bộ lọc phân tích mới.
  - **MAJOR (vX.Y.Z -> vX+1.0.0)**: Nâng cấp kiến trúc lớn, đại tu toàn bộ giao diện hoặc thay đổi luồng nghiệp vụ cốt lõi của hệ thống.
  - **Đồng bộ phiên bản**: Cập nhật cả `version` trong `package.json` tương ứng và đặt `isLatest: true` cho bản phát hành mới nhất.
- **Không ghi nhận thay đổi font chữ**: Tuyệt đối không đưa các thông tin, nội dung liên quan đến cập nhật, tinh chỉnh hoặc thay đổi phông chữ (font) vào danh sách thay đổi trong Lịch Sử Phiên Bản (`src/constants/versionHistory.ts`) ở bất kỳ phiên bản nào (hiện tại và tương lai).
