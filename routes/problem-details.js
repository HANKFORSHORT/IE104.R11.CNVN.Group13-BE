const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/problems/:slug
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const [rows] = await db.query(`
      SELECT
        problem_id, slug, title, description, input_format,
        output_format, constraints_text, source, difficulty,
        difficulty_rating, time_limit_ms, memory_limit_mb, checker_type
      FROM problems
      WHERE slug = ? AND visibility = 'public'
    `, [slug]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài toán' });
    }

    const problem = rows[0];
    const [tags] = await db.query(`
      SELECT t.slug, t.name
      FROM tags t
      JOIN problem_tags pt ON t.tag_id = pt.tag_id
      WHERE pt.problem_id = ?
    `, [problem.problem_id]);

    const [languages] = await db.query(`
      SELECT pl.language_id, pl.name, pl.slug, pl.compiler_version
      FROM programming_languages pl
      JOIN problem_languages prl ON pl.language_id = prl.language_id
      WHERE prl.problem_id = ?
    `, [problem.problem_id]);

    const [samples] = await db.query(`
      SELECT test_case_id, input_data, expected_output, display_order
      FROM test_cases
      WHERE problem_id = ? AND is_sample = 1
      ORDER BY display_order ASC
    `, [problem.problem_id]);

    const [editorials] = await db.query(`
      SELECT body, published_at
      FROM editorials
      WHERE problem_id = ? AND published_at <= UTC_TIMESTAMP(3)
    `, [problem.problem_id]);

    res.json({
      success: true,
      data: {
        ...problem,
        tags,
        languages,
        samples,
        editorial: editorials[0] || null
      }
    });
  } catch (err) {
    console.error('Lỗi lấy chi tiết bài toán:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
