-- Fictional development accounts. Apply 0002_add_oauth_accounts.sql first.
-- NEVER run against production.
-- Public profiles look like ordinary users; emails use reserved example.invalid.
-- Password-account hashes come from random undisclosed passwords, so these records
-- are view-only examples. The OAuth identities below use fixture: prefixes and cannot
-- be returned by real Google or Facebook. Solved/submission counts remain zero until
-- actual submissions are added. Ratings are illustrative sample values.
START TRANSACTION;

-- Preserve IDs and related rows if the earlier fixture was already loaded.
UPDATE users SET handle = 'minhtran', email = 'minhtran@example.invalid' WHERE handle = 'demo_minh' AND email = 'demo-minh@example.invalid';
UPDATE users SET handle = 'lanpham', email = 'lanpham@example.invalid' WHERE handle = 'demo_lan' AND email = 'demo-lan@example.invalid';
UPDATE users SET handle = 'khangle', email = 'khangle@example.invalid' WHERE handle = 'demo_khang' AND email = 'demo-khang@example.invalid';
UPDATE users SET handle = 'sora_t', email = 'sora_t@example.invalid' WHERE handle = 'demo_sora' AND email = 'demo-sora@example.invalid';
UPDATE users SET handle = 'minseo_k', email = 'minseo_k@example.invalid' WHERE handle = 'demo_minseo' AND email = 'demo-minseo@example.invalid';
UPDATE users SET handle = 'amelia_s', email = 'amelia_s@example.invalid' WHERE handle = 'demo_amelia' AND email = 'demo-amelia@example.invalid';
UPDATE users SET handle = 'pawel_n', email = 'pawel_n@example.invalid' WHERE handle = 'demo_pawel' AND email = 'demo-pawel@example.invalid';
UPDATE users SET handle = 'rafael_c', email = 'rafael_c@example.invalid' WHERE handle = 'demo_rafael' AND email = 'demo-rafael@example.invalid';
UPDATE users SET handle = 'arjun_rao', email = 'arjun_rao@example.invalid' WHERE handle = 'demo_arjun' AND email = 'demo-arjun@example.invalid';
UPDATE users SET handle = 'zoe_m', email = 'zoe_m@example.invalid' WHERE handle = 'demo_zoe' AND email = 'demo-zoe@example.invalid';
UPDATE oauth_accounts SET provider_user_id = 'fixture:google:sora' WHERE provider = 'google' AND provider_user_id = 'demo:google:sora';
UPDATE oauth_accounts SET provider_user_id = 'fixture:facebook:sora' WHERE provider = 'facebook' AND provider_user_id = 'demo:facebook:sora';
UPDATE oauth_accounts SET provider_user_id = 'fixture:google:minseo' WHERE provider = 'google' AND provider_user_id = 'demo:google:minseo';

INSERT INTO users
  (handle, email, password_hash, display_name, bio, country_code, region,
   status, rating, max_rating)
VALUES
  ('minhtran', 'minhtran@example.invalid', '$2b$12$nLRbMnJflyXGZP2t9unvo.9rgwDUyaOMHd5eENvcDQhovqevKbReS', 'Minh Tran', 'Solves graph problems after class.', 'VN', 'apac', 'active', 1420, 1560),
  ('lanpham', 'lanpham@example.invalid', '$2b$12$nUosWySpay8M87bye1W/pOXCn0yqG56IdAiUQV8q3DamRsL5ym4s.', 'Lan Pham', 'Enjoys dynamic programming and good test cases.', 'VN', 'apac', 'active', 1280, 1390),
  ('khangle', 'khangle@example.invalid', '$2b$12$mcs5TC3wTuUSlB4kFn6vSeO7Rc0Lb3oz2CdyTz/Qg9nR6VvyWGVyy', 'Khang Le', 'Practices algorithms with friends on weekends.', 'VN', 'apac', 'active', 1670, 1740),
  ('sora_t', 'sora_t@example.invalid', NULL, 'Sora Tanaka', 'Learning to write clearer solutions.', 'JP', 'apac', 'active', 1180, 1250),
  ('minseo_k', 'minseo_k@example.invalid', NULL, 'Minseo Kim', 'Likes puzzles, strings, and careful proofs.', 'KR', 'apac', 'active', 1530, 1600),
  ('amelia_s', 'amelia_s@example.invalid', '$2b$12$6hWuzWy.Tsu1O5V7jcDfQ./NmOyIGo0jDbkESGqn.YiZOI/0qh9LC', 'Amelia Stone', 'New to contests and building consistency.', 'GB', 'europe', 'active', 980, 1050),
  ('pawel_n', 'pawel_n@example.invalid', '$2b$12$p5PzRXFI4xBrlFnYTa6riu3kzv3NFd1NRHUvIOnlgC4e6nxESKHL.', 'Pawel Nowak', 'Explores number theory one problem at a time.', 'PL', 'europe', 'active', 1340, 1470),
  ('rafael_c', 'rafael_c@example.invalid', '$2b$12$d/LTkrDJuZFe5d/QlaCxm.VKuiJRZOh6GE0oiSidx6bIX4/bdB.7G', 'Rafael Costa', 'Enjoys fast implementations and clean code.', 'BR', 'americas', 'active', 1760, 1810),
  ('arjun_rao', 'arjun_rao@example.invalid', '$2b$12$JAEqnr.xu0kCBgF39qMzPOp8KDUEuAjLbLXFjWZTNtN9dz8hyZC5m', 'Arjun Rao', 'Practices data structures every day.', 'IN', 'apac', 'active', 1610, 1690),
  ('zoe_m', 'zoe_m@example.invalid', '$2b$12$qUc/stzAhJ1lWU6oOZ1I1OfM1IXvyuEVC/Sdydl/3rPOpYUgeyOPW', 'Zoe Martin', 'A curious beginner with a notebook of ideas.', 'FR', 'europe', 'active', 1040, 1100)
ON DUPLICATE KEY UPDATE user_id = users.user_id;

INSERT INTO user_settings (user_id)
SELECT u.user_id FROM users AS u
WHERE (u.handle, u.email) IN (
  ('minhtran', 'minhtran@example.invalid'),
  ('lanpham', 'lanpham@example.invalid'),
  ('khangle', 'khangle@example.invalid'),
  ('sora_t', 'sora_t@example.invalid'),
  ('minseo_k', 'minseo_k@example.invalid'),
  ('amelia_s', 'amelia_s@example.invalid'),
  ('pawel_n', 'pawel_n@example.invalid'),
  ('rafael_c', 'rafael_c@example.invalid'),
  ('arjun_rao', 'arjun_rao@example.invalid'),
  ('zoe_m', 'zoe_m@example.invalid')
)
ON DUPLICATE KEY UPDATE user_id = user_settings.user_id;

INSERT INTO oauth_accounts (user_id, provider, provider_user_id)
SELECT u.user_id, 'google', 'fixture:google:sora'
FROM users AS u WHERE u.handle = 'sora_t' AND u.email = 'sora_t@example.invalid'
ON DUPLICATE KEY UPDATE oauth_account_id = oauth_accounts.oauth_account_id;

INSERT INTO oauth_accounts (user_id, provider, provider_user_id)
SELECT u.user_id, 'facebook', 'fixture:facebook:sora'
FROM users AS u WHERE u.handle = 'sora_t' AND u.email = 'sora_t@example.invalid'
ON DUPLICATE KEY UPDATE oauth_account_id = oauth_accounts.oauth_account_id;

INSERT INTO oauth_accounts (user_id, provider, provider_user_id)
SELECT u.user_id, 'google', 'fixture:google:minseo'
FROM users AS u WHERE u.handle = 'minseo_k' AND u.email = 'minseo_k@example.invalid'
ON DUPLICATE KEY UPDATE oauth_account_id = oauth_accounts.oauth_account_id;

COMMIT;
