const express = require('express');
const multer = require('multer');
const { analyzePersonalColor } = require('../services/faceAnalysisService');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const supabase = require('../lib/supabase');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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
 */
router.post('/analyze', upload.single('image'), optionalAuth, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '이미지를 업로드해주세요.' });
    }

    const result = await analyzePersonalColor(req.file.buffer);

    if (req.userId) {
      const { error: dbError } = await supabase.from('personal').insert({
        user_id: req.userId,
        personaltype: result.season,
        subType: result.subType,
        contents: result.description,
        created_at: new Date().toISOString(),
      });
      if (dbError) console.error('[ANALYZE] Supabase 저장 실패:', dbError.message);
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[ANALYZE] 오류:', err.message);
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
        description: '봄 웜 라이트',
        palette: ['#FFE5CC', '#FFD9B3', '#FFECB3', '#D4E8A8', '#FFD5E8'],
        characteristics: ['밝고 연한 따뜻한 색조', '피치, 아이보리, 연한 코럴이 어울림', '노랑 기반의 밝은 톤'],
      },
      {
        season: 'spring', subType: 'true',
        description: '봄 웜 트루',
        palette: ['#FFCC99', '#FF9966', '#FFDD77', '#99CC66', '#FF6699'],
        characteristics: ['밝고 선명한 따뜻한 색조', '코럴, 피치, 골든옐로우가 어울림', '황금빛 기반 톤'],
      },
      {
        season: 'summer', subType: 'light',
        description: '여름 쿨 라이트',
        palette: ['#FFE0EC', '#E8D5F5', '#D5E8F5', '#D5F5EE', '#FFD5EC'],
        characteristics: ['밝고 연한 차가운 색조', '파우더핑크, 라벤더, 베이비블루가 어울림', '핑크 기반의 밝은 톤'],
      },
      {
        season: 'summer', subType: 'true',
        description: '여름 쿨 트루',
        palette: ['#FFCCDD', '#CC99CC', '#99BBDD', '#AADDCC', '#FFAACC'],
        characteristics: ['부드럽고 차가운 색조', '로즈, 라벤더, 파우더블루가 어울림', '핑크 기반 톤'],
      },
      {
        season: 'summer', subType: 'soft',
        description: '여름 쿨 소프트',
        palette: ['#D4B8C8', '#B8B8D4', '#B8CCD4', '#C8D4B8', '#D4C8D4'],
        characteristics: ['뮤트하고 부드러운 차가운 색조', '모브, 스모키블루, 소프트핑크가 어울림', '차갑고 부드러운 톤'],
      },
      {
        season: 'autumn', subType: 'muted',
        description: '가을 웜 뮤트',
        palette: ['#C4956A', '#B89060', '#C4A870', '#8FA870', '#C47A5A'],
        characteristics: ['부드럽고 따뜻한 색조', '카키, 테라코타, 뮤트 코럴이 어울림', '황갈색 기반의 부드러운 톤'],
      },
      {
        season: 'autumn', subType: 'true',
        description: '가을 웜 트루',
        palette: ['#CC7722', '#996633', '#CC9944', '#669933', '#993322'],
        characteristics: ['풍부하고 깊은 따뜻한 색조', '카멜, 올리브, 테라코타가 어울림', '황금빛 기반 톤'],
      },
      {
        season: 'autumn', subType: 'deep',
        description: '가을 웜 딥',
        palette: ['#8B4513', '#6B3A2A', '#8B6914', '#3D5A1A', '#7A2A1A'],
        characteristics: ['깊고 어두운 따뜻한 색조', '버건디, 다크브라운, 다크올리브가 어울림', '깊은 황금빛 기반 톤'],
      },
      {
        season: 'winter', subType: 'deep',
        description: '겨울 쿨 딥',
        palette: ['#2B2B6B', '#6B2B6B', '#6B2B3B', '#1A4060', '#1A6B4A'],
        characteristics: ['깊고 어두운 차가운 색조', '다크네이비, 플럼, 다크버건디가 어울림', '차갑고 깊은 톤'],
      },
      {
        season: 'winter', subType: 'true',
        description: '겨울 쿨 트루',
        palette: ['#3333CC', '#993399', '#CC3355', '#336699', '#009966'],
        characteristics: ['선명하고 강렬한 차가운 색조', '블랙, 네이비, 버건디, 퓨어화이트가 어울림', '블루·로즈 기반 톤'],
      },
      {
        season: 'winter', subType: 'bright',
        description: '겨울 쿨 브라이트',
        palette: ['#6666FF', '#CC44CC', '#FF4477', '#4499FF', '#00CCAA'],
        characteristics: ['밝고 선명한 차가운 색조', '로얄블루, 마젠타, 에메랄드가 어울림', '블루 기반의 선명한 톤'],
      },
    ],
  });
});

module.exports = router;
