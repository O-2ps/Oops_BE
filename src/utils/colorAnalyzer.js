function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  let h = 0;
  let s = max === 0 ? 0 : diff / max;
  const v = max;
  if (diff !== 0) {
    if (max === r) h = ((g - b) / diff) % 6;
    else if (max === g) h = (b - r) / diff + 2;
    else h = (r - g) / diff + 4;
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
  const fx = f(X / 0.95047);
  const fy = f(Y / 1.00000);
  const fz = f(Z / 1.08883);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function f(t) {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

function isSkinPixel(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b);
  return h >= 0 && h <= 50 && s >= 0.1 && s <= 0.68 && v >= 0.35;
}

function extractAvgSkinColor(pixels, width, height) {
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (isSkinPixel(r, g, b)) { rSum += r; gSum += g; bSum += b; count++; }
  }
  if (count === 0) {
    for (let i = 0; i < pixels.length; i += 4) {
      rSum += pixels[i]; gSum += pixels[i + 1]; bSum += pixels[i + 2];
    }
    count = pixels.length / 4;
  }
  return { r: Math.round(rSum / count), g: Math.round(gSum / count), b: Math.round(bSum / count) };
}

/**
 * 12타입 퍼스널 컬러 분류
 *
 * 분류 기준:
 *   웜/쿨: Lab a* 값 (양수=웜, 음수=쿨)
 *   명도:  Lab L* 값 (>68=밝음, 55~68=중간, <55=어두움)
 *   채도:  HSV S 값  (>0.38=선명, 0.22~0.38=보통, <0.22=뮤트)
 */
function classifyPersonalColor(avgRgb) {
  const { r, g, b } = avgRgb;
  const { h, s, v } = rgbToHsv(r, g, b);
  const lab = rgbToLab(r, g, b);

  const isWarm = lab.a > 8 || (h <= 25 && s > 0.15);
  const isBright = lab.L > 68;
  const isDark = lab.L < 55;
  const isClear = s > 0.38;
  const isMuted = s < 0.22;

  let season, subType, description, palette, characteristics;

  if (isWarm) {
    if (isBright) {
      // 봄
      if (isMuted) {
        season = 'spring'; subType = 'light';
        description = '봄 웜 라이트 (Light Spring)';
        palette = ['#FFE5CC', '#FFD9B3', '#FFECB3', '#D4E8A8', '#FFD5E8'];
        characteristics = ['밝고 연한 따뜻한 색조', '피치, 아이보리, 연한 코럴이 잘 어울림', '노랑 기반의 밝은 피부 undertone'];
      } else {
        season = 'spring'; subType = 'true';
        description = '봄 웜 트루 (True Spring)';
        palette = ['#FFCC99', '#FF9966', '#FFDD77', '#99CC66', '#FF6699'];
        characteristics = ['밝고 선명한 따뜻한 색조', '코럴, 피치, 골든옐로우가 잘 어울림', '황금빛 기반의 따뜻한 피부 undertone'];
      }
    } else if (isDark) {
      // 가을 딥
      season = 'autumn'; subType = 'deep';
      description = '가을 웜 딥 (Deep Autumn)';
      palette = ['#8B4513', '#6B3A2A', '#8B6914', '#3D5A1A', '#7A2A1A'];
      characteristics = ['깊고 어두운 따뜻한 색조', '버건디, 다크 브라운, 다크 올리브가 잘 어울림', '깊은 황금빛 기반의 피부 undertone'];
    } else {
      // 가을 (중간 명도)
      if (isMuted) {
        season = 'autumn'; subType = 'muted';
        description = '가을 웜 뮤트 (Muted Autumn)';
        palette = ['#C4956A', '#B89060', '#C4A870', '#8FA870', '#C47A5A'];
        characteristics = ['부드럽고 따뜻한 색조', '카키, 테라코타, 뮤트 코럴이 잘 어울림', '황갈색 기반의 부드러운 피부 undertone'];
      } else {
        season = 'autumn'; subType = 'true';
        description = '가을 웜 트루 (True Autumn)';
        palette = ['#CC7722', '#996633', '#CC9944', '#669933', '#993322'];
        characteristics = ['풍부하고 깊은 따뜻한 색조', '카멜, 올리브, 테라코타가 잘 어울림', '황금빛 기반의 피부 undertone'];
      }
    }
  } else {
    // 쿨톤
    if (isBright) {
      if (isClear) {
        // 겨울 브라이트 (밝고 선명한 쿨)
        season = 'winter'; subType = 'bright';
        description = '겨울 쿨 브라이트 (Bright Winter)';
        palette = ['#6666FF', '#CC44CC', '#FF4477', '#4499FF', '#00CCAA'];
        characteristics = ['밝고 선명한 차가운 색조', '로얄블루, 마젠타, 에메랄드가 잘 어울림', '블루 기반의 선명한 피부 undertone'];
      } else {
        // 여름 라이트 (밝고 부드러운 쿨)
        season = 'summer'; subType = 'light';
        description = '여름 쿨 라이트 (Light Summer)';
        palette = ['#FFE0EC', '#E8D5F5', '#D5E8F5', '#D5F5EE', '#FFD5EC'];
        characteristics = ['밝고 연한 차가운 색조', '파우더핑크, 라벤더, 베이비블루가 잘 어울림', '핑크 기반의 밝은 피부 undertone'];
      }
    } else if (isDark) {
      // 겨울 (어두운 쿨)
      if (isClear) {
        season = 'winter'; subType = 'true';
        description = '겨울 쿨 트루 (True Winter)';
        palette = ['#3333CC', '#993399', '#CC3355', '#336699', '#009966'];
        characteristics = ['선명하고 강렬한 차가운 색조', '블랙, 네이비, 버건디, 퓨어화이트가 잘 어울림', '블루·로즈 기반의 피부 undertone'];
      } else {
        season = 'winter'; subType = 'deep';
        description = '겨울 쿨 딥 (Deep Winter)';
        palette = ['#2B2B6B', '#6B2B6B', '#6B2B3B', '#1A4060', '#1A6B4A'];
        characteristics = ['깊고 어두운 차가운 색조', '다크네이비, 플럼, 다크버건디가 잘 어울림', '차갑고 깊은 피부 undertone'];
      }
    } else {
      // 여름 (중간 명도 쿨)
      if (isMuted) {
        season = 'summer'; subType = 'soft';
        description = '여름 쿨 소프트 (Soft Summer)';
        palette = ['#D4B8C8', '#B8B8D4', '#B8CCD4', '#C8D4B8', '#D4C8D4'];
        characteristics = ['뮤트하고 부드러운 차가운 색조', '모브, 스모키블루, 소프트핑크가 잘 어울림', '차갑고 부드러운 피부 undertone'];
      } else {
        season = 'summer'; subType = 'true';
        description = '여름 쿨 트루 (True Summer)';
        palette = ['#FFCCDD', '#CC99CC', '#99BBDD', '#AADDCC', '#FFAACC'];
        characteristics = ['부드럽고 차가운 색조', '로즈, 라벤더, 파우더블루가 잘 어울림', '핑크 기반의 피부 undertone'];
      }
    }
  }

  return {
    season,
    subType,
    description,
    palette,
    characteristics,
    analysis: {
      rgb: avgRgb,
      hsv: { h: Math.round(h), s: parseFloat(s.toFixed(3)), v: parseFloat(v.toFixed(3)) },
      lab: { L: parseFloat(lab.L.toFixed(2)), a: parseFloat(lab.a.toFixed(2)), b: parseFloat(lab.b.toFixed(2)) },
      isWarm,
      isBright,
      isDark,
      isClear,
      isMuted,
    },
  };
}

module.exports = { rgbToHsv, rgbToLab, isSkinPixel, extractAvgSkinColor, classifyPersonalColor };
