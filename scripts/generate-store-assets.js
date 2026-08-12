// Google Play Console 스토어 등록에 필요한 이미지를 생성한다.
//   - feature-graphic.png : 1024x500 (필수)
//   - play-icon.png       : 512x512 (필수, 32비트 PNG)
// 실행: node scripts/generate-store-assets.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const colors = {
  background: '#FFFBF5',
  primary: '#4A3F35',
  accent: '#E8A87C',
  accentSoft: '#F6E3D4',
  soft: '#8A8078',
};

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'store-assets');

async function featureGraphic() {
  const W = 1024;
  const H = 500;

  // 배경 + 문구를 SVG로 그리고, 마스코트를 오른쪽에 합성한다.
  const bg = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${colors.background}"/>
          <stop offset="100%" stop-color="${colors.accentSoft}"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      <circle cx="880" cy="120" r="140" fill="${colors.accent}" opacity="0.18"/>
      <circle cx="120" cy="430" r="100" fill="${colors.accent}" opacity="0.12"/>
      <text x="80" y="215" font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif"
            font-size="96" font-weight="800" fill="${colors.primary}">새김</text>
      <text x="80" y="285" font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif"
            font-size="38" fill="${colors.primary}">오늘의 생각을 새기다</text>
      <text x="80" y="345" font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif"
            font-size="26" fill="${colors.soft}">매일 같은 글감으로 함께 쓰는 3줄</text>
    </svg>`);

  const mascot = await sharp(path.join(root, 'src', 'assets', 'mascot-today.png'))
    .resize(330, 330, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp(bg)
    .composite([{ input: mascot, left: 640, top: 95 }])
    .png()
    .toFile(path.join(outDir, 'feature-graphic.png'));

  console.log('feature-graphic.png (1024x500) 생성');
}

async function playIcon() {
  // Play 스토어 아이콘은 알파 채널 없는 512x512 이어야 안전하다.
  await sharp(path.join(root, 'assets', 'icon.png'))
    .resize(512, 512)
    .flatten({ background: colors.background })
    .png()
    .toFile(path.join(outDir, 'play-icon-512.png'));

  console.log('play-icon-512.png (512x512) 생성');
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  await featureGraphic();
  await playIcon();
  console.log('\n생성 위치: store-assets/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
