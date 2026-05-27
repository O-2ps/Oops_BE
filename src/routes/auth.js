const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');

const router = express.Router();

const {
  KAKAO_REST_API_KEY,
  KAKAO_REDIRECT_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN = '7d',
} = process.env;

async function upsertUser(payload) {
  const { data, error } = await supabase.from('users').upsert(
    {
      kakao_id: String(payload.id),
      username: payload.nickname,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'kakao_id' }
  ).select();
  if (error) {
    console.error('[AUTH] upsert 실패:', error.message);
    return null;
  }
  return data?.[0] ?? null;
}

async function fetchKakaoUser(accessToken) {
  const { data } = await axios.get('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

function buildKakaoPayload(kakaoUser) {
  return {
    id: kakaoUser.id,
    nickname: kakaoUser.kakao_account?.profile?.nickname ?? kakaoUser.properties?.nickname ?? null,
  };
}

async function issueToken(kakaoUser) {
  const payload = buildKakaoPayload(kakaoUser);
  const dbUser = await upsertUser(payload);
  const token = jwt.sign({ ...payload, userId: dbUser?.id ?? null }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return { token, payload, dbUser };
}

/**
 * GET /api/auth/kakao
 * 카카오 로그인 페이지로 리다이렉트
 */
router.get('/kakao', (req, res) => {
  const url =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${KAKAO_REST_API_KEY}` +
    `&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}` +
    `&response_type=code`;
  res.redirect(url);
});

/**
 * GET /api/auth/kakao/callback
 * code → 액세스 토큰 교환 → 사용자 정보 조회 → JWT 발급
 */
router.get('/kakao/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).json({ success: false, message: error_description || '카카오 로그인 취소' });
  }
  if (!code) {
    return res.status(400).json({ success: false, message: 'code가 없습니다.' });
  }

  let kakaoToken;
  try {
    const { data } = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KAKAO_REST_API_KEY,
        redirect_uri: KAKAO_REDIRECT_URI,
        code,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    kakaoToken = data;
  } catch (err) {
    const msg = err.response?.data?.error_description || err.message;
    return res.status(502).json({ success: false, message: `토큰 교환 실패: ${msg}` });
  }

  try {
    const kakaoUser = await fetchKakaoUser(kakaoToken.access_token);
    const { token, payload } = await issueToken(kakaoUser);
    res.json({ success: true, token, user: payload });
  } catch (err) {
    console.error('[AUTH] 로그인 처리 실패:', err.message);
    res.status(500).json({ success: false, message: `로그인 처리 실패: ${err.message}` });
  }
});

/**
 * POST /api/auth/kakao/token
 * 모바일 앱용: 프론트에서 직접 받은 카카오 액세스 토큰으로 로그인
 * Body: { accessToken: string }
 */
router.post('/kakao/token', async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) {
    return res.status(400).json({ success: false, message: 'accessToken이 필요합니다.' });
  }

  try {
    const kakaoUser = await fetchKakaoUser(accessToken);
    const { token, payload, dbUser } = await issueToken(kakaoUser);
    res.json({ success: true, token, user: { ...payload, userId: dbUser?.id ?? null } });
  } catch (err) {
    const status = err.response?.status === 401 ? 401 : 500;
    const msg = err.response?.data?.msg || err.message;
    console.error('[AUTH] 로그인 처리 실패:', msg);
    res.status(status).json({ success: false, message: status === 401 ? `유효하지 않은 토큰: ${msg}` : `로그인 처리 실패: ${msg}` });
  }
});

/**
 * GET /api/auth/me
 * JWT 검증 후 내 정보 반환
 */
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
  }
  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
    res.json({ success: true, user: decoded });
  } catch {
    res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
  }
});

module.exports = router;
