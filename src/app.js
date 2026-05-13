const express = require('express');
const cors = require('cors');
const personalColorRouter = require('./routes/personalColor');
const authRouter = require('./routes/auth');
const skinRouter = require('./routes/skin');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    name: 'Oops Personal Color API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      kakaoLogin: 'GET /api/auth/kakao',
      kakaoCallback: 'GET /api/auth/kakao/callback',
      kakaoTokenLogin: 'POST /api/auth/kakao/token',
      me: 'GET /api/auth/me',
      seasons: 'GET /api/personal-color/seasons',
      analyze: 'POST /api/personal-color/analyze',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/personal-color', personalColorRouter);
app.use('/api/skin', skinRouter);

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: '파일 크기는 10MB를 초과할 수 없습니다.' });
  }
  console.error(err);
  res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
});

module.exports = app;
