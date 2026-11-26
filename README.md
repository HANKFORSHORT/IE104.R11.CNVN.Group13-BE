# Astra Online Judge — Backend API (`IE104.Group13.BE`)

Backend API cho nền tảng luyện tập và thi đấu lập trình **Astra** (môn học IE104 - Phát triển ứng dụng Web). Hệ thống được xây dựng bằng **Node.js (Express)**, sử dụng **MySQL 8.4** lưu trữ trên **Aiven Cloud** và triển khai trên **Render**.

## 1. Kiến trúc & Công nghệ sử dụng

* **Runtime & Framework:** Node.js, Express.js
* **Database:** MySQL 8.4.11 (Hosted on Aiven Cloud với kết nối bảo mật SSL/TLS)
* **Database Client:** DBeaver (kết nối qua CA Certificate `ca.pem`)
* **Deployment:** Render (Backend Web Service) + Aiven (Managed MySQL)
* **Các thư viện chính:** `express`, `mysql2`, `dotenv`, `cors`

## 2. Cấu trúc thư mục hiện tại

```text
IE104.Group13.BE/
├── certs/
│   └── ca.pem              # Chứng chỉ SSL CA của Aiven MySQL
├── .env                    # Biến môi trường kết nối DB (không commit lên Git)
├── .gitignore              # Loại trừ node_modules/, .env và file tạm
├── db.js                   # Khởi tạo MySQL Connection Pool kèm cấu hình SSL
├── server.js               # Entry point của Express server & API kiểm tra kết nối
├── package.json            # Khai báo dependencies và scripts
└── README.md               # Tài liệu hướng dẫn dự án