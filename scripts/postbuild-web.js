// expo export 이후 dist/index.html에 PWA 태그를 주입한다.
//
// Expo의 웹 export는 index.html을 자동 생성하므로 직접 편집할 수 없다.
// 그래서 빌드 후 후처리로 manifest/아이콘/메타 태그와 서비스 워커 등록을 넣는다.
// 실행: node scripts/postbuild-web.js  (npm run build:web 에 포함)
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');

const TAGS = `
    <!-- PWA (홈 화면에 추가) -->
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#4A3F35" />
    <meta name="description" content="매일 하나의 글감, 나만의 3줄. 같은 글감을 본 사람들의 생각을 함께 읽어보세요." />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="새김" />
    <!-- 카카오톡·SNS 공유 미리보기 -->
    <meta property="og:title" content="새김 - 오늘의 생각을 새기다" />
    <meta property="og:description" content="매일 하나의 글감, 나만의 3줄." />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="/icons/icon-512.png" />
`;

const SW_REGISTER = `
    <script>
      // 서비스 워커 등록 (홈 화면 설치 가능 조건). 캐싱은 하지 않는다.
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js').catch(function () {
            // 등록 실패는 앱 동작에 영향을 주지 않으므로 무시한다.
          });
        });
      }
    </script>
`;

function main() {
  if (!fs.existsSync(indexPath)) {
    console.error('dist/index.html이 없습니다. 먼저 expo export를 실행하세요.');
    process.exit(1);
  }

  let html = fs.readFileSync(indexPath, 'utf8');

  if (html.includes('rel="manifest"')) {
    console.log('이미 PWA 태그가 주입되어 있습니다. 건너뜁니다.');
    return;
  }

  if (!html.includes('</head>')) {
    console.error('index.html에 </head>가 없어 태그를 주입할 수 없습니다.');
    process.exit(1);
  }

  html = html.replace('</head>', `${TAGS}${SW_REGISTER}  </head>`);
  fs.writeFileSync(indexPath, html);

  console.log('dist/index.html에 PWA 태그 주입 완료');
}

main();
