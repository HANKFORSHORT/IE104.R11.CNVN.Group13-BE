-- Initial Astra schema. Run through scripts/migrate.js with a UTC session.
CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  handle VARCHAR(40) NOT NULL UNIQUE,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100), bio TEXT, country_code CHAR(2), region VARCHAR(80), avatar_url VARCHAR(2048),
  role ENUM('user','problem_setter','admin') NOT NULL DEFAULT 'user',
  status ENUM('active','banned','unverified') NOT NULL DEFAULT 'unverified',
  rating INT NOT NULL DEFAULT 0, max_rating INT NOT NULL DEFAULT 0,
  email_verified_at DATETIME(3), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CHECK (rating >= 0 AND max_rating >= rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS programming_languages (
  language_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL, slug VARCHAR(40) NOT NULL UNIQUE, compiler_version VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  theme ENUM('system','light','dark') NOT NULL DEFAULT 'system',
  default_language_id INT UNSIGNED, is_source_public BOOLEAN NOT NULL DEFAULT FALSE,
  is_profile_public BOOLEAN NOT NULL DEFAULT TRUE, is_email_notification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_site_notification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_settings_language (default_language_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (default_language_id) REFERENCES programming_languages(language_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
  token_hash BINARY(32) NOT NULL UNIQUE, expires_at DATETIME(3) NOT NULL, revoked_at DATETIME(3),
  user_agent VARCHAR(512), ip_address VARBINARY(16), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_sessions_user_expiry (user_id, expires_at),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  password_reset_token_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
  token_hash BINARY(32) NOT NULL UNIQUE, expires_at DATETIME(3) NOT NULL, used_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_reset_user (user_id), FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  email_verification_token_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
  token_hash BINARY(32) NOT NULL UNIQUE, expires_at DATETIME(3) NOT NULL, used_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_verify_user (user_id), FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_follows (
  follower_id BIGINT UNSIGNED NOT NULL, followee_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (follower_id, followee_id), INDEX idx_followee (followee_id),
  FOREIGN KEY (follower_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (followee_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CHECK (follower_id <> followee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS language_engine_mappings (
  language_engine_mapping_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  language_id INT UNSIGNED NOT NULL, engine ENUM('judge0') NOT NULL DEFAULT 'judge0',
  engine_language_key VARCHAR(80) COLLATE utf8mb4_0900_bin NOT NULL,
  engine_version VARCHAR(100), is_active BOOLEAN NOT NULL DEFAULT TRUE,
  synced_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_engine_language (engine, language_id),
  UNIQUE KEY uq_engine_key (engine, engine_language_key),
  INDEX idx_mapping_language (language_id),
  FOREIGN KEY (language_id) REFERENCES programming_languages(language_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS problems (
  problem_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, slug VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL, description MEDIUMTEXT NOT NULL,
  input_format TEXT, output_format TEXT, constraints_text TEXT, source VARCHAR(255),
  difficulty ENUM('easy','medium','hard','expert') NOT NULL DEFAULT 'medium', difficulty_rating SMALLINT UNSIGNED,
  time_limit_ms INT UNSIGNED NOT NULL, memory_limit_mb INT UNSIGNED NOT NULL,
  checker_type ENUM('exact','ignore_trailing_whitespace','float_tolerance') NOT NULL DEFAULT 'ignore_trailing_whitespace',
  checker_epsilon DECIMAL(12,9),
  visibility ENUM('public','contest_only','hidden') NOT NULL DEFAULT 'hidden',
  author_id BIGINT UNSIGNED, is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_problem_author (author_id), INDEX idx_problem_list (visibility, is_active, difficulty_rating),
  FOREIGN KEY (author_id) REFERENCES users(user_id) ON DELETE SET NULL,
  CHECK (time_limit_ms > 0 AND memory_limit_mb > 0),
  CHECK ((checker_type = 'float_tolerance' AND checker_epsilon IS NOT NULL AND checker_epsilon > 0) OR
         (checker_type <> 'float_tolerance' AND checker_epsilon IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS tags (
  tag_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, slug VARCHAR(80) NOT NULL UNIQUE, name VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS problem_tags (
  problem_id BIGINT UNSIGNED NOT NULL, tag_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (problem_id, tag_id), INDEX idx_pt_tag (tag_id),
  FOREIGN KEY (problem_id) REFERENCES problems(problem_id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(tag_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS problem_languages (
  problem_id BIGINT UNSIGNED NOT NULL, language_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (problem_id, language_id), INDEX idx_pl_language (language_id),
  FOREIGN KEY (problem_id) REFERENCES problems(problem_id) ON DELETE CASCADE,
  FOREIGN KEY (language_id) REFERENCES programming_languages(language_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS test_groups (
  test_group_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, problem_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(80) NOT NULL, scoring_mode ENUM('sum','all_or_nothing') NOT NULL DEFAULT 'sum',
  points DECIMAL(9,2) NOT NULL, display_order INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_group_label (problem_id, label), UNIQUE KEY uq_group_problem_id (problem_id, test_group_id),
  FOREIGN KEY (problem_id) REFERENCES problems(problem_id) ON DELETE CASCADE,
  CHECK (points >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS test_cases (
  test_case_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, problem_id BIGINT UNSIGNED NOT NULL,
  test_group_id BIGINT UNSIGNED, input_data MEDIUMTEXT NOT NULL, expected_output MEDIUMTEXT NOT NULL,
  input_size_bytes INT UNSIGNED NOT NULL, output_size_bytes INT UNSIGNED NOT NULL,
  checksum_sha256 BINARY(32) NOT NULL,
  is_sample BOOLEAN NOT NULL DEFAULT FALSE, is_hidden BOOLEAN NOT NULL DEFAULT TRUE,
  score DECIMAL(9,2) NOT NULL DEFAULT 0, display_order INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_test_order (problem_id, display_order), UNIQUE KEY uq_test_problem_id (problem_id, test_case_id),
  INDEX idx_test_public (problem_id, is_sample, is_hidden, display_order),
  INDEX idx_test_group (problem_id, test_group_id),
  FOREIGN KEY (problem_id) REFERENCES problems(problem_id) ON DELETE CASCADE,
  FOREIGN KEY (problem_id, test_group_id) REFERENCES test_groups(problem_id, test_group_id) ON DELETE RESTRICT,
  CHECK (NOT (is_sample = 1 AND is_hidden = 1)), CHECK (score >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS editorials (
  editorial_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, problem_id BIGINT UNSIGNED NOT NULL UNIQUE,
  author_id BIGINT UNSIGNED, body MEDIUMTEXT NOT NULL, published_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_editorial_author (author_id),
  FOREIGN KEY (problem_id) REFERENCES problems(problem_id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS contests (
  contest_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, slug VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL, description TEXT,
  format ENUM('div1','div2','div3','edu') NOT NULL,
  is_rated BOOLEAN NOT NULL DEFAULT FALSE,
  visibility ENUM('draft','public','private') NOT NULL DEFAULT 'draft',
  registration_opens_at DATETIME(3), registration_closes_at DATETIME(3),
  created_by BIGINT UNSIGNED, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_contest_creator (created_by), INDEX idx_contest_list (visibility, registration_opens_at),
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  CHECK (registration_opens_at IS NULL OR registration_closes_at IS NULL OR registration_opens_at < registration_closes_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS contest_rounds (
  contest_round_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, contest_id BIGINT UNSIGNED,
  title VARCHAR(255) NOT NULL, slug VARCHAR(100) NOT NULL UNIQUE,
  type ENUM('contest','gym') NOT NULL, status ENUM('scheduled','live','finished','cancelled') NOT NULL DEFAULT 'scheduled',
  start_at DATETIME(3) NOT NULL, end_at DATETIME(3) NOT NULL, freeze_at DATETIME(3),
  difficulty ENUM('beginner','intermediate','advanced'), duration_minutes INT UNSIGNED,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_round_contest (contest_id), INDEX idx_round_listing (type, status, start_at),
  FOREIGN KEY (contest_id) REFERENCES contests(contest_id) ON DELETE RESTRICT,
  CHECK ((type = 'contest' AND contest_id IS NOT NULL) OR (type = 'gym' AND contest_id IS NULL)),
  CHECK (start_at < end_at), CHECK (freeze_at IS NULL OR (freeze_at >= start_at AND freeze_at <= end_at)),
  CHECK (type <> 'gym' OR (difficulty IS NOT NULL AND duration_minutes > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS round_problems (
  contest_round_id BIGINT UNSIGNED NOT NULL, problem_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(10) NOT NULL, points DECIMAL(9,2) NOT NULL, display_order INT UNSIGNED NOT NULL,
  PRIMARY KEY (contest_round_id, problem_id), UNIQUE KEY uq_round_label (contest_round_id, label),
  UNIQUE KEY uq_round_order (contest_round_id, display_order), INDEX idx_rp_problem (problem_id),
  FOREIGN KEY (contest_round_id) REFERENCES contest_rounds(contest_round_id) ON DELETE CASCADE,
  FOREIGN KEY (problem_id) REFERENCES problems(problem_id) ON DELETE RESTRICT,
  CHECK (points >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE OR REPLACE VIEW v_public_sample_tests AS
  SELECT t.test_case_id, t.problem_id, t.input_data, t.expected_output, t.display_order
  FROM test_cases t JOIN problems p ON p.problem_id = t.problem_id
  WHERE t.is_sample = 1 AND t.is_hidden = 0 AND p.visibility = 'public' AND p.is_active = 1
    AND NOT EXISTS (
      SELECT 1 FROM round_problems rp JOIN contest_rounds r ON r.contest_round_id = rp.contest_round_id
      WHERE rp.problem_id = p.problem_id AND r.type = 'contest' AND r.start_at > UTC_TIMESTAMP(3)
    );

CREATE OR REPLACE VIEW v_public_editorials AS
  SELECT e.editorial_id, e.problem_id, e.author_id, e.body, e.published_at
  FROM editorials e JOIN problems p ON p.problem_id = e.problem_id
  WHERE e.published_at IS NOT NULL AND e.published_at <= UTC_TIMESTAMP(3)
    AND p.visibility = 'public' AND p.is_active = 1
    AND NOT EXISTS (
      SELECT 1 FROM round_problems rp JOIN contest_rounds r ON r.contest_round_id = rp.contest_round_id
      WHERE rp.problem_id = p.problem_id AND r.type = 'contest' AND r.end_at > UTC_TIMESTAMP(3)
    );

CREATE TABLE IF NOT EXISTS contest_registrations (
  contest_registration_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contest_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('registered','withdrawn','disqualified') NOT NULL DEFAULT 'registered',
  registered_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_registration (contest_id, user_id), INDEX idx_registration_user (user_id),
  FOREIGN KEY (contest_id) REFERENCES contests(contest_id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS round_participations (
  round_participation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contest_round_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL,
  is_virtual BOOLEAN NOT NULL DEFAULT FALSE, started_at DATETIME(3) NOT NULL,
  ended_at DATETIME(3), status ENUM('active','finished','disqualified') NOT NULL DEFAULT 'active',
  UNIQUE KEY uq_participation_round_id (contest_round_id, round_participation_id),
  INDEX idx_participation_user (user_id), INDEX idx_participation_round_user (contest_round_id, user_id),
  FOREIGN KEY (contest_round_id) REFERENCES contest_rounds(contest_round_id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  CHECK (ended_at IS NULL OR started_at <= ended_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS submissions (
  submission_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL, problem_id BIGINT UNSIGNED NOT NULL,
  language_id INT UNSIGNED NOT NULL, contest_round_id BIGINT UNSIGNED,
  round_participation_id BIGINT UNSIGNED,
  source_code MEDIUMTEXT NOT NULL, code_size_bytes INT UNSIGNED NOT NULL,
  status ENUM('queued','processing','completed','failed') NOT NULL DEFAULT 'queued',
  verdict ENUM('AC','WA','TLE','MLE','OLE','CE','RE','IE'), score DECIMAL(9,2),
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_sub_user_time (user_id, submitted_at DESC, submission_id DESC),
  INDEX idx_sub_problem_time (problem_id, submitted_at DESC, submission_id DESC),
  INDEX idx_sub_round_standings (contest_round_id, user_id, problem_id),
  INDEX idx_sub_participation (contest_round_id, round_participation_id),
  INDEX idx_sub_language (language_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (problem_id) REFERENCES problems(problem_id) ON DELETE RESTRICT,
  FOREIGN KEY (language_id) REFERENCES programming_languages(language_id) ON DELETE RESTRICT,
  FOREIGN KEY (contest_round_id) REFERENCES contest_rounds(contest_round_id) ON DELETE RESTRICT,
  FOREIGN KEY (contest_round_id, round_participation_id) REFERENCES round_participations(contest_round_id, round_participation_id) ON DELETE RESTRICT,
  CHECK (round_participation_id IS NULL OR contest_round_id IS NOT NULL), CHECK (code_size_bytes <= 262144),
  CHECK (score IS NULL OR score >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS executions (
  execution_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, submission_id BIGINT UNSIGNED NOT NULL,
  status ENUM('queued','processing','completed','failed') NOT NULL DEFAULT 'queued',
  verdict ENUM('AC','WA','TLE','MLE','OLE','CE','RE','IE'),
  total_score DECIMAL(9,2), max_score DECIMAL(9,2),
  total_execution_time_ms BIGINT UNSIGNED, peak_memory_kb BIGINT UNSIGNED,
  `trigger` ENUM('initial','rejudge') NOT NULL, requested_by BIGINT UNSIGNED,
  started_at DATETIME(3), completed_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_exec_submission (submission_id, execution_id DESC), INDEX idx_exec_requester (requested_by),
  FOREIGN KEY (submission_id) REFERENCES submissions(submission_id) ON DELETE RESTRICT,
  FOREIGN KEY (requested_by) REFERENCES users(user_id) ON DELETE SET NULL,
  CHECK (total_score IS NULL OR total_score >= 0), CHECK (max_score IS NULL OR max_score >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS execution_results (
  execution_result_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  execution_id BIGINT UNSIGNED NOT NULL, test_case_id BIGINT UNSIGNED NOT NULL,
  engine ENUM('judge0') NOT NULL DEFAULT 'judge0',
  external_token VARCHAR(128) COLLATE utf8mb4_0900_bin,
  engine_status_id INT, engine_status_description VARCHAR(255),
  verdict ENUM('AC','WA','TLE','MLE','OLE','CE','RE','IE'),
  actual_output TEXT, stderr TEXT, compile_output TEXT, is_output_truncated BOOLEAN NOT NULL DEFAULT FALSE,
  exit_code INT, execution_time_ms BIGINT UNSIGNED, memory_kb BIGINT UNSIGNED,
  score DECIMAL(9,2), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_result_case (execution_id, test_case_id), UNIQUE KEY uq_external_token (engine, external_token),
  INDEX idx_result_test (test_case_id),
  FOREIGN KEY (execution_id) REFERENCES executions(execution_id) ON DELETE RESTRICT,
  FOREIGN KEY (test_case_id) REFERENCES test_cases(test_case_id) ON DELETE RESTRICT,
  CHECK (score IS NULL OR score >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS judge_jobs (
  job_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, execution_id BIGINT UNSIGNED NOT NULL UNIQUE,
  status ENUM('pending','claimed','completed','failed') NOT NULL DEFAULT 'pending',
  retry_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  locked_at DATETIME(3), locked_by VARCHAR(100), last_error VARCHAR(1000),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_job_pending (status, available_at, job_id),
  INDEX idx_job_lease (status, locked_at),
  FOREIGN KEY (execution_id) REFERENCES executions(execution_id) ON DELETE RESTRICT,
  CHECK (retry_count <= 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS solution_posts (
  solution_post_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  problem_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, submission_id BIGINT UNSIGNED,
  body MEDIUMTEXT NOT NULL, visibility ENUM('public','unlisted','hidden') NOT NULL DEFAULT 'public',
  vote_count INT NOT NULL DEFAULT 0, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_solution_problem (problem_id, visibility, created_at), INDEX idx_solution_user (user_id),
  INDEX idx_solution_submission (submission_id),
  FOREIGN KEY (problem_id) REFERENCES problems(problem_id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (submission_id) REFERENCES submissions(submission_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS solution_votes (
  solution_post_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, value TINYINT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (solution_post_id, user_id), INDEX idx_vote_user (user_id),
  FOREIGN KEY (solution_post_id) REFERENCES solution_posts(solution_post_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CHECK (value IN (-1,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS rating_changes (
  rating_change_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL, contest_round_id BIGINT UNSIGNED NOT NULL,
  old_rating INT NOT NULL, new_rating INT NOT NULL, delta INT NOT NULL, rank_position INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_rating_round_user (contest_round_id, user_id),
  INDEX idx_rating_user_time (user_id, created_at DESC),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (contest_round_id) REFERENCES contest_rounds(contest_round_id) ON DELETE RESTRICT,
  CHECK (new_rating = old_rating + delta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS notifications (
  notification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
  type ENUM('contest','submission','achievement','system','social') NOT NULL,
  title VARCHAR(255) NOT NULL, body TEXT NOT NULL, link_path VARCHAR(512),
  read_at DATETIME(3), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_notifications_unread (user_id, read_at, created_at DESC),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  CHECK (link_path IS NULL OR REGEXP_LIKE(link_path, '^[A-Za-z0-9_-]+[.]html([?#][A-Za-z0-9_=&%.-]*)?$'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS achievements (
  achievement_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL, description TEXT NOT NULL, requirement TEXT NOT NULL,
  image_path VARCHAR(512), is_active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS user_achievements (
  user_achievement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL, achievement_id INT UNSIGNED NOT NULL,
  evidence_submission_id BIGINT UNSIGNED, evidence_problem_id BIGINT UNSIGNED,
  earned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_user_achievement (user_id, achievement_id),
  INDEX idx_ua_achievement (achievement_id), INDEX idx_ua_submission (evidence_submission_id),
  INDEX idx_ua_problem (evidence_problem_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (achievement_id) REFERENCES achievements(achievement_id) ON DELETE RESTRICT,
  FOREIGN KEY (evidence_submission_id) REFERENCES submissions(submission_id) ON DELETE SET NULL,
  FOREIGN KEY (evidence_problem_id) REFERENCES problems(problem_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS user_problem_stats (
  user_id BIGINT UNSIGNED NOT NULL, problem_id BIGINT UNSIGNED NOT NULL,
  best_score DECIMAL(9,2) NOT NULL DEFAULT 0, first_ac_at DATETIME(3), attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, problem_id), INDEX idx_stats_problem (problem_id), INDEX idx_stats_solved (user_id, first_ac_at),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (problem_id) REFERENCES problems(problem_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS contact_messages (
  contact_message_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED,
  email VARCHAR(254) NOT NULL, category VARCHAR(80) NOT NULL, body TEXT NOT NULL,
  status ENUM('open','triaged','closed') NOT NULL DEFAULT 'open',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_contact_user (user_id), INDEX idx_contact_status (status, created_at),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS issue_reports (
  issue_report_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED,
  email VARCHAR(254) NOT NULL, category VARCHAR(80) NOT NULL, page_path VARCHAR(512), body TEXT NOT NULL,
  status ENUM('open','triaged','closed') NOT NULL DEFAULT 'open',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_issue_user (user_id), INDEX idx_issue_status (status, created_at),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
