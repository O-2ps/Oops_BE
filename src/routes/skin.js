const express = require('express');
const jwt = require('jsonwebtoken');
const { QUESTIONS, OPTIONS, analyzeSkin } = require('../utils/skinAnalyzer');
const supabase = require('../lib/supabase');

const router = express.Router();

const REQUIRED_ANSWERS = ['dryness', 'oiliness', 'acne', 'tzone', 'sensitivity'];

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
router.post('/diagnose', async (req, res) => {
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

    const userId = getUserIdFromReq(req);
    if (userId) {
      const { error: dbError } = await supabase.from('skin').insert({
        user_id: Number(userId),
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
router.get('/result', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    const { data, error } = await supabase
      .from('skin')
      .select('id, skintype, age, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: '진단 기록이 없습니다.' });
      }
      throw error;
    }

    const SKIN_TYPE_INFO = {
      dry:         { label: '건성 피부',   characteristics: ['세안 후 당기고 건조함', '각질이 생기기 쉬움', '유분·수분 모두 부족'], recommendations: ['고보습 크림 사용', '저자극 클렌저 사용', '알코올 제품 피하기'] },
      oily:        { label: '지성 피부',   characteristics: ['피지 분비 많고 번들거림', '모공이 크고 막히기 쉬움', '여드름·블랙헤드 생기기 쉬움'], recommendations: ['가벼운 젤 타입 보습제', '폼 클렌저로 이중세안', '논코메도제닉 제품 선택'] },
      combination: { label: '복합성 피부', characteristics: ['T존 번들, U존 건조', '부위별 피부 상태가 다름', '계절에 따라 변화가 큼'], recommendations: ['부위별 다른 제품 사용', '수분 에센스로 밸런스 유지'] },
      normal:      { label: '중성 피부',   characteristics: ['유·수분 밸런스가 좋음', '트러블이 적고 피부결이 고름'], recommendations: ['현재 루틴 유지', '자외선 차단제 꼼꼼히 사용'] },
    };

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
