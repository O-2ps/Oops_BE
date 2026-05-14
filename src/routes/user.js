const express = require('express');
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');

const router = express.Router();

const SKIN_LABELS = {
  dry:         '건성 피부',
  oily:        '지성 피부',
  combination: '복합성 피부',
  normal:      '중성 피부',
};

function getUserIdFromReq(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    return decoded.userId ?? null;
  } catch {
    return null;
  }
}

/**
 * GET /api/user/history
 * 로그인한 사용자의 personal + skin 진단 기록 전체를 날짜 내림차순으로 반환
 */
router.get('/history', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
  }

  const [skinRes, personalRes] = await Promise.all([
    supabase
      .from('skin')
      .select('id, skintype, age, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('personal')
      .select('id, personaltype, subType, contents, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  if (skinRes.error)     console.error('[USER] skin 조회 실패:', skinRes.error.message);
  if (personalRes.error) console.error('[USER] personal 조회 실패:', personalRes.error.message);

  const skinItems = (skinRes.data ?? []).map(row => ({
    id: `skin_${row.id}`,
    type: 'skin',
    label: SKIN_LABELS[row.skintype] ?? '피부 진단',
    skinType: row.skintype,
    skinAge: row.age,
    created_at: row.created_at,
  }));

  const personalItems = (personalRes.data ?? []).map(row => ({
    id: `personal_${row.id}`,
    type: 'personal',
    label: row.contents || row.personaltype,
    personalType: row.personaltype,
    subType: row.subType,
    created_at: row.created_at,
  }));

  const all = [...skinItems, ...personalItems].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  res.json({ success: true, data: all });
});

module.exports = router;
