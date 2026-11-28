const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Danh sách bài tập: các trường dùng cho bảng Problems.
// GET /api/problems
router.get('/', async (req, res) => {
  try {
    const [problems] = await db.query(`
      SELECT
        p.problem_id AS number,
        p.slug,
        p.title AS name,
        p.difficulty,
        COALESCE(topic_data.topics, JSON_ARRAY()) AS topics,
        COALESCE(solve_data.solve_rate, 0) AS solve_rate
      FROM problems p
      LEFT JOIN (
        SELECT
          pt.problem_id,
          JSON_ARRAYAGG(JSON_OBJECT('slug', t.slug, 'name', t.name)) AS topics
        FROM problem_tags pt
        JOIN tags t ON t.tag_id = pt.tag_id
        GROUP BY pt.problem_id
      ) topic_data ON topic_data.problem_id = p.problem_id
      LEFT JOIN (
        SELECT
          problem_id,
          ROUND(
            100.0 * COUNT(DISTINCT CASE WHEN verdict = 'AC' THEN user_id END)
            / NULLIF(COUNT(DISTINCT user_id), 0),
            2
          ) AS solve_rate
        FROM submissions
        GROUP BY problem_id
      ) solve_data ON solve_data.problem_id = p.problem_id
      WHERE p.visibility = 'public'
      ORDER BY p.problem_id ASC
    `);

    res.json({ success: true, data: problems });
  } catch (err) {
    console.error('Lỗi lấy danh sách bài toán:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
