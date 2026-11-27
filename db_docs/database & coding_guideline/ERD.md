# Astra database ERD

All tables are in the diagrams below. The migration runner also creates `schema_migrations(migration_name PK, checksum_sha256, applied_at)`. Public read views are `v_public_sample_tests` and `v_public_editorials`.

The diagrams show primary and foreign keys; see [DATABASE.md](DATABASE.md) and the migration for all fields and constraints.

## Identity and content

```mermaid
erDiagram
  schema_migrations {
    VARCHAR migration_name PK
  }
  users {
    BIGINT user_id PK
    VARCHAR handle UK
    VARCHAR email UK
    ENUM status
  }
  programming_languages {
    INT language_id PK
    VARCHAR slug UK
  }
  user_settings {
    BIGINT user_id PK,FK
    INT default_language_id FK
  }
  auth_sessions {
    BIGINT session_id PK
    BIGINT user_id FK
  }
  password_reset_tokens {
    BIGINT password_reset_token_id PK
    BIGINT user_id FK
  }
  email_verification_tokens {
    BIGINT email_verification_token_id PK
    BIGINT user_id FK
  }
  user_follows {
    BIGINT follower_id PK,FK
    BIGINT followee_id PK,FK
  }
  language_engine_mappings {
    INT language_engine_mapping_id PK
    INT language_id FK
  }
  problems {
    BIGINT problem_id PK
    VARCHAR slug UK
    ENUM visibility
    BIGINT author_id FK
  }
  tags {
    INT tag_id PK
    VARCHAR slug UK
  }
  problem_tags {
    BIGINT problem_id PK,FK
    INT tag_id PK,FK
  }
  problem_languages {
    BIGINT problem_id PK,FK
    INT language_id PK,FK
  }
  test_groups {
    BIGINT test_group_id PK
    BIGINT problem_id FK
  }
  test_cases {
    BIGINT test_case_id PK
    BIGINT problem_id FK
    BIGINT test_group_id FK
  }
  editorials {
    BIGINT editorial_id PK
    BIGINT problem_id FK,UK
    BIGINT author_id FK
  }
  users ||--o| user_settings : user_id
  programming_languages ||--o{ user_settings : default_language_id
  users ||--o{ auth_sessions : user_id
  users ||--o{ password_reset_tokens : user_id
  users ||--o{ email_verification_tokens : user_id
  users ||--o{ user_follows : follower_id
  users ||--o{ user_follows : followee_id
  programming_languages ||--o{ language_engine_mappings : language_id
  users ||--o{ problems : author_id
  problems ||--o{ problem_tags : problem_id
  tags ||--o{ problem_tags : tag_id
  problems ||--o{ problem_languages : problem_id
  programming_languages ||--o{ problem_languages : language_id
  problems ||--o{ test_groups : problem_id
  problems ||--o{ test_cases : problem_id
  test_groups ||--o{ test_cases : problem_id_test_group_id
  problems ||--o| editorials : problem_id
  users ||--o{ editorials : author_id
```

## Contests and judging

```mermaid
erDiagram
  users {
    BIGINT user_id PK
    VARCHAR handle UK
    VARCHAR email UK
    ENUM status
  }
  programming_languages {
    INT language_id PK
    VARCHAR slug UK
  }
  problems {
    BIGINT problem_id PK
    VARCHAR slug UK
    ENUM visibility
    BIGINT author_id FK
  }
  test_cases {
    BIGINT test_case_id PK
    BIGINT problem_id FK
    BIGINT test_group_id FK
  }
  contests {
    BIGINT contest_id PK
    VARCHAR slug UK
    ENUM visibility
  }
  contest_rounds {
    BIGINT contest_round_id PK
    BIGINT contest_id FK
    VARCHAR slug UK
    ENUM type
    ENUM status
  }
  round_problems {
    BIGINT contest_round_id PK,FK
    BIGINT problem_id PK,FK
  }
  contest_registrations {
    BIGINT contest_registration_id PK
    BIGINT contest_id FK
    BIGINT user_id FK
    ENUM status
  }
  round_participations {
    BIGINT round_participation_id PK
    BIGINT contest_round_id FK
    BIGINT user_id FK
    ENUM status
  }
  submissions {
    BIGINT submission_id PK
    BIGINT user_id FK
    BIGINT problem_id FK
    INT language_id FK
    BIGINT contest_round_id FK
    BIGINT round_participation_id FK
    ENUM status
    ENUM verdict
  }
  executions {
    BIGINT execution_id PK
    BIGINT submission_id FK
    ENUM status
    ENUM verdict
  }
  execution_results {
    BIGINT execution_result_id PK
    BIGINT execution_id FK
    BIGINT test_case_id FK
    INT engine_status_id
    ENUM verdict
  }
  judge_jobs {
    BIGINT job_id PK
    BIGINT execution_id FK,UK
    ENUM status
  }
  users ||--o{ problems : author_id
  problems ||--o{ test_cases : problem_id
  users ||--o{ contests : created_by
  contests ||--o{ contest_rounds : contest_id
  contest_rounds ||--o{ round_problems : contest_round_id
  problems ||--o{ round_problems : problem_id
  contests ||--o{ contest_registrations : contest_id
  users ||--o{ contest_registrations : user_id
  contest_rounds ||--o{ round_participations : contest_round_id
  users ||--o{ round_participations : user_id
  users ||--o{ submissions : user_id
  problems ||--o{ submissions : problem_id
  programming_languages ||--o{ submissions : language_id
  contest_rounds ||--o{ submissions : contest_round_id
  round_participations ||--o{ submissions : contest_round_id_round_participation_id
  submissions ||--o{ executions : submission_id
  users ||--o{ executions : requested_by
  executions ||--o{ execution_results : execution_id
  test_cases ||--o{ execution_results : test_case_id
  executions ||--o{ judge_jobs : execution_id
```

## Engagement and support

```mermaid
erDiagram
  users {
    BIGINT user_id PK
    VARCHAR handle UK
    VARCHAR email UK
    ENUM status
  }
  problems {
    BIGINT problem_id PK
    VARCHAR slug UK
    ENUM visibility
    BIGINT author_id FK
  }
  submissions {
    BIGINT submission_id PK
    BIGINT user_id FK
    BIGINT problem_id FK
    INT language_id FK
    BIGINT contest_round_id FK
    BIGINT round_participation_id FK
    ENUM status
    ENUM verdict
  }
  contest_rounds {
    BIGINT contest_round_id PK
    BIGINT contest_id FK
    VARCHAR slug UK
    ENUM type
    ENUM status
  }
  solution_posts {
    BIGINT solution_post_id PK
    BIGINT problem_id FK
    BIGINT user_id FK
    BIGINT submission_id FK
    ENUM visibility
  }
  solution_votes {
    BIGINT solution_post_id PK,FK
    BIGINT user_id PK,FK
  }
  rating_changes {
    BIGINT rating_change_id PK
    BIGINT user_id FK
    BIGINT contest_round_id FK
  }
  notifications {
    BIGINT notification_id PK
    BIGINT user_id FK
    ENUM type
  }
  achievements {
    INT achievement_id PK
    VARCHAR code UK
  }
  user_achievements {
    BIGINT user_achievement_id PK
    BIGINT user_id FK
    INT achievement_id FK
    BIGINT evidence_submission_id FK
    BIGINT evidence_problem_id FK
  }
  user_problem_stats {
    BIGINT user_id PK,FK
    BIGINT problem_id PK,FK
  }
  contact_messages {
    BIGINT contact_message_id PK
    BIGINT user_id FK
    VARCHAR email
    ENUM status
  }
  issue_reports {
    BIGINT issue_report_id PK
    BIGINT user_id FK
    VARCHAR email
    ENUM status
  }
  users ||--o{ problems : author_id
  users ||--o{ submissions : user_id
  problems ||--o{ submissions : problem_id
  contest_rounds ||--o{ submissions : contest_round_id
  problems ||--o{ solution_posts : problem_id
  users ||--o{ solution_posts : user_id
  submissions ||--o{ solution_posts : submission_id
  solution_posts ||--o{ solution_votes : solution_post_id
  users ||--o{ solution_votes : user_id
  users ||--o{ rating_changes : user_id
  contest_rounds ||--o{ rating_changes : contest_round_id
  users ||--o{ notifications : user_id
  users ||--o{ user_achievements : user_id
  achievements ||--o{ user_achievements : achievement_id
  submissions ||--o{ user_achievements : evidence_submission_id
  problems ||--o{ user_achievements : evidence_problem_id
  users ||--o{ user_problem_stats : user_id
  problems ||--o{ user_problem_stats : problem_id
  users ||--o{ contact_messages : user_id
  users ||--o{ issue_reports : user_id
```
