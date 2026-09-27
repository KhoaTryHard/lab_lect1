# Practical Lab: Architecting Latency Hiding

Ứng dụng này triển khai bài lab trong `Lect01_Overview.pdf`: cùng một form đăng ký được chạy theo hai cách, kiểm tra lỗi định dạng tại server hoặc tại client. Server luôn kiểm tra lại dữ liệu và quyết định các lỗi nghiệp vụ như email đã tồn tại.

## Chạy demo trên Windows

```powershell
npm install
npm run demo
```

Mở <http://127.0.0.1:3000>. Dừng bằng `Ctrl+C`. Có thể dùng `?rtt=500` trên URL để hiển thị mức độ trễ đang mô phỏng; benchmark tự cấu hình proxy.

## Kiểm thử và benchmark

```powershell
npm test
npx playwright install chromium
npm run test:e2e
npm run bench
```

Benchmark chạy 4 mức RTT (0/200/500/1000 ms), 3 tình huống (sai định dạng, hợp lệ, email trùng), 2 chế độ và 30 lượt đo mỗi tổ hợp. Kết quả nằm ở `reports/benchmark.csv`, `reports/summary.json`, `reports/analysis.md` và báo cáo xem trực tiếp tại `reports/report.html`. Có thể dùng `BENCH_ITERATIONS=2 npm run bench` để kiểm tra nhanh.

## Diễn giải kết quả

Với dữ liệu sai định dạng, chế độ local phải có `http_request_count = 0` và thời gian phản hồi gần như không đổi khi RTT tăng. Dữ liệu hợp lệ và email trùng vẫn cần server nên cả hai chế độ đều chịu độ trễ. Đây là minh họa trực tiếp cho giả định sai “latency is zero”, đồng thời cho thấy lợi ích giảm request liên quan đến bandwidth và transport cost. Local validation không giải quyết reliability, security, heterogeneity, topology hay administrative domains.

Độ trễ do proxy bổ sung được chia đều trước request và trước response. Đây là mô phỏng có kiểm soát trên một máy, không phải đo WAN thật.
