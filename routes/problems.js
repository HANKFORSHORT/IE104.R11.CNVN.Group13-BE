const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Lấy danh sách tất cả bài toán public
// GET /api/problems
router.get('/', async (req, res) => {
  try {
    const [problems] = await db.query(`
      SELECT 
        p.problem_id, p.slug, p.title, p.difficulty, 
        p.difficulty_rating, p.source
      FROM problems p
      WHERE p.visibility = 'public' AND p.is_active = TRUE
      ORDER BY p.problem_id ASC
    `);

    // Lấy tags cho từng bài toán
    for (let prob of problems) {
      const [tags] = await db.query(`
        SELECT t.slug, t.name 
        FROM tags t
        JOIN problem_tags pt ON t.tag_id = pt.tag_id
        WHERE pt.problem_id = ?
      `, [prob.problem_id]);
      prob.tags = tags;
    }

    res.json({ success: true, data: problems });
  } catch (err) {
    console.error('Lỗi lấy danh sách bài toán:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// 2. Lấy chi tiết một bài toán theo slug (VD: /api/problems/a-plus-b)
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // Lấy thông tin cơ bản của bài toán
    const [rows] = await db.query(`
      SELECT 
        problem_id, slug, title, description, input_format, 
        output_format, constraints_text, source, difficulty, 
        difficulty_rating, time_limit_ms, memory_limit_mb, checker_type
      FROM problems
      WHERE slug = ? AND visibility = 'public' AND is_active = TRUE
    `, [slug]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài toán' });
    }

    const problem = rows[0];

    // Lấy tags
    const [tags] = await db.query(`
      SELECT t.slug, t.name 
      FROM tags t
      JOIN problem_tags pt ON t.tag_id = pt.tag_id
      WHERE pt.problem_id = ?
    `, [problem.problem_id]);

    // Lấy ngôn ngữ lập trình được phép nộp
    const [languages] = await db.query(`
      SELECT pl.language_id, pl.name, pl.slug, pl.compiler_version
      FROM programming_languages pl
      JOIN problem_languages prl ON pl.language_id = prl.language_id
      WHERE prl.problem_id = ?
    `, [problem.problem_id]);

    // Chỉ lấy Sample test cases (is_sample = 1) để hiển thị cho người dùng
    const [samples] = await db.query(`
      SELECT test_case_id, input_data, expected_output, display_order
      FROM test_cases
      WHERE problem_id = ? AND is_sample = 1
      ORDER BY display_order ASC
    `, [problem.problem_id]);

    // Lấy lời giải (editorial) nếu đã đến thời gian publish
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