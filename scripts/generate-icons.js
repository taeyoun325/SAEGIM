// 마스코트(Mascot.tsx)와 동일한 모양의 SVG를 앱 아이콘/스플래시로 렌더링한다.
// 색상은 src/constants/theme.ts와 일치시킨다.
const sharp = require('sharp');
const path = require('path');

const colors = {
  background: '#FFFBF5',
  card: '#FFFFFF',
  primary: '#4A3F35',
  accent: '#E8A87C',
  accentSoft: '#F6E3D4',
};

function mascotSvg(bg) {
  return `
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="${bg}"/>
    <g transform="translate(512,512) scale(7.5) translate(-60,-64)">
      <ellipse cx="60" cy="108" rx="30" ry="6" fill="${colors.accentSoft}" opacity="0.6"/>
      <circle cx="60" cy="62" r="42" fill="${colors.accentSoft}"/>
      <path d="M45 30 L60 6 L75 30 Z" fill="${colors.accent}"/>
      <path d="M56 12 L64 12 L61 24 L59 24 Z" fill="${colors.primary}"/>
      <circle cx="45" cy="60" r="6" fill="${colors.primary}"/>
      <circle cx="75" cy="60" r="6" fill="${colors.primary}"/>
      <path d="M46 78 Q60 90 74 78" stroke="${colors.primary}" stroke-width="4" stroke-linecap="round" fill="none"/>
      <circle cx="32" cy="70" r="6" fill="${colors.accent}" opacity="0.7"/>
      <circle cx="88" cy="70" r="6" fill="${colors.accent}" opacity="0.7"/>
    </g>
  </svg>`;
}

function mascotSvgTransparent() {
  return `
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(512,512) scale(7.5) translate(-60,-64)">
      <ellipse cx="60" cy="108" rx="30" ry="6" fill="${colors.accentSoft}" opacity="0.6"/>
      <circle cx="60" cy="62" r="42" fill="${colors.accentSoft}"/>
      <path d="M45 30 L60 6 L75 30 Z" fill="${colors.accent}"/>
      <path d="M56 12 L64 12 L61 24 L59 24 Z" fill="${colors.primary}"/>
      <circle cx="45" cy="60" r="6" fill="${colors.primary}"/>
      <circle cx="75" cy="60" r="6" fill="${colors.primary}"/>
      <path d="M46 78 Q60 90 74 78" stroke="${colors.primary}" stroke-width="4" stroke-linecap="round" fill="none"/>
      <circle cx="32" cy="70" r="6" fill="${colors.accent}" opacity="0.7"/>
      <circle cx="88" cy="70" r="6" fill="${colors.accent}" opacity="0.7"/>
    </g>
  </svg>`;
}

const assetsDir = path.join(__dirname, '..', 'assets');

async function main() {
  await sharp(Buffer.from(mascotSvg(colors.background))).png().toFile(path.join(assetsDir, 'icon.png'));
  await sharp(Buffer.from(mascotSvg(colors.background))).png().toFile(path.join(assetsDir, 'favicon.png'));
  await sharp(Buffer.from(mascotSvgTransparent())).png().toFile(path.join(assetsDir, 'android-icon-foreground.png'));
  await sharp(Buffer.from(`<svg width="1024" height="1024"><rect width="1024" height="1024" fill="${colors.background}"/></svg>`))
    .png()
    .toFile(path.join(assetsDir, 'android-icon-background.png'));
  await sharp(Buffer.from(mascotSvgTransparent()))
    .greyscale()
    .png()
    .toFile(path.join(assetsDir, 'android-icon-monochrome.png'));
  await sharp(Buffer.from(mascotSvg(colors.background))).png().toFile(path.join(assetsDir, 'splash-icon.png'));
  console.log('아이콘 생성 완료: icon.png, favicon.png, android-icon-*.png, splash-icon.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
