const sharp = require('sharp');
const { extractAvgSkinColor, classifyPersonalColor } = require('../utils/colorAnalyzer');

const DARK_THRESHOLD = 90;   // 평균 밝기가 이 값 미만이면 보정
const TARGET_BRIGHTNESS = 140; // 목표 평균 밝기
const MAX_GAIN = 2.8;          // 최대 증폭 배율 (과노출 방지)

// 이미지가 어두울 경우 밝기를 선형 보정 (RGB 비율 유지)
async function normalizeBrightness(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .resize({ width: 80, height: 80, fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sum = 0;
  const total = 80 * 80;
  for (let i = 0; i < data.length; i += 3) {
    sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }
  const avg = sum / total;

  if (avg >= DARK_THRESHOLD) return { buffer: imageBuffer, gain: 1 };

  const gain = Math.min(TARGET_BRIGHTNESS / avg, MAX_GAIN);
  const buffer = await sharp(imageBuffer)
    .linear(gain, 0)
    .toBuffer();

  return { buffer, gain: parseFloat(gain.toFixed(2)) };
}

// 얼굴 3개 영역(왼볼, 오른볼, 이마)에서 RGBA 픽셀을 수집
async function extractFaceRegionPixels(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .resize({ width: 400, height: 400, fit: 'cover' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = 400, CH = info.channels;

  const regions = [
    { x1: 0.12, y1: 0.35, x2: 0.45, y2: 0.68 }, // 왼쪽 볼
    { x1: 0.55, y1: 0.35, x2: 0.88, y2: 0.68 }, // 오른쪽 볼
    { x1: 0.28, y1: 0.05, x2: 0.72, y2: 0.32 }, // 이마
  ];

  const rgba = [];
  for (const r of regions) {
    const x0 = Math.floor(W * r.x1), x1 = Math.floor(W * r.x2);
    const y0 = Math.floor(W * r.y1), y1 = Math.floor(W * r.y2);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * CH;
        rgba.push(data[i], data[i + 1], data[i + 2], CH === 4 ? data[i + 3] : 255);
      }
    }
  }

  return new Uint8ClampedArray(rgba);
}

async function analyzePersonalColor(imageBuffer) {
  const meta = await sharp(imageBuffer).metadata();
  if (!meta.width || !meta.height) {
    throw new Error('올바른 이미지 파일이 아닙니다.');
  }

  const { buffer: normalizedBuffer, gain } = await normalizeBrightness(imageBuffer);
  const pixels = await extractFaceRegionPixels(normalizedBuffer);
  const avgColor = extractAvgSkinColor(pixels, 0, 0);
  const result = classifyPersonalColor(avgColor);

  return {
    ...result,
    imageInfo: {
      width: meta.width,
      height: meta.height,
      format: meta.format,
      brightnessGain: gain,
    },
  };
}

module.exports = { analyzePersonalColor };
