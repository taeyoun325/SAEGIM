// PWA(홈 화면에 추가)용 아이콘과 manifest를 public/ 폴더에 생성한다.
// public/ 안의 파일은 expo export 시 dist/ 루트로 복사된다.
// 실행: node scripts/generate-pwa-assets.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const iconDir = path.join(publicDir, 'icons');

const BACKGROUND = '#FFFBF5';
const THEME = '#4A3F35';

// Chrome이 설치 가능 앱으로 인식하려면 192, 512 두 크기가 반드시 필요하다.
const SIZES = [192, 512];

async function main() {
  fs.mkdirSync(iconDir, { recursive: true });
  const src = path.join(root, 'assets', 'icon.png');

  for (const size of SIZES) {
    // 일반 아이콘: 배경을 채워 투명 영역이 검게 보이지 않게 한다.
    await sharp(src)
      .resize(size, size)
      .flatten({ background: BACKGROUND })
      .png()
      .toFile(path.join(iconDir, `icon-${size}.png`));

    // maskable 아이콘: 안드로이드가 원형 등으로 잘라내므로 안쪽 80%에만 캐릭터를 둔다.
    const inner = Math.round(size * 0.8);
    const pad = Math.round((size - inner) / 2);
    const resized = await sharp(src).resize(inner, inner).flatten({ background: BACKGROUND }).toBuffer();
    await sharp({
      create: { width: size, height: size, channels: 4, background: BACKGROUND },
    })
      .composite([{ input: resized, left: pad, top: pad }])
      .png()
      .toFile(path.join(iconDir, `maskable-${size}.png`));
  }

  // iOS 홈 화면용 아이콘 (apple-touch-icon)
  await sharp(src).resize(180, 180).flatten({ background: BACKGROUND }).png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  const manifest = {
    name: '새김 - 오늘의 생각을 새기다',
    short_name: '새김',
    description: '매일 하나의 글감, 나만의 3줄. 같은 글감을 본 사람들의 생각을 함께 읽어보세요.',
    lang: 'ko',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: BACKGROUND,
    theme_color: THEME,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  fs.writeFileSync(path.join(publicDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  // 최소 서비스 워커.
  // 캐싱을 하지 않고 그대로 통과시킨다 — 설치 가능 조건은 만족하면서
  // 오래된 화면이 캐시에 남아 사용자가 옛 버전을 보는 문제를 원천 차단한다.
  const sw = `// 새김 서비스 워커 (캐시 없음: 항상 최신 버전을 보여주기 위함)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // 네트워크로 그대로 통과. 캐시하지 않는다.
  return;
});
`;
  fs.writeFileSync(path.join(publicDir, 'sw.js'), sw);

  console.log('생성 완료:');
  console.log('  public/manifest.json');
  console.log('  public/sw.js');
  console.log('  public/apple-touch-icon.png');
  SIZES.forEach((s) => console.log(`  public/icons/icon-${s}.png, maskable-${s}.png`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
