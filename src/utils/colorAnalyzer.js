function rgbToYCbCr(r, g, b) {
  return {
    Y:   0.299  * r + 0.587  * g + 0.114  * b,
    Cb: -0.169  * r - 0.331  * g + 0.500  * b + 128,
    Cr:  0.500  * r - 0.419  * g - 0.081  * b + 128,
  };
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  let h = 0;
  const s = max === 0 ? 0 : diff / max;
  const v = max;
  if (diff !== 0) {
    if (max === r)      h = ((g - b) / diff) % 6;
    else if (max === g) h = (b - r) / diff + 2;
    else                h = (r - g) / diff + 4;
    h = h * 60;
    if (h < 0) h += 360;
  }
  return { h, s, v };
}

function rgbToLab(r, g, b) {
  let R = r / 255, G = g / 255, B = b / 255;
  R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
  G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
  B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;
  const X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = R * 0.0193 + G * 0.1192 + B * 0.9505;
  return {
    L: 116 * f(Y / 1.00000) - 16,
    a: 500 * (f(X / 0.95047) - f(Y / 1.00000)),
    b: 200 * (f(Y / 1.00000) - f(Z / 1.08883)),
  };
}

function f(t) {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

/**
 * 피부 픽셀 판별:
 * 1차: YCbCr 기반 (연구 검증된 범위, 다양한 피부톤 커버)
 * 2차: HSV 기반 보조 판별 (백업)
 */
function isSkinPixel(r, g, b) {
  if (r < 45) return false;

  // YCbCr: 가장 넓은 피부톤 범위를 포괄하는 연구 검증 범위
  const { Cb, Cr } = rgbToYCbCr(r, g, b);
  if (Cb >= 77 && Cb <= 127 && Cr >= 133 && Cr <= 173) return true;

  // HSV 보조: R이 우세하고 피부 Hue 범위(0~40)
  if (!(r > g && r > b) || r - g < 10) return false;
  const { h, s, v } = rgbToHsv(r, g, b);
  return h >= 0 && h <= 40 && s >= 0.06 && s <= 0.75 && v >= 0.15;
}

/**
 * 피부 평균색 추출:
 * - 이상치 제거 (trimmed mean, 상하 15%)
 * - 피부 픽셀 < 50이면 느슨한 기준으로 재시도, 그래도 부족하면 전체 픽셀 사용
 */
function extractAvgSkinColor(pixels, width, height) {
  const skinPixels = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (isSkinPixel(r, g, b)) skinPixels.push([r, g, b]);
  }

  let pool = skinPixels;
  if (pool.length < 50) {
    // 1차 폴백: 느슨한 기준 (밝기 충분 + R 우세)
    const lenient = [];
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      if (r + g + b > 150 && r > 60 && r >= g && r >= b) lenient.push([r, g, b]);
    }
    pool = lenient.length >= 20 ? lenient : skinPixels;
    // 2차 폴백: 전체 픽셀
    if (pool.length < 20) {
      pool = [];
      for (let i = 0; i < pixels.length; i += 4) {
        pool.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
      }
    }
  }

  // 밝기 기준 정렬 후 상하 15% 제거 (이상치 제거)
  pool.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  const trim = Math.floor(pool.length * 0.15);
  const trimmed = pool.slice(trim, pool.length - trim);

  const n = trimmed.length;
  const rAvg = Math.round(trimmed.reduce((s, p) => s + p[0], 0) / n);
  const gAvg = Math.round(trimmed.reduce((s, p) => s + p[1], 0) / n);
  const bAvg = Math.round(trimmed.reduce((s, p) => s + p[2], 0) / n);

  return { r: rAvg, g: gAvg, b: bAvg };
}

// Lab L값으로 피부 밝기 단계 분류
function classifySkinTone(L) {
  if (L >= 72) return { tone: 'very_light', label: '매우 밝은 피부' };
  if (L >= 62) return { tone: 'light',      label: '밝은 피부' };
  if (L >= 52) return { tone: 'medium',     label: '중간 피부' };
  if (L >= 42) return { tone: 'tan',        label: '진한 피부' };
  return               { tone: 'deep',      label: '어두운 피부' };
}

/**
 * 12타입 퍼스널 컬러 분류
 *
 * 웜/쿨: warmScore = Lab a*(×0.6) + b*(×0.4) > 6 → 웜
 * 명도:  isBright(L > 64), isDark(L < 58)
 * 채도:  isClear(S > 0.33), isMuted(S < 0.20)
 * confidence: warmScore 경계 거리 기반 (0~1)
 */
function classifyPersonalColor(avgRgb) {
  const { r, g, b } = avgRgb;
  const { h, s, v } = rgbToHsv(r, g, b);
  const lab = rgbToLab(r, g, b);

  // 웜/쿨: Lab a*(+붉음), b*(+노랑) 조합 판단
  const warmScore = lab.a * 0.6 + lab.b * 0.4;
  const isWarm = warmScore > 6;

  const isBright = lab.L > 64;
  const isDark   = lab.L < 58;
  const isClear  = s > 0.33;
  const isMuted  = s < 0.20;

  let season, subType, description, palette, characteristics;

  if (isWarm) {
    if (isBright) {
      // 봄
      if (isMuted) {
        season = 'spring'; subType = 'light';
        description = '봄 웜 라이트';
        palette = ['#FFE5CC', '#FFD9B3', '#FFECB3', '#D4E8A8', '#FFD5E8'];
        characteristics = ['밝고 연한 따뜻한 색조', '피치, 아이보리, 연한 코럴이 잘 어울림', '노랑 기반의 밝은 피부 톤'];
      } else {
        season = 'spring'; subType = 'true';
        description = '봄 웜 트루';
        palette = ['#FFCC99', '#FF9966', '#FFDD77', '#99CC66', '#FF6699'];
        characteristics = ['밝고 선명한 따뜻한 색조', '코럴, 피치, 골든옐로우가 잘 어울림', '황금빛 기반의 따뜻한 피부 톤'];
      }
    } else if (isDark) {
      // 가을 딥
      season = 'autumn'; subType = 'deep';
      description = '가을 웜 딥';
      palette = ['#8B4513', '#6B3A2A', '#8B6914', '#3D5A1A', '#7A2A1A'];
      characteristics = ['깊고 어두운 따뜻한 색조', '버건디, 다크 브라운, 다크 올리브가 잘 어울림', '깊은 황금빛 기반의 피부 톤'];
    } else {
      // 가을 중간 명도
      if (isMuted) {
        season = 'autumn'; subType = 'muted';
        description = '가을 웜 뮤트';
        palette = ['#C4956A', '#B89060', '#C4A870', '#8FA870', '#C47A5A'];
        characteristics = ['부드럽고 따뜻한 색조', '카키, 테라코타, 뮤트 코럴이 잘 어울림', '황갈색 기반의 부드러운 피부 톤'];
      } else {
        season = 'autumn'; subType = 'true';
        description = '가을 웜 트루';
        palette = ['#CC7722', '#996633', '#CC9944', '#669933', '#993322'];
        characteristics = ['풍부하고 깊은 따뜻한 색조', '카멜, 올리브, 테라코타가 잘 어울림', '황금빛 기반의 피부 톤'];
      }
    }
  } else {
    // 쿨톤
    if (isBright) {
      if (isClear) {
        season = 'winter'; subType = 'bright';
        description = '겨울 쿨 브라이트';
        palette = ['#6666FF', '#CC44CC', '#FF4477', '#4499FF', '#00CCAA'];
        characteristics = ['밝고 선명한 차가운 색조', '로얄블루, 마젠타, 에메랄드가 잘 어울림', '블루 기반의 선명한 피부 톤'];
      } else {
        season = 'summer'; subType = 'light';
        description = '여름 쿨 라이트';
        palette = ['#FFE0EC', '#E8D5F5', '#D5E8F5', '#D5F5EE', '#FFD5EC'];
        characteristics = ['밝고 연한 차가운 색조', '파우더핑크, 라벤더, 베이비블루가 잘 어울림', '핑크 기반의 밝은 피부 톤'];
      }
    } else if (isDark) {
      if (isClear) {
        season = 'winter'; subType = 'true';
        description = '겨울 쿨 트루';
        palette = ['#3333CC', '#993399', '#CC3355', '#336699', '#009966'];
        characteristics = ['선명하고 강렬한 차가운 색조', '블랙, 네이비, 버건디, 퓨어화이트가 잘 어울림', '블루·로즈 기반의 피부 톤'];
      } else {
        season = 'winter'; subType = 'deep';
        description = '겨울 쿨 딥';
        palette = ['#2B2B6B', '#6B2B6B', '#6B2B3B', '#1A4060', '#1A6B4A'];
        characteristics = ['깊고 어두운 차가운 색조', '다크네이비, 플럼, 다크버건디가 잘 어울림', '차갑고 깊은 피부 톤'];
      }
    } else {
      // 여름 중간 명도
      if (isMuted) {
        season = 'summer'; subType = 'soft';
        description = '여름 쿨 소프트';
        palette = ['#D4B8C8', '#B8B8D4', '#B8CCD4', '#C8D4B8', '#D4C8D4'];
        characteristics = ['뮤트하고 부드러운 차가운 색조', '모브, 스모키블루, 소프트핑크가 잘 어울림', '차갑고 부드러운 피부 톤'];
      } else {
        season = 'summer'; subType = 'true';
        description = '여름 쿨 트루';
        palette = ['#FFCCDD', '#CC99CC', '#99BBDD', '#AADDCC', '#FFAACC'];
        characteristics = ['부드럽고 차가운 색조', '로즈, 라벤더, 파우더블루가 잘 어울림', '핑크 기반의 피부 톤'];
      }
    }
  }

  const skinTone = classifySkinTone(lab.L);

  // warmScore 경계(6) 기준 거리로 신뢰도 산출 (0~1, 1에 가까울수록 명확한 분류)
  const warmConfidence    = Math.min(1, Math.abs(warmScore - 6) / 8);
  const lightnessConfidence = isBright
    ? Math.min(1, (lab.L - 64) / 8)
    : isDark
      ? Math.min(1, (58 - lab.L) / 8)
      : 0.3;
  const confidence = parseFloat((warmConfidence * 0.65 + lightnessConfidence * 0.35).toFixed(2));

  return {
    season,
    subType,
    description,
    palette,
    characteristics,
    skinTone,
    confidence,
    analysis: {
      rgb: avgRgb,
      hsv: { h: Math.round(h), s: parseFloat(s.toFixed(3)), v: parseFloat(v.toFixed(3)) },
      lab: { L: parseFloat(lab.L.toFixed(2)), a: parseFloat(lab.a.toFixed(2)), b: parseFloat(lab.b.toFixed(2)) },
      warmScore: parseFloat(warmScore.toFixed(2)),
      isWarm,
      isBright,
      isDark,
      isClear,
      isMuted,
    },
  };
}

module.exports = { rgbToYCbCr, rgbToHsv, rgbToLab, isSkinPixel, extractAvgSkinColor, classifyPersonalColor };
