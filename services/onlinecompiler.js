const BASE = process.env.ONLINECOMPILER_URL || 'https://api.onlinecompiler.io';
const KEY = process.env.ONLINECOMPILER_API_KEY;

async function oc(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // TODO: kiểm tra docs. MCP chấp nhận "Authorization: Bearer <key>"
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.detail || `OnlineCompiler HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Chấm với test do mình truyền vào (verified: POST /api/run-tests/, tối đa 10 test/lần)
function runTests({ compiler, code, tests }) {
  return oc('/api/run-tests/', { compiler, code, tests });
}

// Chấm với problem đã lưu trên dashboard (test ẩn nằm bên họ)
// TODO: xác nhận đúng path + body trong docs "stored problems"
function judgeStored({ problem, compiler, code }) {
  return oc('/api/judge/', { problem, compiler, code });
}

module.exports = { runTests, judgeStored };