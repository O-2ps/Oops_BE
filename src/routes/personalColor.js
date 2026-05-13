const express = require('express');
const multer = require('multer');
const { analyzePersonalColor } = require('../services/faceAnalysisService');

const router = express.Router();

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
    if (!req.file) {
      return res.status(400).json({ success: false, message: '이미지를 업로드해주세요.' });
    }

    const result = await analyzePersonalColor(req.file.buffer);

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
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
        season: 'spring',
        description: '봄 웜톤 (Spring Warm)',
        palette: ['#FFCC99', '#FF9966', '#FFDD77', '#99CC66', '#FF6699'],
        characteristics: ['밝고 선명한 따뜻한 색조', '피치, 코럴, 아이보리가 어울림', '노랑 기반 undertone'],
      },
      {
        season: 'summer',
        description: '여름 쿨톤 (Summer Cool)',
        palette: ['#FFCCDD', '#CC99CC', '#99BBDD', '#AADDCC', '#FFAACC'],
        characteristics: ['밝고 부드러운 차가운 색조', '라벤더, 파우더블루, 로즈가 어울림', '핑크 기반 undertone'],
      },
      {
        season: 'autumn',
        description: '가을 웜톤 (Autumn Warm)',
        palette: ['#CC7722', '#996633', '#CC9944', '#669933', '#993322'],
        characteristics: ['깊고 풍부한 따뜻한 색조', '카멜, 올리브, 테라코타가 어울림', '황금빛 기반 undertone'],
      },
      {
        season: 'winter',
        description: '겨울 쿨톤 (Winter Cool)',
        palette: ['#3333CC', '#993399', '#CC3355', '#336699', '#009966'],
        characteristics: ['선명하고 강렬한 차가운 색조', '블랙, 네이비, 버건디가 어울림', '블루·로즈 기반 undertone'],
      },
    ],
  });
});

module.exports = router;
