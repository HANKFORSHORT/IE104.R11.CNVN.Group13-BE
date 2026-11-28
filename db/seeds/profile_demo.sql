-- Local/demo data only. NEVER run against production.
-- All identities and emails are fictional; example.invalid cannot receive mail.
-- Password-account hashes come from random undisclosed passwords, so these records
-- are view-only examples. The OAuth identities below use demo: prefixes and cannot
-- be returned by real Google or Facebook. Solved/submission counts remain zero until
-- actual submissions are added. Ratings are illustrative demo values.
START TRANSACTION;

INSERT INTO users
  (handle, email, password_hash, display_name, bio, country_code, region,
   status, rating, max_rating)
VALUES
  ('demo_minh', 'demo-minh@example.invalid', '$2b$12$nLRbMnJflyXGZP2t9unvo.9rgwDUyaOMHd5eENvcDQhovqevKbReS', 'Minh Tran', 'Solves graph problems after class.', 'VN', 'apac', 'active', 1420, 1560),
  ('demo_lan', 'demo-lan@example.invalid', '$2b$12$nUosWySpay8M87bye1W/pOXCn0yqG56IdAiUQV8q3DamRsL5ym4s.', 'Lan Pham', 'Enjoys dynamic programming and good test cases.', 'VN', 'apac', 'active', 1280, 1390),
  ('demo_khang', 'demo-khang@example.invalid', '$2b$12$mcs5TC3wTuUSlB4kFn6vSeO7Rc0Lb3oz2CdyTz/Qg9nR6VvyWGVyy', 'Khang Le', 'Practices algorithms with friends on weekends.', 'VN', 'apac', 'active', 1670, 1740),
  ('demo_sora', 'demo-sora@example.invalid', NULL, 'Sora Tanaka', 'Learning to write clearer solutions.', 'JP', 'apac', 'active', 1180, 1250),
  ('demo_minseo', 'demo-minseo@example.invalid', NULL, 'Minseo Kim', 'Likes puzzles, strings, and careful proofs.', 'KR', 'apac', 'active', 1530, 1600),
  ('demo_amelia', 'demo-amelia@example.invalid', '$2b$12$6hWuzWy.Tsu1O5V7jcDfQ./NmOyIGo0jDbkESGqn.YiZOI/0qh9LC', 'Amelia Stone', 'New to contests and building consistency.', 'GB', 'europe', 'active', 980, 1050),
  ('demo_pawel', 'demo-pawel@example.invalid', '$2b$12$p5PzRXFI4xBrlFnYTa6riu3kzv3NFd1NRHUvIOnlgC4e6nxESKHL.', 'Pawel Nowak', 'Explores number theory one problem at a time.', 'PL', 'europe', 'active', 1340, 1470),
  ('demo_rafael', 'demo-rafael@example.invalid', '$2b$12$d/LTkrDJuZFe5d/QlaCxm.VKuiJRZOh6GE0oiSidx6bIX4/bdB.7G', 'Rafael Costa', 'Enjoys fast implementations and clean code.', 'BR', 'americas', 'active', 1760, 1810),
  ('demo_arjun', 'demo-arjun@example.invalid', '$2b$12$JAEqnr.xu0kCBgF39qMzPOp8KDUEuAjLbLXFjWZTNtN9dz8hyZC5m', 'Arjun Rao', 'Practices data structures every day.', 'IN', 'apac', 'active', 1610, 1690),
  ('demo_zoe', 'demo-zoe@example.invalid', '$2b$12$qUc/stzAhJ1lWU6oOZ1I1OfM1IXvyuEVC/Sdydl/3rPOpYUgeyOPW', 'Zoe Martin', 'A curious beginner with a notebook of ideas.', 'FR', 'europe', 'active', 1040, 1100)
ON DUPLICATE KEY UPDATE user_id = users.user_id;

INSERT INTO user_settings (user_id)
SELECT u.user_id FROM users AS u
WHERE (u.handle, u.email) IN (
  ('demo_minh', 'demo-minh@example.invalid'),
  ('demo_lan', 'demo-lan@example.invalid'),
  ('demo_khang', 'demo-khang@example.invalid'),
  ('demo_sora', 'demo-sora@example.invalid'),
  ('demo_minseo', 'demo-minseo@example.invalid'),
  ('demo_amelia', 'demo-amelia@example.invalid'),
  ('demo_pawel', 'demo-pawel@example.invalid'),
  ('demo_rafael', 'demo-rafael@example.invalid'),
  ('demo_arjun', 'demo-arjun@example.invalid'),
  ('demo_zoe', 'demo-zoe@example.invalid')
)
ON DUPLICATE KEY UPDATE user_id = user_settings.user_id;

INSERT INTO oauth_accounts (user_id, provider, provider_user_id)
SELECT u.user_id, 'google', 'demo:google:sora'
FROM users AS u WHERE u.handle = 'demo_sora' AND u.email = 'demo-sora@example.invalid'
ON DUPLICATE KEY UPDATE oauth_account_id = oauth_accounts.oauth_account_id;

INSERT INTO oauth_accounts (user_id, provider, provider_user_id)
SELECT u.user_id, 'facebook', 'demo:facebook:sora'
FROM users AS u WHERE u.handle = 'demo_sora' AND u.email = 'demo-sora@example.invalid'
ON DUPLICATE KEY UPDATE oauth_account_id = oauth_accounts.oauth_account_id;

INSERT INTO oauth_accounts (user_id, provider, provider_user_id)
SELECT u.user_id, 'google', 'demo:google:minseo'
FROM users AS u WHERE u.handle = 'demo_minseo' AND u.email = 'demo-minseo@example.invalid'
ON DUPLICATE KEY UPDATE oauth_account_id = oauth_accounts.oauth_account_id;

COMMIT;
