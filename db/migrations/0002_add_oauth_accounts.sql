-- Phase 1 identity extension. Requires 0001_initial_schema.sql.
-- Existing users keep their IDs, handles, emails, and profile data.
-- A null password_hash is permitted for accounts authenticated only through OAuth.
ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS oauth_accounts (
  oauth_account_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  provider ENUM('google','facebook') NOT NULL,
  provider_user_id VARCHAR(255) COLLATE utf8mb4_0900_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_oauth_provider_identity (provider, provider_user_id),
  UNIQUE KEY uq_oauth_user_provider (user_id, provider),
  CONSTRAINT fk_oauth_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT chk_oauth_provider_user_id CHECK (CHAR_LENGTH(provider_user_id) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
