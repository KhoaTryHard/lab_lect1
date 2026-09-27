# Phân tích benchmark

Ma trận chính thức gồm 720 lượt đo: 30 lượt cho mỗi RTT, tình huống và chế độ. RTT được proxy chia đều trước request và trước response.

| RTT | Server validation median (ms) | Local validation median (ms) | Request server/local |
|---:|---:|---:|---:|
| 0 ms | 31.2 | 0.1 | 30 / 0 |
| 200 ms | 216.7 | 0.1 | 30 / 0 |
| 500 ms | 524.6 | 0.1 | 30 / 0 |
| 1000 ms | 1024.4 | 0.1 | 30 / 0 |

Với lỗi định dạng, local validation phản hồi trong khoảng thời gian xử lý JavaScript và không gửi request. Server validation phải trả một round-trip nên thời gian tăng gần theo RTT. Với dữ liệu hợp lệ hoặc email đã tồn tại, cả hai chế độ vẫn cần server; local validation chỉ loại bỏ lỗi định dạng phía client.

## Liên hệ 8 giả định sai

- **Latency is zero:** được kiểm chứng trực tiếp bằng chênh lệch khi RTT tăng.
- **Bandwidth is infinite / Transport cost is zero:** local validation tránh gửi request và body cho lỗi định dạng.
- **The network is reliable:** UI có nhánh lỗi kết nối; local validation không biến mất khi server không thể truy cập.
- **The network is secure, homogeneous, topology does not change, one administrator:** không được giải quyết bởi validation; cần cơ chế bảo mật, giao thức, discovery và quản trị riêng.

Kết quả là mô phỏng trên một máy; không đại diện cho packet loss, jitter, TLS handshake, WAN bandwidth hoặc chi phí tải JavaScript ban đầu.
