const sharp = require('sharp');
const { extractAvgSkinColor, classifyPersonalColor } = require('../utils/colorAnalyzer');

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

  const pixels = await extractFaceRegionPixels(imageBuffer);
  const avgColor = extractAvgSkinColor(pixels, 0, 0);
  const result = classifyPersonalColor(avgColor);

  return {
    ...result,
    imageInfo: {
      width: meta.width,
      height: meta.height,
      format: meta.format,
    },
  };
}

module.exports = { analyzePersonalColor };
