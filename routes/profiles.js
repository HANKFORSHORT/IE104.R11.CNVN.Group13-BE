const express = require('express');
const db = require('../db');

const router = express.Router();

// Public profile data only. The browser's local session is not server authentication.
router.get('/:handle', async (req, res) => {
  const handle = req.params.handle;
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(handle)) {
    return res.status(404).json({ success: false, message: 'Profile not found' });
  }

  try {
    const [users] = await db.query(`
      SELECT u.user_id, u.handle, u.display_name, u.bio, u.country_code,
             u.region, u.avatar_url, u.rating, u.max_rating
      FROM users u
      LEFT JOIN user_settings s ON s.user_id = u.user_id
      WHERE u.handle = ? AND u.status = 'active'
        AND COALESCE(s.is_profile_public, TRUE) = TRUE
      LIMIT 1
    `, [handle]);

    if (!users.length) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const user = users[0];
    const [[solvedRows], [totalRows], [activityRows], [achievementRows]] = await Promise.all([
      db.query(`
        SELECT COUNT(*) AS solved
        FROM user_problem_stats
        WHERE user_id = ? AND first_ac_at IS NOT NULL
      `, [user.user_id]),
      db.query('SELECT COUNT(*) AS total FROM submissions WHERE user_id = ?', [user.user_id]),
      db.query(`
        SELECT DATE_FORMAT(submitted_at, '%Y-%m-%d') AS day, COUNT(*) AS count
        FROM submissions
        WHERE user_id = ? AND submitted_at >= UTC_DATE() - INTERVAL 1 YEAR
        GROUP BY DATE_FORMAT(submitted_at, '%Y-%m-%d')
        ORDER BY day
      `, [user.user_id]),
      db.query(`
        SELECT a.code, a.name, a.image_path, ua.earned_at
        FROM user_achievements ua
        JOIN achievements a ON a.achievement_id = ua.achievement_id
        WHERE ua.user_id = ? AND a.is_active = TRUE
        ORDER BY ua.earned_at DESC
      `, [user.user_id])
    ]);

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: {
        handle: user.handle,
        displayName: user.display_name,
        bio: user.bio,
        countryCode: user.country_code,
        region: user.region,
        avatarUrl: user.avatar_url,
        rating: Number(user.rating),
        maxRating: Number(user.max_rating),
        solved: Number(solvedRows[0].solved),
        submissionsTotal: Number(totalRows[0].total),
        activity: activityRows.map((row) => ({ day: row.day, count: Number(row.count) })),
        achievements: achievementRows.map((row) => ({
          code: row.code, name: row.name, imagePath: row.image_path, earnedAt: row.earned_at
        }))
      }
    });
  } catch (error) {
    console.error('Profile lookup failed:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
