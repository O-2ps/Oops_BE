const express = require('express');
const { QUESTIONS, OPTIONS, SKIN_TYPE_INFO, analyzeSkin } = require('../utils/skinAnalyzer');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const supabase = require('../lib/supabase');

const router = express.Router();

const REQUIRED_ANSWERS = ['elasticity', 'moisture', 'pigmentation', 'oiliness', 'sensitivity'];

/**
 * GET /api/skin/questions
 * 설문 문항 목록 반환
 */
router.get('/questions', (req, res) => {
  const data = QUESTIONS.map(q => ({ ...q, options: OPTIONS }));
  res.json({ success: true, data });
});

/**
 * POST /api/skin/diagnose
 * Body: { age: number, answers: { [questionId]: string } }
 * Response: 피부 타입 + 피부 나이 분석 결과
 */
router.post('/diagnose', optionalAuth, async (req, res) => {
  try {
    const { age, answers } = req.body;

    if (!age || typeof age !== 'number' || age < 1 || age > 120) {
      return res.status(400).json({ success: false, message: 'age(1~120 숫자)가 필요합니다.' });
    }
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ success: false, message: 'answers 객체가 필요합니다.' });
    }

    const missing = REQUIRED_ANSWERS.filter(q => !answers[q]);
    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: `누락된 답변: ${missing.join(', ')}` });
    }

    const result = analyzeSkin(age, answers);

    if (req.userId) {
      const { error: dbError } = await supabase.from('skin').insert({
        user_id: Number(req.userId),
        skintype: result.skinType,
        age: result.skinAge,
        created_at: new Date().toISOString(),
      });
      if (dbError) console.error('[SKIN] Supabase 저장 실패:', dbError.message);
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[SKIN] 오류:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/skin/result
 * 로그인된 사용자의 가장 최근 피부 진단 결과 반환
 */
router.get('/result', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('skin')
      .select('id, skintype, age, created_at')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: '진단 기록이 없습니다.' });
      }
      throw error;
    }

    const info = SKIN_TYPE_INFO[data.skintype] ?? { label: data.skintype, characteristics: [], recommendations: [] };

    res.json({
      success: true,
      data: {
        id: data.id,
        skinType: data.skintype,
        skinTypeLabel: info.label,
        skinAge: data.age,
        characteristics: info.characteristics,
        recommendations: info.recommendations,
        diagnosedAt: data.created_at,
      },
    });
  } catch (err) {
    console.error('[SKIN] result 조회 오류:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
