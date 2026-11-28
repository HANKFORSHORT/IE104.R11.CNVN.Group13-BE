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

```

## Public profile API

`GET /api/profiles/:handle` returns an active user's public profile, rating, solved and submission counts, UTC daily submission activity for the last year, and earned achievements. Profiles with `user_settings.is_profile_public = 0` return 404. The response excludes email, password hashes, source code and other private account fields. This endpoint does not authenticate the browser; private profile and settings APIs require server-side authentication.

## Phase 1: profile identity schema and demo data

This backend repository keeps its SQL in `db/migrations/` and `db/seeds/`. The baseline schema was copied unchanged from the IE104 materials. `0002_add_oauth_accounts.sql` makes `users.password_hash` nullable and adds Google/Facebook provider links. Existing `user_id`, `handle`, and `country_code` are retained; later API responses will map them to `id`, `username`, and `country`. See [`DATABASE.md`](db_docs/database%20%26%20coding_guideline/DATABASE.md) and [`ERD.md`](db_docs/database%20%26%20coding_guideline/ERD.md).

For a **local throwaway MySQL 8.4 database**:

```bash
npm ci
cp .env.example .env
# Set DB_USER, DB_PASSWORD and DB_NAME for your local MySQL instance.
npm run db:migrate
npm run db:migrate  # should apply zero files the second time
npm run db:seed:profiles
```

The demo seed creates ten fictional public profiles with `example.invalid` emails. Passwords for its eight password accounts are random and undisclosed; two OAuth-only accounts use `demo:` provider IDs that no real provider will return. These are **view-only demo profiles**, not login credentials. The seed is blocked when `NODE_ENV=production` and requires a local DB unless `ALLOW_REMOTE_DEMO_SEED=1` is explicitly set for a disposable remote development DB. It leaves existing users unchanged on rerun. Sample ratings are illustrative; solved and submission counts stay zero until actual judged submissions exist.

Do not run the migrations or seed on Aiven yet. The live schema and Aiven credentials could not be verified from this workspace, and this phase is for review. The authentication, profile write APIs, curl examples, and OAuth setup belong to the later phases.
