const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');

const router = express.Router();

async function upsertUser(payload) {
  console.log('[Supabase] upsert 시도:', payload);
  const { data, error } = await supabase.from('users').upsert(
    {
      kakao_id: String(payload.id),
      username: payload.nickname,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'kakao_id' }
  ).select();
  if (error) {
    console.error('[Supabase] upsert 실패 전체 오류:', JSON.stringify(error, null, 2));
    return null;
  }
  console.log('[Supabase] upsert 성공:', data);
  return data?.[0] ?? null;
}

const {
  KAKAO_REST_API_KEY,
  KAKAO_REDIRECT_URI,
  JWT_SECRET,
  JWT_EXPIRES_IN = '7d',
} = process.env;

/**
 * GET /api/auth/kakao
 * 카카오 로그인 페이지로 리다이렉트
 */
router.get('/kakao', (req, res) => {
  const kakaoAuthUrl =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${KAKAO_REST_API_KEY}` +
    `&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}` +
    `&response_type=code`;

  res.redirect(kakaoAuthUrl);
});

/**
 * GET /api/auth/kakao/callback
 * 카카오가 code를 붙여 리다이렉트하는 콜백 엔드포인트
 * 1) code → 카카오 액세스 토큰 교환
 * 2) 액세스 토큰 → 카카오 사용자 정보 조회
 * 3) JWT 발급 후 반환
 */
router.get('/kakao/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).json({ success: false, message: error_description || '카카오 로그인 취소' });
  }
  if (!code) {
    return res.status(400).json({ success: false, message: 'code가 없습니다.' });
  }

  // 1) 액세스 토큰 요청
  let kakaoToken;
  try {
    const tokenRes = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KAKAO_REST_API_KEY,
        redirect_uri: KAKAO_REDIRECT_URI,
        code,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    kakaoToken = tokenRes.data;
  } catch (err) {
    const msg = err.response?.data?.error_description || err.message;
    return res.status(502).json({ success: false, message: `토큰 교환 실패: ${msg}` });
  }

  // 2) 사용자 정보 조회
  let kakaoUser;
  try {
    const userRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${kakaoToken.access_token}` },
    });
    kakaoUser = userRes.data;
  } catch (err) {
    const msg = err.response?.data?.msg || err.message;
    return res.status(502).json({ success: false, message: `사용자 정보 조회 실패: ${msg}` });
  }

  // 3) JWT 발급 + Supabase 저장
  const payload = {
    id: kakaoUser.id,
    nickname: kakaoUser.kakao_account?.profile?.nickname ?? kakaoUser.properties?.nickname ?? null,
  };

  let dbUser, token;
  try {
    dbUser = await upsertUser(payload);
    token = jwt.sign({ ...payload, userId: dbUser?.id ?? null }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  } catch (err) {
    console.error('[AUTH] upsert/JWT 오류:', err);
    return res.status(500).json({ success: false, message: `로그인 처리 실패: ${err.message}` });
  }

  res.json({
    success: true,
    token,
    user: payload,
  });
});

/**
 * POST /api/auth/kakao/token
 * 모바일 앱용: 프론트에서 직접 받은 카카오 액세스 토큰으로 로그인
 * Body: { accessToken: string }
 */
router.post('/kakao/token', async (req, res) => {
  console.log('[AUTH] /kakao/token 요청 받음');
  const { accessToken } = req.body;
  if (!accessToken) {
    return res.status(400).json({ success: false, message: 'accessToken이 필요합니다.' });
  }

  let kakaoUser;
  try {
    const userRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    kakaoUser = userRes.data;
    console.log('[Kakao] 응답 전체:', JSON.stringify(kakaoUser, null, 2));
  } catch (err) {
    const msg = err.response?.data?.msg || err.message;
    return res.status(401).json({ success: false, message: `유효하지 않은 토큰: ${msg}` });
  }

  const payload = {
    id: kakaoUser.id,
    nickname: kakaoUser.kakao_account?.profile?.nickname ?? kakaoUser.properties?.nickname ?? null,
  };

  let dbUser, token;
  try {
    dbUser = await upsertUser(payload);
    token = jwt.sign({ ...payload, userId: dbUser?.id ?? null }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  } catch (err) {
    console.error('[AUTH] upsert/JWT 오류:', err);
    return res.status(500).json({ success: false, message: `로그인 처리 실패: ${err.message}` });
  }

  res.json({
    success: true,
    token,
    user: { ...payload, userId: dbUser?.id ?? null },
  });
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
  } catch (err) {
    res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
  }
});

module.exports = router;
