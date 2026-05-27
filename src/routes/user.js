const express = require('express');
const { SKIN_TYPE_INFO } = require('../utils/skinAnalyzer');
const { requireAuth } = require('../middleware/auth');
const supabase = require('../lib/supabase');

const router = express.Router();

/**
 * GET /api/user/history
 * 로그인한 사용자의 personal + skin 진단 기록 전체를 날짜 내림차순으로 반환
 */
router.get('/history', requireAuth, async (req, res) => {
  const [skinRes, personalRes] = await Promise.all([
    supabase
      .from('skin')
      .select('id, skintype, age, created_at')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('personal')
      .select('id, personaltype, subType, contents, created_at')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false }),
  ]);

  if (skinRes.error)     console.error('[USER] skin 조회 실패:', skinRes.error.message);
  if (personalRes.error) console.error('[USER] personal 조회 실패:', personalRes.error.message);

  const skinItems = (skinRes.data ?? []).map(row => ({
    id: `skin_${row.id}`,
    type: 'skin',
    label: SKIN_TYPE_INFO[row.skintype]?.label ?? '피부 진단',
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
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  res.json({ success: true, data: all });
});

module.exports = router;
