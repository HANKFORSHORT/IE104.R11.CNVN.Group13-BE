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

## Phase 1: profile identity schema and sample users

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

The `db/seeds/profile_users.sql` seed creates ten fictional public profiles with ordinary handles and names, with `example.invalid` emails. Passwords for its eight password accounts are random and undisclosed; two OAuth-only accounts use `fixture:` provider IDs that no real provider will return. These are **view-only sample accounts**, not login credentials. They appear as regular profiles in the public profile page. The seed is blocked when `NODE_ENV=production` and requires a local DB unless `ALLOW_REMOTE_DEMO_SEED=1` is explicitly set for a disposable remote development DB. It leaves unrelated users unchanged on rerun and renames any matching older sample accounts while preserving their IDs. Sample ratings are illustrative; solved and submission counts stay zero until actual judged submissions exist.

Do not run the sample seed on a production Aiven database. The live schema could not be verified from this workspace because the database login was rejected. Apply `0002_add_oauth_accounts.sql` before running the seed in a disposable database. The profile write APIs belong to a later phase.

## Phase 2: authentication

Run migrations `0001` and `0002` before starting the API. Copy `.env.example` to `.env`, enter database credentials, an actual `FRONTEND_ORIGIN` and `FRONTEND_URL`, and a random `JWT_SECRET` of at least 32 bytes. For local development, serve the frontend on the origin in `FRONTEND_ORIGIN` (the example uses `http://localhost:5500`); the backend runs on `http://localhost:3000`. Configure Google and Facebook independently: set an ID, secret, and callback URL together for each provider you enable. Unconfigured provider routes return `OAUTH_UNAVAILABLE`; email login and configured providers remain available. The browser must call API endpoints with `credentials: 'include'`. The server allows credentialed CORS only for the configured FE origin and requires that origin on POST requests.

```bash
npm ci
npm run db:migrate     # local or disposable MySQL 8.4 only
npm start
```

The API uses direct OAuth authorization-code flows: only two providers are needed, and this keeps the provider logic in Astra's existing service layers without adding Passport sessions. Passwords use bcryptjs. JWTs are signed with `JWT_SECRET`, sent in an HttpOnly, Secure, SameSite=None cookie, and backed by hashed, revocable rows in `auth_sessions`. Google login automatically links an existing account only when Google reports a verified email. Facebook does not provide an equivalent verified-email claim: if its email matches an Astra account, the callback sends the browser to `login.html?auth_error=ACCOUNT_LINK_REQUIRED&provider=facebook`. The user signs in to Astra and starts `GET /api/v1/auth/facebook/link` to finish linking. New Facebook-only accounts use a private placeholder email even if Facebook supplied an address, until a verified-email flow is added. The FE login page shows the account-link prompt and resumes Facebook linking after the user signs in.

| Method | Route | Request or result |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | `{ "username", "email", "password", "displayName"?, "country"?, "emailNotifications"? }`; 201 `{ "data": user }` |
| POST | `/api/v1/auth/login` | `{ "email", "password" }`; 200 `{ "data": user }` |
| GET | `/api/v1/auth/me` | Current user, or 401 `UNAUTHENTICATED` |
| POST | `/api/v1/auth/logout` | Revokes the session and clears its cookie |
| GET | `/api/v1/auth/google`, `/api/v1/auth/facebook` | Redirects to provider; optional same-origin `returnTo` query |
| GET | `/api/v1/auth/google/link`, `/api/v1/auth/facebook/link` | Requires Astra session; links a provider after callback |

All error responses have `{ "error": { "code": "...", "message": "..." } }`. A user object has `id` (string), `username`, `email` (null for new Facebook-only accounts), `displayName`, `avatarUrl`, and `emailVerified`; it never includes `password_hash` or internal placeholder addresses. This is the current-auth snapshot, not the Phase 3 full own-profile response.

Example local requests (replace the password and email; keep the cookie jar out of Git):

```bash
curl -i -c /tmp/astra-cookies.txt -H 'Origin: http://localhost:5500' -H 'Content-Type: application/json' -d '{"username":"sam_lee","email":"sam@example.com","password":"a-long-private-password"}' http://localhost:3000/api/v1/auth/register
curl -i -b /tmp/astra-cookies.txt -H 'Origin: http://localhost:5500' http://localhost:3000/api/v1/auth/me
curl -i -b /tmp/astra-cookies.txt -H 'Origin: http://localhost:5500' -X POST http://localhost:3000/api/v1/auth/logout
curl -i -c /tmp/astra-cookies.txt -H 'Origin: http://localhost:5500' -H 'Content-Type: application/json' -d '{"email":"sam@example.com","password":"a-long-private-password"}' http://localhost:3000/api/v1/auth/login
```

OAuth app creation and callback registration are in [OAuth setup](db_docs/OAUTH_SETUP.md). There are no live provider credentials in this repository. FE pages and the header use `GET /api/v1/auth/me` to display the server session.

## Phase 3: profile API

The existing users, user_settings, oauth_accounts, user_problem_stats, submissions,
and achievement tables supply the profile data. No new migration is needed.
The existing GET /api/profiles/:handle route remains available.

| Method | Route | Result |
| --- | --- | --- |
| GET | `/api/v1/users/:username` | Public profile; 404 for missing, inactive, or private profiles |
| GET | `/api/v1/me` | Own profile, including email, linked providers, and settings; requires login |
| PATCH | `/api/v1/me` | Update any of username, displayName, bio, avatarUrl, country; requires login |

Success responses use `{ "data": ... }`; errors use `{ "error": { "code": "...", "message": "..." } }`.
The public profile includes id, username, displayName, bio, avatarUrl, country
(two-letter code), region, rating, maxRating, createdAt, solvedCount,
submissionCount, activity, and achievements. It never includes email or
settings. The own response adds email, linkedProviders, and settings.

Example public response:

```json
{
  "data": {
    "id": "7",
    "username": "sam_lee",
    "displayName": "Sam Lee",
    "bio": "Solving problems",
    "avatarUrl": null,
    "country": "VN",
    "region": null,
    "rating": 1200,
    "maxRating": 1300,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "solvedCount": 3,
    "submissionCount": 9,
    "activity": [],
    "achievements": []
  }
}
```

PATCH accepts only those five profile fields. username is 3–40 ASCII letters,
digits, underscore or hyphen; displayName is 1–100 characters or null; bio
is at most 200 characters or null; avatarUrl must be HTTPS (HTTP localhost
is allowed for local development), or null; country is a two-letter code
or null. A blank avatar URL also clears it. A duplicate username returns
409 USERNAME_TAKEN. An authenticated owner can still read their profile
when settings.isProfilePublic is false.

Examples, after signing in with the cookie jar from Phase 2:

```bash
curl -i http://localhost:3000/api/v1/users/sam_lee
curl -i -b /tmp/astra-cookies.txt http://localhost:3000/api/v1/me
curl -i -b /tmp/astra-cookies.txt -X PATCH -H 'Origin: http://localhost:5500' \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"Sam Lee","bio":"Learning algorithms","country":"VN"}' \
  http://localhost:3000/api/v1/me
```

Run `npm test` for the in-memory auth, profile, account-list, and reset tests. A live MySQL
request and Google/Facebook login still require deployment with the correct
environment variables and migration 0002.

### User account pages (FE wiring)

The FE uses `/api/v1` for account data. Routes returning private data require the
`__Host-astra_session` cookie and return `{ "data": ... }`; failures return
`{ "error": { "code": "...", "message": "..." } }`.

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/v1/auth/forgot-password` | POST | Send reset email; body `{ "email": "..." }` |
| `/api/v1/auth/reset-password` | POST | Use emailed token; body `{ "token": "...", "newPassword": "..." }` |
| `/api/v1/auth/change-password` | POST | Authenticated password change; body `{ "currentPassword": "...", "newPassword": "..." }` |
| `/api/v1/me/settings` | PATCH | Update profile visibility or notification preferences |
| `/api/v1/me/submissions` | GET | Own submissions; `?limit=50&cursor=...` |
| `/api/v1/me/solved` | GET | Own accepted problems; `?limit=50&cursor=...` |
| `/api/v1/users/:username/solved` | GET | Public accepted problems, subject to profile visibility |
| `/api/v1/me/notifications` | GET | Own notifications; `?limit=50&cursor=...` |
| `/api/v1/me/notifications/:id` | PATCH | Mark one notification read |
| `/api/v1/me/notifications/read-all` | POST | Mark all notifications read |

Password reset uses a random, single-use token stored only as a SHA-256 hash in
`password_reset_tokens`. Links expire after 30 minutes. The forgot endpoint
returns the same message for existing and unknown emails, and limits an account
to one reset request in five minutes. Password reset revokes all existing sessions.

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and
`SMTP_FROM` in the Render Environment. `SMTP_SECURE=true` is usual for port
465; use `false` with port 587 and STARTTLS. The sender address must be allowed
by your SMTP provider. Do not put SMTP secrets in a tracked file. If SMTP is
not configured or delivery fails, the forgot endpoint returns HTTP 503.

For the GitHub Pages FE URL supplied for this project, set
`FRONTEND_ORIGIN=https://hankforshort.github.io` and
`FRONTEND_URL=https://hankforshort.github.io/IE104.R11.CNVN.Group13-FE/`.
The former is an origin; the latter includes the page subpath and trailing slash.
Both the FE and BE must be deployed for live login to work. Cookies are Secure
and SameSite=None because GitHub Pages and Render are different sites; browsers
that block third-party cookies may still prevent persistent sessions. Serving
both on domains under one site avoids that browser limitation.

Quick checks after migration and deployment:

```sh
curl -i https://ie104-r11-cnvn-group13-be.onrender.com/api/health
curl -i -H 'Content-Type: application/json' \
  -d '{"email":"someone@example.com"}' \
  https://ie104-r11-cnvn-group13-be.onrender.com/api/v1/auth/forgot-password
curl -i https://ie104-r11-cnvn-group13-be.onrender.com/api/v1/users/a-public-username
```

A successful forgot response means a request was accepted; it does not disclose
whether that email belongs to an account. Test delivery with a real account you
control, then use the emailed link. For credentialed browser requests, the
response must include `Access-Control-Allow-Origin` for the exact FE origin and
`Access-Control-Allow-Credentials: true`.
