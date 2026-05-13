/**
 * face-api.js 모델 파일 다운로드 스크립트
 * 실행: node scripts/downloadModels.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const MODEL_DIR = path.join(__dirname, '../models');
const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

const FILES = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
];

function download(filename) {
  return new Promise((resolve, reject) => {
    const dest = path.join(MODEL_DIR, filename);
    if (fs.existsSync(dest)) {
      console.log(`[skip] ${filename} 이미 존재`);
      return resolve();
    }

    const file = fs.createWriteStream(dest);
    const url = `${BASE_URL}/${filename}`;
    console.log(`[download] ${filename}`);

    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

(async () => {
  if (!fs.existsSync(MODEL_DIR)) fs.mkdirSync(MODEL_DIR, { recursive: true });

  for (const file of FILES) {
    await download(file);
  }
  console.log('모든 모델 다운로드 완료!');
})();
