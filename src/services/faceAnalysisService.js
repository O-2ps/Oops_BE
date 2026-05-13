const sharp = require('sharp');
const { extractAvgSkinColor, classifyPersonalColor } = require('../utils/colorAnalyzer');

/**
 * 이미지에서 얼굴 영역(상단 중앙 60%)을 샘플링합니다.
 * 참고 레포와 동일한 목표(볼 영역 피부색 추출)를 face detection 없이 구현합니다.
 * - 이미지 중앙 가로 50% + 상단 세로 65% 를 얼굴 영역으로 간주
 * - 해당 영역에서 피부 픽셀만 필터링하여 평균색 계산
 */
async function extractFaceRegionPixels(imageBuffer) {
  const image = sharp(imageBuffer);
  const meta = await image.metadata();
  const { width, height } = meta;

  // 얼굴 영역: 가로 중앙 50%, 세로 상단 65%
  const left = Math.floor(width * 0.25);
  const top = Math.floor(height * 0.05);
  const cropWidth = Math.floor(width * 0.50);
  const cropHeight = Math.floor(height * 0.65);

  const { data, info } = await sharp(imageBuffer)
    .resize({ width: 400, height: 400, fit: 'cover' })
    .extract({
      left: Math.floor(400 * 0.25),
      top: Math.floor(400 * 0.05),
      width: Math.floor(400 * 0.50),
      height: Math.floor(400 * 0.65),
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { pixels: data, width: info.width, height: info.height, channels: info.channels };
}

/**
 * 이미지 버퍼를 받아 퍼스널 컬러 분석 수행
 */
async function analyzePersonalColor(imageBuffer) {
  // 이미지 유효성 확인
  const meta = await sharp(imageBuffer).metadata();
  if (!meta.width || !meta.height) {
    throw new Error('올바른 이미지 파일이 아닙니다.');
  }

  const { pixels, width, height, channels } = await extractFaceRegionPixels(imageBuffer);

  // channels가 3(RGB) or 4(RGBA) 모두 처리
  const rgbaPixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgbaPixels[i * 4]     = pixels[i * channels];       // R
    rgbaPixels[i * 4 + 1] = pixels[i * channels + 1];   // G
    rgbaPixels[i * 4 + 2] = pixels[i * channels + 2];   // B
    rgbaPixels[i * 4 + 3] = channels === 4 ? pixels[i * channels + 3] : 255;
  }

  const avgColor = extractAvgSkinColor(rgbaPixels, width, height);
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
