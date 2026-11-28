const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
const problemsRouter = require('./routes/problems');
const problemDetailsRouter = require('./routes/problem-details');
const submissionsRouter = require('./routes/submissions');
const profilesRouter = require('./routes/profiles');
const config = require('./src/config');
const authRouter = require('./src/routes/auth');
const profileRouter = require('./src/routes/profiles');
const requireAllowedOrigin = require('./src/middlewares/origin');
const errorHandler = require('./src/middlewares/error-handler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || config.frontendOrigins.has(origin));
  },
  credentials: true
}));
app.use(express.json({ limit: '16kb' }));
app.use('/api/v1', requireAllowedOrigin);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1', profileRouter);

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 AS ok');
    res.json({
      status: 'ok',
      database: rows[0].ok === 1 ? 'connected' : 'error',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Health check failed:', err.message);
    res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

app.use('/api/problems', problemsRouter);
app.use('/api/problems', problemDetailsRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/profiles', profilesRouter);
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
  });
}
module.exports = app;

