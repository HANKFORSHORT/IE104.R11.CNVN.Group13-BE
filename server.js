const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
const problemsRouter = require('./routes/problems');
const profilesRouter = require('./routes/profiles');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
app.use('/api/profiles', profilesRouter);

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});