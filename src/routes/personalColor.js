const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { analyzePersonalColor } = require('../services/faceAnalysisService');
const supabase = require('../lib/supabase');

const router = express.Router();

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
    cb(null, true);
  },
});

/**
 * POST /api/personal-color/analyze
 * 이미지를 받아 퍼스널 컬러를 분석합니다.
 *
 * Body: multipart/form-data
 *   - image: 이미지 파일 (JPEG, PNG, WebP)
 *
 * Response:
 *   - season: 'spring' | 'summer' | 'autumn' | 'winter'
 *   - description: 한국어 설명
 *   - palette: 어울리는 색상 hex 배열
 *   - characteristics: 특징 설명 배열
 *   - analysis: HSV, Lab, RGB 분석값
 *   - face: 얼굴 감지 영역
 */
router.post('/analyze', upload.single('image'), async (req, res) => {
  try {
    console.log('[ANALYZE] 요청 수신, file:', req.file ? `${req.file.originalname} (${req.file.size}b)` : 'NONE');
    if (!req.file) {
      return res.status(400).json({ success: false, message: '이미지를 업로드해주세요.' });
    }

    console.log('[ANALYZE] 분석 시작');
    const result = await analyzePersonalColor(req.file.buffer);
    console.log('[ANALYZE] 분석 완료:', result.season, result.subType);

    const userId = getUserIdFromReq(req);
    if (userId) {
      console.log('[ANALYZE] Supabase 저장 시도, userId:', userId);
      const { error: dbError } = await supabase.from('personal').insert({
        user_id: userId,
        personaltype: result.season,
        subType: result.subType,
        contents: result.description,
        created_at: new Date().toISOString(),
      });
      if (dbError) console.error('[ANALYZE] Supabase 저장 실패:', dbError.message);
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[ANALYZE] 오류:', err.message, err.stack);
    const status = err.message.includes('얼굴을 감지') ? 422 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/personal-color/seasons
 * 4계절 퍼스널 컬러 타입 정보 반환
 */
router.get('/seasons', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        season: 'spring', subType: 'light',
        description: '봄 웜 라이트 (Light Spring)',
        palette: ['#FFE5CC', '#FFD9B3', '#FFECB3', '#D4E8A8', '#FFD5E8'],
        characteristics: ['밝고 연한 따뜻한 색조', '피치, 아이보리, 연한 코럴이 어울림', '노랑 기반의 밝은 undertone'],
      },
      {
        season: 'spring', subType: 'true',
        description: '봄 웜 트루 (True Spring)',
        palette: ['#FFCC99', '#FF9966', '#FFDD77', '#99CC66', '#FF6699'],
        characteristics: ['밝고 선명한 따뜻한 색조', '코럴, 피치, 골든옐로우가 어울림', '황금빛 기반 undertone'],
      },
      {
        season: 'summer', subType: 'light',
        description: '여름 쿨 라이트 (Light Summer)',
        palette: ['#FFE0EC', '#E8D5F5', '#D5E8F5', '#D5F5EE', '#FFD5EC'],
        characteristics: ['밝고 연한 차가운 색조', '파우더핑크, 라벤더, 베이비블루가 어울림', '핑크 기반의 밝은 undertone'],
      },
      {
        season: 'summer', subType: 'true',
        description: '여름 쿨 트루 (True Summer)',
        palette: ['#FFCCDD', '#CC99CC', '#99BBDD', '#AADDCC', '#FFAACC'],
        characteristics: ['부드럽고 차가운 색조', '로즈, 라벤더, 파우더블루가 어울림', '핑크 기반 undertone'],
      },
      {
        season: 'summer', subType: 'soft',
        description: '여름 쿨 소프트 (Soft Summer)',
        palette: ['#D4B8C8', '#B8B8D4', '#B8CCD4', '#C8D4B8', '#D4C8D4'],
        characteristics: ['뮤트하고 부드러운 차가운 색조', '모브, 스모키블루, 소프트핑크가 어울림', '차갑고 부드러운 undertone'],
      },
      {
        season: 'autumn', subType: 'muted',
        description: '가을 웜 뮤트 (Muted Autumn)',
        palette: ['#C4956A', '#B89060', '#C4A870', '#8FA870', '#C47A5A'],
        characteristics: ['부드럽고 따뜻한 색조', '카키, 테라코타, 뮤트 코럴이 어울림', '황갈색 기반의 부드러운 undertone'],
      },
      {
        season: 'autumn', subType: 'true',
        description: '가을 웜 트루 (True Autumn)',
        palette: ['#CC7722', '#996633', '#CC9944', '#669933', '#993322'],
        characteristics: ['풍부하고 깊은 따뜻한 색조', '카멜, 올리브, 테라코타가 어울림', '황금빛 기반 undertone'],
      },
      {
        season: 'autumn', subType: 'deep',
        description: '가을 웜 딥 (Deep Autumn)',
        palette: ['#8B4513', '#6B3A2A', '#8B6914', '#3D5A1A', '#7A2A1A'],
        characteristics: ['깊고 어두운 따뜻한 색조', '버건디, 다크브라운, 다크올리브가 어울림', '깊은 황금빛 기반 undertone'],
      },
      {
        season: 'winter', subType: 'deep',
        description: '겨울 쿨 딥 (Deep Winter)',
        palette: ['#2B2B6B', '#6B2B6B', '#6B2B3B', '#1A4060', '#1A6B4A'],
        characteristics: ['깊고 어두운 차가운 색조', '다크네이비, 플럼, 다크버건디가 어울림', '차갑고 깊은 undertone'],
      },
      {
        season: 'winter', subType: 'true',
        description: '겨울 쿨 트루 (True Winter)',
        palette: ['#3333CC', '#993399', '#CC3355', '#336699', '#009966'],
        characteristics: ['선명하고 강렬한 차가운 색조', '블랙, 네이비, 버건디, 퓨어화이트가 어울림', '블루·로즈 기반 undertone'],
      },
      {
        season: 'winter', subType: 'bright',
        description: '겨울 쿨 브라이트 (Bright Winter)',
        palette: ['#6666FF', '#CC44CC', '#FF4477', '#4499FF', '#00CCAA'],
        characteristics: ['밝고 선명한 차가운 색조', '로얄블루, 마젠타, 에메랄드가 어울림', '블루 기반의 선명한 undertone'],
      },
    ],
  });
});

/**
 * POST /api/personal-color/skin
 * Body: { age: number }
 */
router.post('/skin', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
  }

  const { age } = req.body;
  if (!age || typeof age !== 'number') {
    return res.status(400).json({ success: false, message: 'age(숫자)가 필요합니다.' });
  }

  const { data, error } = await supabase.from('skin').insert({
    user_id: userId,
    age,
    created_at: new Date().toISOString(),
  }).select();

  if (error) {
    return res.status(500).json({ success: false, message: error.message });
  }

  res.json({ success: true, data: data[0] });
});

module.exports = router;
