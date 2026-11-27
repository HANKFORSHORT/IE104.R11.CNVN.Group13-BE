# Agent Task: Design and Build the Astra Database (ERD + MySQL Schema + DB Layer)

You are a senior backend engineer and database architect. You are working in the **backend repository** of **Astra**, an Online Judge website built as a university group project (IE104). Your job is to design the complete relational database that backs the whole website. That covers the judging core and every feature the frontend already shows. You will also implement the database layer (migrations, seeds, connection pool, docs) in the backend repo.

This prompt builds on an earlier, more detailed backend spec (the "Judge0 DB spec", included in full at the end as **Appendix B**). Where this prompt and Appendix B disagree, **this prompt wins**.

---

## 1. Repositories

| Role | URL | What it is |
|---|---|---|
| Backend (you work here) | https://github.com/HANKFORSHORT/IE104.R11.CNVN.Group13-BE | Node.js, Express 5, MySQL 8.4 (Aiven), `mysql2`, deployed on Render |
| Frontend (read-only reference) | https://github.com/HANKFORSHORT/IE104.R11.CNVN.Group13-FE | Plain HTML/CSS/JS with no framework. Pages use **localStorage mock data** that stands in for the future API |
| Judge0 (execution engine, MVP) | https://github.com/judge0/judge0 | External code-execution API (`GET /languages`, `GET /statuses`, submissions + tokens) |
| Judge reference | https://github.com/DMOJ/judge-server | DMOJ judge: verdict set, batched/partial-point test cases |
| Judge reference | https://github.com/cms-dev/cms | Contest Management System (IOI-style): subtasks, score types, contest model |

### 1.1 Known state of the backend repo (verify it yourself first)

When this prompt was written, the backend repo had only these files:

```
certs/ca.pem        # Aiven CA certificate (public CA cert, not a secret)
db.js               # EMPTY (0 bytes)
server.js           # EMPTY (0 bytes)
package.json        # "type": "commonjs"; deps: express ^5, mysql2 ^3, dotenv, cors
README.md           # Vietnamese; describes Aiven + Render + DBeaver setup
.gitignore          # ignores .env, node_modules, temp/, submissions_tmp/, binaries
```

There is no schema, no migration system, no models, no routes and no `.env.example`. So you are mostly **building from zero**, but you must still respect what exists:

- Keep CommonJS (`require`/`module.exports`). Do not switch to ESM.
- Keep `server.js` as the entry point (`npm start`).
- Keep `db.js` at the root as the module that exports the shared `mysql2` pool, because the README already documents it.
- Keep `certs/ca.pem` and the README's deployment story (Aiven + Render).
- Update the README instead of replacing it. You may add English sections, but keep the Vietnamese content.

If the repo has changed since then, trust what you actually find and adapt.

### 1.2 Read the frontend to discover the data model

The frontend is the **source of truth for which features exist**. Before designing, read at least:

- `js/user-data.js` holds the mock users, rankings (with seasonal stats such as `s04`, `s03` and `all`), contest standings, submissions (verdict, score, passed/total tests, runtime, memory, code size) and achievements/badges.
- `js/session.js` and `js/auth.js` cover login, register and forgot password, plus which pages are private.
- `js/contest.js`, `contests.html` and `contest-standings.html` cover contest registration, formats, rated/unrated flags and standings.
- `gym.html`, `js/gym-detail.js` and `js/workspace.js` cover gym sets (difficulty, duration) and the timed in-contest workspace.
- `problem-detail.html` and `js/problem-detail.js` cover description, samples, submissions, editorial and solutions tabs.
- `notifications.html`, `settings.html` and `js/account.js` cover notifications (read/unread), account settings, email and bio.
- `js/rankings.js` covers global rankings: rating, solved count, rank change, country/region filters and friends.
- `achievements.html`, `solved.html`, `public-profile.html` and `profile.html` cover the profile, activity heatmap, solved list and badges.
- `README.md` holds the sitemap (Mermaid): Problems → Description/Submissions/Editorial/Solutions; Contests → Rounds → Problems + Standings; Gym; Rankings; Profile; footer pages (Docs, FAQ, Contact, Report an issue).

Every field the frontend displays should either be stored or be derivable by a query. Write down any field you deliberately do not support.

---

## 2. Hard boundaries

1. **Frontend/backend separation.** Everything related to the frontend (HTML, CSS, client JS, images, components, page templates, UI copy) belongs **only in the FE repo**. The backend serves **JSON only**. It must not serve static files, HTML or views, and it must not contain any copied frontend code. If you think the frontend needs a change, list it in the final report under "FE follow-ups" and do not make the change.
2. **Scope is the database layer and its integration readiness.** Do **not** build the Judge0 client, the judging worker, authentication endpoints, the frontend or the deployment. Small backend changes needed for database integration are allowed: a pool module, a health route, migration/seed scripts.
3. **No new heavy dependencies.** Do not add an ORM (no Sequelize, Prisma, TypeORM or Knex) and do not add Redis or BullMQ. Write the migration runner as a small script using `mysql2`. If you add a dependency, justify it in the report.
4. **Never touch production data.** Do not run migrations or seeds against the Aiven database unless the user explicitly tells you to. Validate against a local or throwaway MySQL 8.4 instead (see §7).
5. **No secrets in git.** Credentials go only in `.env`, which is git-ignored. Commit `.env.example` with placeholders only.

---

## 3. Judge engine decision

The user mentioned "Judge0" but linked **DMOJ judge-server** and **CMS**, which are separate judge systems, not Judge0. Resolve it this way:

- **Judge0 is the execution engine for the MVP**, as Appendix B specifies.
- **DMOJ and CMS are design references only.** Borrow ideas from them, but do not integrate them:
  - DMOJ: its verdict vocabulary (AC, WA, TLE, MLE, OLE, RTE, CE, IE), partial points per test case, and an optional batched test-case grouping.
  - CMS: subtask/group scoring ("min-of-group" vs "sum") and its contest/participation model.
- **Keep the schema engine-agnostic** so Judge0 could later be replaced by DMOJ judge-server without a schema rewrite:
  - Put the language-to-engine mapping in its own table, `language_engine_mappings (language_id, engine, engine_language_key, engine_version, is_active, synced_at)`, with `UNIQUE (engine, language_id)`. `engine` is an ENUM (or a VARCHAR plus a CHECK) starting with `'judge0'`. This replaces a hardcoded `judge0_language_id` column on `programming_languages`. If you prefer the plain column from Appendix B, explain why in the docs.
  - In `execution_results`, store `engine` and `external_token` (the Judge0 token) rather than a Judge0-only column name. Also store the raw `engine_status_id` and `engine_status_description` for debugging, separate from Astra's own `verdict`.
- Astra verdicts are **Astra's own business values**. Document a mapping table from Judge0 statuses to Astra verdicts. Verify the IDs against the running instance's `GET /statuses`. Commonly documented Judge0 CE IDs are:
  - 1 In Queue, 2 Processing → still pending, so no verdict yet
  - 3 Accepted → `AC`; 4 Wrong Answer → `WA`; 5 Time Limit Exceeded → `TLE`; 6 Compilation Error → `CE`
  - 7–12 Runtime Error (SIGSEGV, SIGXFSZ, SIGFPE, SIGABRT, NZEC, Other) → `RE`
  - 13 Internal Error and 14 Exec Format Error → `IE`
  - Judge0 has **no dedicated MLE status**. Astra derives `MLE` when the measured `memory` reaches the problem's limit or a runtime error coincides with hitting the memory cap. Document the exact rule.
- Output comparison: add a `checker_type` on `problems` (`exact`, `ignore_trailing_whitespace` (default), `float_tolerance`) plus an optional `checker_epsilon`. With this, Astra can compare outputs itself instead of relying only on Judge0's built-in `expected_output` comparison. Document both options and the MVP choice.

---

## 4. Tables to design

Use the Appendix B definitions for the judging core, adjusted as described in §3. Add the platform tables below so the database can back the whole website. Pick exact columns yourself, but every table must have a clear purpose, keys, foreign keys, indexes and documented status values.

### 4.1 Identity and accounts
- `users`: handle (unique, case-insensitive through the collation), email (unique), `password_hash` (store only the hash, never the plain password), display name, bio, country code, region, avatar URL, `role` (`user`, `problem_setter`, `admin`), `status` (`active`, `banned`, `unverified`), `rating`, `max_rating`, `email_verified_at`, timestamps.
- `user_settings`: one row per user (theme preference, default language, privacy flags such as whether others can see the user's submissions' source code, notification preferences).
- `auth_sessions` or `refresh_tokens`: store **only the hash** of each token, plus expiry, revoked_at, user agent and IP.
- `password_reset_tokens` and `email_verification_tokens`: store the hashed token, expiry and used_at.
- `user_follows` (follower, followee): this powers the "friends" filter on Rankings.

### 4.2 Problems and content
- `problems`: from Appendix B, plus `slug`/code (unique, e.g. `2264F`), `visibility` (`public`, `contest_only`, `hidden`), `author_id`, `checker_type`, input/output format and constraints text, and `source` (e.g. "VOI 2026").
  - A problem used in an upcoming contest must not be publicly visible before the contest starts.
- `tags` and `problem_tags` (many-to-many).
- `problem_languages`: an optional allow-list of languages per problem. No rows means every active language is allowed. Document this rule.
- `test_cases`: from Appendix B. Add `input_size_bytes`, `output_size_bytes` and a checksum. Use `MEDIUMTEXT` (or `MEDIUMBLOB`) and document the size limit. Leave a documented path to move large files to object storage later.
- Optional `test_groups` (subtasks) with `scoring_mode` (`sum`, `all_or_nothing`). Each test case gets a nullable `test_group_id`. Include this only if you can keep it simple; otherwise list it as future work.
- `editorials`: one per problem, with `author`, `body` (Markdown) and `published_at`. It must be hidden until published or until its contest ends.
- `solution_posts`: community solutions with `user`, `problem`, `body`, optional linked accepted `submission_id`, `visibility` and `vote_count` (add `solution_votes` if needed).

### 4.3 Judging core (Appendix B, adjusted)
- `programming_languages` and `language_engine_mappings` (see §3).
- `submissions`: from Appendix B. Add `code_size_bytes`, a nullable `contest_round_id` (null means a practice or gym submission) and `client_ip` if useful.
- `executions`: from Appendix B. Add `trigger` (`initial`, `rejudge`) and `requested_by` (admin user ID for rejudges). `submissions` points to its latest execution through `current_execution_id` or a documented equivalent. Watch out for the circular foreign key and handle it deliberately.
- `execution_results`: from Appendix B, using `engine`/`external_token`, with `UNIQUE (execution_id, test_case_id)`. Store `exit_code`. Truncate stored stdout/stderr to a documented cap, for example 64 KB, and record a `truncated` flag.
- `judge_jobs`: from Appendix B. A MySQL-backed queue using `SELECT … FOR UPDATE SKIP LOCKED`, with a lease/timeout-based recovery for crashed workers, retries with backoff through `available_at`, and an index on `(status, available_at)`.

### 4.4 Contests, rounds and gym
The frontend's model: a **Contest has many Rounds, and each Round has many Problems**. **Gym** reuses the round design for past or virtual practice sets.
- `contests`: title, slug, description, `format` (`icpc`, `ioi`, `codeforces_style`; choose the set the frontend shows in `contests.html`), `is_rated`, `visibility`, registration window, created_by.
- `contest_rounds`: contest_id, title, `start_at`, `end_at` (UTC), `freeze_at` (optional standings freeze), `status`, `type` (`contest`, `gym`). Alternatively use a separate `gym_sets` table. Decide after reading `gym.html`/`gym-detail.js` and justify the choice.
- `round_problems`: round_id, problem_id, `label` (A, B, C…), `points`, display order, `UNIQUE (round_id, label)` and `UNIQUE (round_id, problem_id)`.
- `contest_registrations`: user and contest, registered_at, `status`, and an optional `is_virtual` flag for gym/virtual participation with its own start time.
- Standings: compute them from submissions. If you add a cache table (`round_standings`), document how it is rebuilt and that it is not the source of truth.
- `rating_changes`: user, round, old rating, new rating, delta and rank. This powers rating history and "rank change" on Rankings. Seasonal rankings (`s04`/`s03`) come from date ranges over this table and from solved data. Add a `seasons` table only if a date-range query cannot do the job.

### 4.5 Engagement and support
- `notifications`: user, `type`, title, body, link path (a relative frontend path, never a full URL to another origin), `read_at`, created_at, and an index on `(user_id, read_at, created_at)`.
- `achievements` (badge definitions: code, name, description, requirement, image path) and `user_achievements` (user, achievement, earned_at, evidence submission/problem), with `UNIQUE (user_id, achievement_id)`.
- `user_problem_stats` (optional cache): user, problem, `best_score`, `first_ac_at`, `attempt_count`. This makes "solved" lists and solved counts cheap. Document how the worker keeps it updated.
- `contact_messages` and `issue_reports`, for the Contact and "Report an issue" pages: who sent it (nullable for guests), email, category, body, status (`open`, `triaged`, `closed`), timestamps.

You may merge, rename or drop tables if it gives a cleaner design. Justify every deviation in the docs.

---

## 5. Cross-cutting rules

- **Engine and charset:** InnoDB, `utf8mb4`, `utf8mb4_0900_ai_ci` (handles and emails compare case-insensitively). Use a binary or `_bin` collation where exact matching matters (token hashes, external tokens).
- **Keys:** `BIGINT UNSIGNED AUTO_INCREMENT` primary keys for high-volume tables (submissions, executions, execution_results, judge_jobs, notifications). `INT UNSIGNED` is fine for small lookup tables. Every foreign key has an index.
- **Naming:** `snake_case`, plural table names, `<singular>_id` for primary and foreign keys, `is_*` for booleans, `*_at` for timestamps, units in names (`*_ms`, `*_kb`, `*_mb`, `*_bytes`).
- **Time:** store UTC in `DATETIME(3)`. Configure the pool with `timezone: 'Z'` (`+00:00`). Never rely on the server's local time. The frontend converts to Asia/Ho_Chi_Minh for display.
- **Numbers:** scores use `DECIMAL(7,2)` (or a documented precision), never FLOAT. Runtime is an integer `*_ms` and memory an integer `*_kb`. Judge0 returns `time` as seconds in a string, so convert it to ms and document the rounding.
- **Statuses:** use ENUMs or `VARCHAR` plus `CHECK`, applied consistently. Every allowed value is documented with its meaning and its allowed transitions.
- **ON DELETE:** decide this per foreign key. Defaults:
  - User-generated history (submissions, executions, results) uses `RESTRICT`. Deactivate users and problems rather than deleting them.
  - Pure child rows (test cases of a problem, problem_tags) use `CASCADE`.
  - Optional links (a solution's `submission_id`) use `SET NULL`.
- **Indexes for known hot paths:**
  - submission history: `(user_id, submitted_at DESC)` and `(problem_id, submitted_at DESC)`
  - results of one execution: `(execution_id, test_case_id)`
  - pending jobs: `(status, available_at)`
  - problem page: problem + sample test cases ordered by `display_order`, and active languages
  - round standings: submissions by `(contest_round_id, user_id, problem_id)`
  - unread notifications
- **Security in the schema:**
  - Hidden test cases are never returned by public queries. Provide documented "public" queries or views (e.g. `v_public_sample_tests`) that the API layer must use.
  - Source code is visible only to its owner, admins, or other users when the owner's privacy setting allows it. After a round ends, the contest rules apply. Document the policy.
  - Judge0 credentials, tokens and URLs stay in environment variables and never go in tables or seeds.
  - Execution limits always come from `problems` and are never taken from client input.

---

## 6. Deliverables

Commit the following to the **backend repo**:

1. **ERD** in `docs/ERD.md` as a Mermaid `erDiagram`. Show all tables, primary keys, foreign keys and cardinalities. It must render on GitHub. If it gets too big, split it into "Judging core" and "Platform" diagrams plus a small overview diagram.
2. **Migrations** in `db/migrations/NNNN_description.sql`, numbered and run in order. Each file is idempotent where practical, and none is edited after it has been applied.
3. **Migration runner** `scripts/migrate.js`: applies pending migrations inside a `schema_migrations` tracking table and stops on the first error. Add an `npm run db:migrate` script. A `db:reset` command for local use only is optional, and it must refuse to run when `NODE_ENV=production`.
4. **Seeds** in `db/seeds/` with an `npm run db:seed` script:
   - a few languages (C++17, C++20, Python 3, Java, matching the labels the frontend uses)
   - at least 2 problems (reuse frontend sample names such as "Deranged Calculator" (2264F)), each with sample **and** hidden test cases
   - 1 contest with 1 round and 3 round problems
   - 2–3 demo users with placeholder password hashes clearly marked as **dev only**, a few badges and a notification
   - **Language engine IDs:** never invent Judge0 IDs. Either leave them NULL or mark them as placeholders, and provide the sync script below.
5. **Judge0 language sync** `scripts/sync-judge0-languages.js` (with `npm run judge0:sync-languages`): calls `GET {JUDGE0_URL}/languages` using credentials from env, prints the list, and upserts `language_engine_mappings` by a documented matching rule (an explicit config file mapping slugs to Judge0 names). It must have a dry-run mode. Do not run it unless a Judge0 instance is configured. Say in the report whether it was executed.
6. **DB config** in `db.js`: a `mysql2/promise` pool built from env vars, with TLS for Aiven (`DB_SSL_CA_PATH` defaulting to `certs/ca.pem`, or `DB_SSL_CA` holding the certificate contents for Render), `timezone: 'Z'`, `charset: 'utf8mb4'`, sensible `connectionLimit`, and clear errors on failure that never log passwords. Add a minimal `server.js` with Express 5 JSON, CORS restricted to `FRONTEND_ORIGIN`, and `GET /api/health` plus `GET /api/health/db` (runs `SELECT 1`).
7. **`.env.example`** listing every variable with a placeholder and a one-line comment (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL_CA_PATH`, `DB_SSL_CA`, `DB_CONNECTION_LIMIT`, `PORT`, `NODE_ENV`, `FRONTEND_ORIGIN`, `JUDGE0_URL`, `JUDGE0_AUTH_HEADER`, `JUDGE0_AUTH_TOKEN`).
8. **Database docs** in `docs/DATABASE.md`. Cover:
   - every table and its purpose
   - relationships
   - status values and transitions (execution, verdict, job, contest round, registration, report)
   - the Judge0 status mapping
   - the submission judging lifecycle, step by step, as a Mermaid sequence diagram
   - the job-claiming SQL with `SKIP LOCKED` and lease recovery
   - the visibility/privacy rules
   - how to initialize, migrate, seed and sync languages
   - known limitations
9. **Coding guideline**: create `docs/AI_CODING_GUIDELINE.md` using the content in **Appendix A**, verbatim except where your implementation forces a factual correction (folder names, script names). Note any correction in the report. Follow this guideline yourself during this task.
10. **README update**: a short section linking to `docs/DATABASE.md`, `docs/ERD.md` and the guideline, plus the commands.

---

## 7. Validation (actually run it)

1. Start a throwaway **MySQL 8.4** with Docker (`mysql:8.4`) if available, or another local install. If you cannot run MySQL at all, say so clearly and mark everything below as **untested**.
2. Run `db:migrate` on an empty database, then run it again to prove it is idempotent and records nothing new.
3. Run `db:seed`.
4. Query `information_schema` to list every foreign key and index, and include a summary in the report.
5. Run a SQL or JS smoke-test script and **keep it in the repo**, e.g. `scripts/db-smoke-test.js` with `npm run db:smoke`. It must demonstrate:
   - creating a submission, then an execution, then several execution results
   - a second execution (a rejudge) for the same submission
   - that a duplicate `(execution_id, test_case_id)` insert is rejected
   - that the public sample-test query returns no hidden test cases
   - two concurrent connections claiming jobs with `FOR UPDATE SKIP LOCKED` never getting the same job
   - a stale lock being recovered after the lease expires
   - submission history for a user returned in order, with `EXPLAIN` showing the intended index
   - that a `RESTRICT` foreign key blocks deleting a user who has submissions
6. Report the exact commands and their real output (a summarized excerpt is fine). **Never claim something was tested if it was not executed.**

---

## 8. Final report (your last message)

1. What you found in both repos (the existing backend state and the data model implied by the frontend).
2. Gaps and problems you identified.
3. The architecture you implemented, plus a link to the ERD.
4. Tables created, grouped by domain.
5. Key design decisions and deviations from Appendix B or this prompt, with reasons.
6. Files created or modified.
7. Commands: migrate, seed, smoke test, language sync.
8. Environment variables.
9. Remaining work before Judge0 integration (the worker, the API client, auth endpoints, the public API).
10. FE follow-ups (changes the frontend repo will need, described but not made).
11. Assumptions, limitations and anything left **untested**.

---

## Appendix A — content for `docs/AI_CODING_GUIDELINE.md` (backend)

Write the content between the markers to `docs/AI_CODING_GUIDELINE.md` (without the marker lines).

<<<BEGIN AI_CODING_GUIDELINE.md>>>

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

<<<END AI_CODING_GUIDELINE.md>>>

---

## Appendix B — earlier backend spec (Judge0 DB spec)

§3 and §4 of this prompt override this spec where they differ: the engine-agnostic language mapping, `external_token`, the added platform tables, and the frontend/backend boundary.

<<<BEGIN JUDGE0 DB SPEC>>>

# Task: Design and Implement the Online Judge Database for Astra (Judge0 Integration)

You are a Senior Backend Engineer and Database Architect. Your task is to design and implement the database layer for **Astra**, an Online Judge platform, with a database architecture that supports integration with the Judge0 code execution API.

## 1. Project Context

Astra is an Online Judge platform where users can:
- Browse programming problems.
- Submit source code in supported programming languages.
- Execute submitted code against predefined test cases.
- Receive judging results, including verdict, score, execution time, and memory usage.
- View their submission history and detailed test-case results.

The current backend technology stack is:
- Node.js
- Express.js 5
- MySQL 8.4
- `mysql2` for database connectivity
- Aiven as the MySQL hosting provider
- Render for backend deployment

Judge0 will be used as an external code execution service. It must NOT be treated as part of the Astra database or backend runtime.

## 2. First: Inspect the Existing Repository

Before making any changes:

1. Inspect the entire existing backend repository.
2. Identify the current database configuration, schema, migrations, models, controllers, services, and coding conventions.
3. Examine the existing ERD or SQL schema if available.
4. Identify existing tables and relationships that can be reused.
5. Identify missing components required for an Online Judge system.

**Important constraints:**
- Do not blindly replace the existing database schema.
- Do not delete or rename existing tables without a clear technical reason.
- Preserve existing authentication, user, problem, and other functional modules.
- Follow the existing project structure and coding conventions.
- Avoid introducing unnecessary dependencies or changing the technology stack.
- If the repository already has an existing database migration system, use it.

If an important architectural decision cannot be determined from the repository, document the assumption before proceeding.

## 3. Database Requirements

Design a normalized relational database using MySQL 8.4.

The database must support the following core entities.

### A. `problems`

Stores programming problems.

Suggested fields:
- `problem_id`
- `title`
- `description`
- `difficulty`
- `time_limit_ms`
- `memory_limit_mb`
- `is_active`
- `created_at`
- `updated_at`

The time and memory limits must be configurable per problem.

### B. `programming_languages`

Stores the programming languages supported by Astra and their corresponding Judge0 language IDs.

Suggested fields:
- `language_id`
- `name`
- `slug`
- `judge0_language_id`
- `compiler_version`
- `is_active`
- `created_at`
- `updated_at`

**Judge0 compatibility requirements:**
- `judge0_language_id` must map to the actual language ID returned by the configured Judge0 instance through `GET /languages`.
- Never assume that Judge0 language IDs are universal or permanently fixed.
- The database must allow administrators to enable or disable supported languages.
- Do not hardcode Judge0 language IDs in application logic.

### C. `test_cases`

Stores test cases for each problem.

Suggested fields:
- `test_case_id`
- `problem_id`
- `input_data`
- `expected_output`
- `is_sample`
- `is_hidden`
- `score`
- `display_order`
- `created_at`
- `updated_at`

Requirements:
- One problem can have multiple test cases.
- Each test case belongs to exactly one problem.
- Support both public sample test cases and hidden evaluation test cases.
- Support individual test-case scoring.
- Hidden test-case input and expected output must never be exposed through public APIs.
- Consider how large input/output values should be stored efficiently.

### D. `submissions`

Stores users' source-code submissions.

Suggested fields:
- `submission_id`
- `user_id`
- `problem_id`
- `language_id`
- `source_code`
- `status`
- `score`
- `submitted_at`
- `updated_at`

Requirements:
- Each submission belongs to one user, one problem, and one programming language.
- Store the original source code.
- Support multiple submissions for the same problem by the same user.
- Store an overall submission verdict/status.

### E. `executions`

Represents one judging attempt for a submission.

A submission may have multiple executions because the system must support rejudging.

Suggested fields:
- `execution_id`
- `submission_id`
- `status`
- `verdict`
- `total_score`
- `max_score`
- `total_execution_time_ms`
- `peak_memory_kb`
- `started_at`
- `completed_at`
- `created_at`

Requirements:
- One submission can have multiple execution attempts.
- Each execution must be independently traceable.
- Distinguish execution status from final verdict.

For example:
- Execution status: `queued`, `processing`, `completed`, `failed`.
- Verdict: `AC`, `WA`, `TLE`, `MLE`, `CE`, `RE`, `IE`.

Use consistent naming and document the meaning of every status.

### F. `execution_results`

Stores the result of running a particular test case during an execution.

Suggested fields:
- `execution_result_id`
- `execution_id`
- `test_case_id`
- `judge0_token`
- `status_id`
- `verdict`
- `actual_output`
- `stderr`
- `compile_output`
- `execution_time_ms`
- `memory_kb`
- `score`
- `created_at`

Requirements:
- One execution can have multiple execution results.
- Each result corresponds to a test case.
- Store the Judge0 submission token for traceability.
- Store the execution output and relevant error information.
- Store runtime and memory measurements returned by Judge0.
- Avoid storing unnecessary duplicate data.
- Ensure that the same test case is not accidentally evaluated twice within the same execution unless explicitly supported.

## 4. Judge0 Integration Architecture

The database must support the following execution workflow:

1. A user submits source code.
2. Backend creates a record in `submissions`.
3. Backend creates a new record in `executions` with status `queued`.
4. A judging job is created for asynchronous processing.
5. A worker retrieves the submission and its associated problem, language, and test cases.
6. The worker obtains the corresponding `judge0_language_id`.
7. The worker sends source code, input data, and execution limits to Judge0.
8. Judge0 returns a submission token.
9. The worker polls Judge0 using that token until execution completes.
10. The worker retrieves the result and evaluates the verdict.
11. The worker stores the result in `execution_results`.
12. After all test cases are evaluated, the worker calculates the total score and updates `executions` and `submissions`.

The database must support this workflow without requiring the frontend to communicate directly with Judge0.

### Judge0-related fields and concepts

Account for the following Judge0 response attributes where appropriate:

- `token`
- `status.id`
- `status.description`
- `stdout`
- `stderr`
- `compile_output`
- `time`
- `memory`
- `exit_code`
- `language_id`

Do not store every Judge0 response field blindly. Decide which fields should be persisted, which should be transformed into Astra-specific values, and which are unnecessary.

Important:
- Judge0's token identifies an external execution request, not an Astra submission.
- Do not use Judge0's status IDs directly as Astra's business-level verdicts.
- Design a mapping between Judge0 statuses and Astra verdicts.
- Do not assume Judge0 will always return stdout, stderr, or compile output.
- Handle pending, processing, completed, and internal-error states.

## 5. Asynchronous Judging Queue

Design a mechanism for processing judging tasks asynchronously.

For the initial MVP, prefer a MySQL-backed queue rather than introducing Redis or BullMQ immediately.

Create a `judge_jobs` table if appropriate.

Suggested fields:
- `job_id`
- `execution_id`
- `status`
- `retry_count`
- `available_at`
- `locked_at`
- `locked_by`
- `last_error`
- `created_at`
- `updated_at`

Requirements:
- A job must be associated with an execution.
- Prevent multiple workers from processing the same job simultaneously.
- Support retries for transient failures.
- Support recovery of jobs abandoned by crashed workers.
- Add suitable indexes for retrieving pending jobs efficiently.
- Consider MySQL 8.4 transaction locking, including `SELECT ... FOR UPDATE SKIP LOCKED`, where appropriate.
- Do not store the entire source code or test-case data again inside the job table.

Document how job status transitions work.

## 6. Database Design and Integrity

Apply proper relational database design principles:

- Use appropriate primary keys and foreign keys.
- Define `ON DELETE` and `ON UPDATE` behaviors deliberately.
- Add indexes for frequently queried fields.
- Prevent duplicate language mappings where appropriate.
- Prevent duplicate test-case results for the same execution.
- Use appropriate MySQL data types.
- Use `utf8mb4`.
- Use InnoDB.
- Avoid unnecessary denormalization.
- Ensure that decimal scores and execution measurements are represented accurately.
- Use UTC for timestamps and document the convention.

Pay particular attention to:
- Foreign-key consistency.
- Query performance for submission history.
- Retrieving all test-case results for one execution.
- Retrieving pending judge jobs.
- Retrieving problems with their supported languages and sample test cases.

## 7. Security Requirements

The database design must support secure judging:

- Hidden test cases must remain private.
- Source code must not be exposed to other users unless explicitly permitted.
- Judge0 API credentials must never be stored in database tables.
- Execution limits must be controlled by the backend using problem configuration, not arbitrary frontend input.
- Do not expose internal Judge0 tokens or hidden test-case information through public endpoints.
- Do not store Judge0 credentials in source code or SQL seed files.

## 8. Implementation Deliverables

After inspecting the repository, implement the database layer.

Expected deliverables:

### A. Database schema

Create or update the appropriate SQL schema/migration files.

Include:
- Table definitions.
- Primary keys.
- Foreign keys.
- Indexes.
- Unique constraints.
- Appropriate defaults.

### B. Seed data

Create seed data for:
- A few programming languages.
- At least one sample problem.
- Multiple sample and hidden test cases.

For Judge0 language mappings:
- Do not invent language IDs.
- If actual IDs cannot be obtained from the configured Judge0 instance, use clearly marked placeholders or provide a synchronization procedure that retrieves `/languages` and populates the mappings.

### C. Database configuration

Ensure the existing Node.js backend can connect to MySQL using `mysql2`.

Requirements:
- Read credentials from environment variables.
- Support Aiven MySQL TLS configuration.
- Never commit real credentials.
- Provide or update `.env.example`.
- Use connection pooling.
- Handle connection errors appropriately.

### D. Documentation

Create a database documentation file explaining:
1. Every table and its purpose.
2. Relationships between tables.
3. Important fields and status values.
4. How the database supports Judge0.
5. How a submission moves through the judging lifecycle.
6. How to initialize the database.
7. How to run migrations and seeds.
8. How Judge0 language IDs are synchronized.

Include an updated ERD, preferably in Mermaid syntax.

### E. Validation

After implementation:
- Run migrations against a test database if available.
- Run seed scripts.
- Verify all foreign keys and indexes.
- Test representative INSERT and SELECT operations.
- Verify that a submission can be linked to an execution and multiple execution results.
- Verify that one submission can have multiple executions.
- Verify that hidden test cases are distinguishable from public samples.
- Verify that judge jobs can be safely claimed by workers.

Do not claim that something has been tested if it has not actually been executed.

## 9. Scope Restrictions

For this task, focus on the database layer and its integration readiness.

Do NOT:
- Implement the complete Judge0 API client.
- Implement the complete judging worker.
- Deploy Judge0.
- Build frontend components.
- Rewrite the entire backend.
- Introduce unnecessary architectural complexity.

You may make small backend changes required for database integration, but keep them within scope.

## 10. Final Report

When finished, provide:

1. Summary of the existing database architecture you discovered.
2. Problems or missing components identified.
3. Database architecture you implemented.
4. Tables created or modified.
5. Relationships and important design decisions.
6. Files created or modified.
7. Migration and seed commands.
8. Environment variables required.
9. Remaining tasks before integrating Judge0.
10. Any assumptions, limitations, or untested operations.

**Quality expectation:** Treat this as a real backend database for a production-oriented Online Judge platform, not a temporary classroom prototype. However, keep the implementation maintainable and appropriately scoped for an MVP.

<<<END JUDGE0 DB SPEC>>>
