/**
 * RGB → HSV 변환
 * H: 0-360, S: 0-1, V: 0-1
 */
function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

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

/**
 * RGB → Lab 변환 (피부톤 분석에 더 정확)
 */
function rgbToLab(r, g, b) {
  // sRGB → linear
  let R = r / 255, G = g / 255, B = b / 255;
  R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
  G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
  B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;

  // linear → XYZ (D65)
  const X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = R * 0.0193 + G * 0.1192 + B * 0.9505;

  // XYZ → Lab
  const fx = f(X / 0.95047);
  const fy = f(Y / 1.00000);
  const fz = f(Z / 1.08883);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function f(t) {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

/**
 * 피부 픽셀 여부 판단 (HSV 기반 필터링)
 */
function isSkinPixel(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b);
  // 피부색 HSV 범위
  return (
    h >= 0 && h <= 50 &&
    s >= 0.1 && s <= 0.68 &&
    v >= 0.35
  );
}

/**
 * 픽셀 배열에서 평균 RGB 추출 (피부 픽셀만)
 */
function extractAvgSkinColor(pixels, width, height) {
  let rSum = 0, gSum = 0, bSum = 0, count = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    if (isSkinPixel(r, g, b)) {
      rSum += r;
      gSum += g;
      bSum += b;
      count++;
    }
  }

  if (count === 0) {
    // fallback: 모든 픽셀 평균
    for (let i = 0; i < pixels.length; i += 4) {
      rSum += pixels[i];
      gSum += pixels[i + 1];
      bSum += pixels[i + 2];
    }
    count = pixels.length / 4;
  }

  return {
    r: Math.round(rSum / count),
    g: Math.round(gSum / count),
    b: Math.round(bSum / count),
  };
}

/**
 * 퍼스널 컬러 분류
 *
 * 4계절 타입 기준:
 * - Spring Warm (봄 웜): 밝고 따뜻한 톤, 황색 계열
 * - Summer Cool (여름 쿨): 밝고 차가운 톤, 핑크·라벤더 계열
 * - Autumn Warm (가을 웜): 어둡고 따뜻한 톤, 황갈색 계열
 * - Winter Cool (겨울 쿨): 어둡고 차가운 톤, 블루·로즈 계열
 *
 * HSV 분류 기준 (참고: youngeun-dev/personal-color-prediction):
 *   H(색상): 낮을수록 따뜻(황색/오렌지), 높을수록 차가움(핑크/로즈)
 *   S(채도): 낮을수록 여름·겨울, 높을수록 봄·가을
 *   V(명도): 높을수록 봄·여름, 낮을수록 가을·겨울
 */
function classifyPersonalColor(avgRgb) {
  const { r, g, b } = avgRgb;
  const { h, s, v } = rgbToHsv(r, g, b);
  const lab = rgbToLab(r, g, b);

  // warm/cool 판단: a* (Lab) 양수면 붉은/황색(웜), 음수면 파란/핑크(쿨)
  const isWarm = lab.a > 8 || (h <= 25 && s > 0.15);

  // bright/deep 판단: L* (Lab) 기준
  const isBright = lab.L > 68;

  let season, description, palette, characteristics;

  if (isWarm && isBright) {
    season = 'spring';
    description = '봄 웜톤 (Spring Warm)';
    palette = ['#FFCC99', '#FF9966', '#FFDD77', '#99CC66', '#FF6699'];
    characteristics = [
      '밝고 선명한 따뜻한 색조',
      '피치, 코럴, 아이보리 등이 잘 어울림',
      '노랑 기반의 피부 undertone',
    ];
  } else if (!isWarm && isBright) {
    season = 'summer';
    description = '여름 쿨톤 (Summer Cool)';
    palette = ['#FFCCDD', '#CC99CC', '#99BBDD', '#AADDCC', '#FFAACC'];
    characteristics = [
      '밝고 부드러운 차가운 색조',
      '라벤더, 파우더블루, 로즈 등이 잘 어울림',
      '핑크 기반의 피부 undertone',
    ];
  } else if (isWarm && !isBright) {
    season = 'autumn';
    description = '가을 웜톤 (Autumn Warm)';
    palette = ['#CC7722', '#996633', '#CC9944', '#669933', '#993322'];
    characteristics = [
      '깊고 풍부한 따뜻한 색조',
      '카멜, 올리브, 테라코타 등이 잘 어울림',
      '황금빛 기반의 피부 undertone',
    ];
  } else {
    season = 'winter';
    description = '겨울 쿨톤 (Winter Cool)';
    palette = ['#3333CC', '#993399', '#CC3355', '#336699', '#009966'];
    characteristics = [
      '선명하고 강렬한 차가운 색조',
      '블랙, 네이비, 버건디 등이 잘 어울림',
      '블루·로즈 기반의 피부 undertone',
    ];
  }

  return {
    season,
    description,
    palette,
    characteristics,
    analysis: {
      rgb: avgRgb,
      hsv: {
        h: Math.round(h),
        s: parseFloat(s.toFixed(3)),
        v: parseFloat(v.toFixed(3)),
      },
      lab: {
        L: parseFloat(lab.L.toFixed(2)),
        a: parseFloat(lab.a.toFixed(2)),
        b: parseFloat(lab.b.toFixed(2)),
      },
      isWarm,
      isBright,
    },
  };
}

module.exports = { rgbToHsv, rgbToLab, isSkinPixel, extractAvgSkinColor, classifyPersonalColor };
