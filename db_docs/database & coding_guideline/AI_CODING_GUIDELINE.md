# AI Coding Guidelines: Astra Backend

You are extending the **existing backend** of Astra, an Online Judge platform (Node.js, Express 5, MySQL 8.4 on Aiven, `mysql2`, deployed on Render). You are not building a new project. Preserve its architecture, conventions and data integrity.

The frontend lives in a **separate repository** and has its own `docs/AI_CODING_GUIDELINE.md`. This repo is **API and database only**.

## 0. Repositories

| Role | Repository |
|---|---|
| Backend (this repo) | https://github.com/HANKFORSHORT/IE104.R11.CNVN.Group13-BE |
| Frontend | https://github.com/HANKFORSHORT/IE104.R11.CNVN.Group13-FE |
| Frontend coding guideline | https://github.com/HANKFORSHORT/IE104.R11.CNVN.Group13-FE/blob/master/docs/AI_CODING_GUIDELINE.md |
| Judge0 (execution engine) | https://github.com/judge0/judge0 |
| Judge reference: DMOJ judge-server | https://github.com/DMOJ/judge-server |
| Judge reference: CMS | https://github.com/cms-dev/cms |

Read the frontend repo when a task touches API shapes. Its pages and `js/user-data.js` show which data the UI expects.

## 1. Priorities (in order)

1. Data integrity and security
2. Consistency with the existing codebase
3. Preserve existing functionality and API contracts
4. Reuse existing modules, helpers and queries
5. Readable, maintainable code
6. New implementations only when necessary

Make the smallest change that accomplishes the task. Do not rewrite, restructure, rename or reformat unrelated code.

## 2. Workflow

1. **Inspect**: read `README.md`, `docs/DATABASE.md`, `docs/ERD.md`, the related migrations, routes, controllers, services and repositories. Never assume a table, column, helper or route doesn't exist without checking.
2. **Plan**: decide which files change, whether a migration is needed, which API responses change, and whether the frontend is affected.
3. **Implement**: follow the conventions below.
4. **Verify**: run the server, the relevant scripts and the smoke tests. Check that the queries use the intended indexes (`EXPLAIN`) when they touch hot paths.
5. **Report** concisely: what changed, files modified or created and why, migrations added, API contract changes, what was tested and what was **not** tested, and FE follow-ups.

## 3. Repository boundary (frontend vs backend)

- Everything related to the frontend (HTML, CSS, client-side JS, images, components, UI text) belongs **only in the FE repo**.
- The backend returns **JSON only**. No static file serving, no view engines, no HTML responses (except error responses).
- If a backend change requires a frontend change, **do not edit the [FE repo](https://github.com/HANKFORSHORT/IE104.R11.CNVN.Group13-FE) from here**. List it under "FE follow-ups" in your report, with the endpoint, the request/response shape and an example.

## 4. Project structure

```
server.js                 # entry point: app setup, middleware, route mounting, listen
db.js                     # shared mysql2/promise pool (the only place a pool is created)
certs/ca.pem              # Aiven CA certificate (public)
src/
  routes/                 # Express routers; URL → controller only
  controllers/            # parse/validate request, call service, shape response
  services/               # business rules (judging, scoring, contests, permissions)
  repositories/           # all SQL lives here; one file per aggregate (submissions, problems, …)
  middlewares/            # auth, error handler, rate limit, request validation
  judge/                  # judge-engine adapters (judge0.js); worker code when it exists
  utils/                  # small pure helpers
db/
  migrations/NNNN_*.sql   # ordered, append-only schema changes
  seeds/                  # dev/test seed data only
scripts/                  # migrate, seed, smoke tests, judge0 language sync
docs/                     # DATABASE.md, ERD.md, this guideline
```

- Layering is one-directional: **routes → controllers → services → repositories → db**. Controllers never write SQL, and repositories never read `req`/`res`.
- Do not add new top-level folders without a clear reason.
- Use CommonJS (`require` / `module.exports`). Do not convert to ESM.

## 5. Database rules

### 5.1 Migrations
- Every schema change is a **new** numbered file in `db/migrations/` (`0007_add_editorials.sql`). Never edit a migration that has already been applied anywhere, and never change the schema by hand in DBeaver.
- Migrations must work on an empty database **and** on top of the current schema. Prefer additive changes: add a nullable column, backfill it, then tighten constraints in a later migration.
- Destructive changes (drop or rename a table or column) need an explicit reason in the report and a data-preservation plan.
- Update `docs/DATABASE.md` and `docs/ERD.md` in the **same change** as the migration.

### 5.2 Conventions
- InnoDB, `utf8mb4`, `utf8mb4_0900_ai_ci` (binary collation for tokens and hashes).
- `snake_case` names and plural table names. Keys are `<singular>_id`. Booleans are `is_*`, timestamps are `*_at`, and units go in names (`*_ms`, `*_kb`, `*_bytes`).
- All timestamps are **UTC**, `DATETIME(3)`. The pool uses `timezone: 'Z'`. Never use server local time or `NOW()` from JS with a local timezone.
- Scores are `DECIMAL`, never `FLOAT`.
- Every foreign key has an index and a deliberate `ON DELETE`. History (submissions, executions, results) is `RESTRICT`. Deactivate rows (`is_active`, `status`) instead of deleting them.
- Status values are a closed set (ENUM or CHECK) documented in `docs/DATABASE.md`. Add a new value with a migration and a doc update.

### 5.3 Queries
- **Always use parameterized queries** (`pool.execute(sql, params)`). Never build SQL by string concatenation with user input. Whitelist dynamic `ORDER BY` columns.
- Use explicit column lists. Never use `SELECT *` in application code, because it can leak hidden columns.
- Paginate every list endpoint (keyset pagination on `(created_at, id)` for big tables such as submissions; `LIMIT`/`OFFSET` only for small ones).
- Multi-row writes that must succeed together use a transaction (`getConnection()`, `beginTransaction()`, `commit()`/`rollback()`, then `release()` in `finally`).
- Avoid N+1 queries. Fetch child rows in one query with `WHERE … IN (?)` or a join.

## 6. Security rules (non-negotiable)

- **Hidden test cases** (`is_hidden = 1`) are never returned by any user-facing endpoint: no input, no expected output, no per-case output. Public endpoints read samples only through the documented public query or view.
- **Source code** is visible only to its owner, to admins, or as the documented privacy and contest rules allow. Check permissions in the service layer, not in the frontend.
- **Judge internals**, meaning Judge0 tokens, raw engine statuses and judge URLs, are never exposed to clients. Clients see Astra verdicts, scores, time and memory only.
- **Execution limits** (time and memory) always come from the `problems` table. Never trust limits, language IDs or test data from the request body.
- **Secrets** (DB password, Judge0 auth token, session or JWT secret) come only from environment variables. Never write them in code, SQL, seeds, logs or error messages. Update `.env.example` (placeholders only) when you add a variable.
- **Passwords** are stored only as a strong hash (bcrypt or argon2). Session, reset and verification tokens are stored **hashed**.
- Validate and size-limit all input (source code max size, text lengths). Return generic error messages to clients and log the details server-side without secrets.
- CORS allows only `FRONTEND_ORIGIN`.

## 7. API conventions

- Base path `/api/v1/…`. Use plural resource nouns (`/api/v1/problems/:slug`, `/api/v1/submissions/:id`).
- JSON in and JSON out. Field names in responses are **camelCase**, and repositories map from snake_case.
- Success: `{ "data": …, "meta": { "page": …, "nextCursor": … } }`. Error: `{ "error": { "code": "SUBMISSION_NOT_FOUND", "message": "…" } }`, with the correct HTTP status (400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 429 rate limited, 500 internal).
- Use one central error-handling middleware. Express 5 forwards rejected async handlers, so do not wrap every route in try/catch just to call `next`.
- Timestamps in responses are ISO 8601 UTC strings (`2026-11-21T04:17:56.000Z`). The frontend localizes them.
- Changing an existing response shape is a breaking change. Avoid it, or version it, and always list it under FE follow-ups.

## 8. Judging rules

- Submitting creates a `submissions` row, an `executions` row (`queued`) and a `judge_jobs` row **in one transaction**. Judging is asynchronous, and the HTTP request never waits for Judge0.
- Workers claim jobs with `SELECT … FOR UPDATE SKIP LOCKED` and a lease (`locked_at`, `locked_by`). Expired leases are recoverable. Retries use `available_at` backoff, up to the documented max `retry_count`.
- Judge0 language IDs come only from `language_engine_mappings`, populated by `scripts/sync-judge0-languages.js`. **Never hardcode a Judge0 language ID or status ID** in application logic, except in the single documented status-to-verdict mapping module.
- Map engine statuses to Astra verdicts (`AC`, `WA`, `TLE`, `MLE`, `CE`, `RE`, `IE`) in one place (`src/judge/`). Handle missing `stdout`, `stderr` and `compile_output` (they can be null or base64-encoded).
- A rejudge creates a **new execution**. Never overwrite the results of a past execution.

## 9. Code standards

- Use async/await. No callbacks and no unhandled promises.
- Use meaningful names and small functions. Comment *why*, not *what*.
- Add no new dependency unless it is clearly needed, and justify it in the report. Do not add an ORM, a queue system or a framework swap without the team's agreement.
- Use one config module or `process.env` access point at startup. Fail fast with a clear message if a required variable is missing.
- Logging: no `console.log` of request bodies, source code, passwords, tokens or full SQL with parameters.

## 10. Testing and verification

- Run `npm run db:migrate` against a **local or throwaway** MySQL 8.4, never against the production Aiven database unless explicitly asked.
- Keep the smoke tests (`npm run db:smoke`) passing, and extend them when you add tables or constraints.
- For new endpoints, show a real request and response (curl or a test) in your report.
- **Never claim something works or was tested if you did not run it.** Clearly separate "verified" from "not verified".

## 11. Git

- Make small, focused commits with a clear message (`feat(db): add editorials table`, `fix(api): hide hidden tests in problem detail`).
- Never commit `.env`, real credentials, dumps of production data or `node_modules`.
- One concern per pull request. Migrations go together with the code and docs that need them.

## 12. Tie-breakers

Security over convenience. Integrity over speed. Inspect before implementing. Reuse before creating. Consistency over personal preference. Minimal change over refactoring. Honest reporting over optimistic claims.
