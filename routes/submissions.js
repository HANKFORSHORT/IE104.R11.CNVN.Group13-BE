const express = require('express');
const router = express.Router();
const db = require('../db');
const { runTests } = require('../services/onlinecompiler');

// POST /api/submissions  { slug, compiler, code }
router.post('/', async (req, res) => {
  const { slug, compiler, code } = req.body;
  if (!slug || !compiler || !code) {
    return res.status(400).json({ success: false, message: 'Thiếu slug, compiler hoặc code' });
  }
  if (Buffer.byteLength(code, 'utf8') > 256 * 1024) {
    return res.status(413).json({ success: false, message: 'Source quá lớn' });
  }

  try {
    const [[problem]] = await db.query(
      `SELECT problem_id FROM problems WHERE slug = ? AND visibility = 'public'`, [slug]);
    if (!problem) return res.status(404).json({ success: false, message: 'Không tìm thấy bài' });

    // Lấy test từ DB của mình (giới hạn 10 test/lần gọi)
    const [cases] = await db.query(
      `SELECT input_data AS input, expected_output
       FROM test_cases WHERE problem_id = ? ORDER BY display_order LIMIT 10`,
      [problem.problem_id]);

    const result = await runTests({ compiler, code, tests: cases });

    // Chỉ trả verdict/score, không trả input/output của test ẩn
    res.json({ success: true, data: { verdict: result.verdict, score: result.score } });
  } catch (err) {
    console.error('Lỗi chấm bài:', err);
    res.status(err.status === 401 ? 502 : 500).json({ success: false, message: 'Lỗi chấm bài' });
  }
});

module.exports = router;