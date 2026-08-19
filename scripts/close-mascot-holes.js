// 새미 그림 안쪽에 반투명한 영역(볼터치·하이라이트·감은 눈처럼 부드럽게 칠해진 부분)이
// 낮은 알파로 남아있다. 크림/흰 배경 위에서는 배경과 자연스럽게 섞여 안 보이지만,
// 다크 모드처럼 어두운 배경 위에서는 그 낮은 알파 사이로 배경색이 비쳐 보여
// 캐릭터가 군데군데 덜 그려진 것처럼 보인다.
//
// 저알파 픽셀들을 연결요소(connected component)로 묶어보면, 진짜 배경은 캔버스
// 대부분을 차지하는 가장 큰 덩어리 하나뿐이고 나머지는 전부 캐릭터 안쪽에 갇힌
// 작은 덩어리(눈매, 볼터치 등)다. 가장자리에서부터 flood fill하는 방식은 안쪽
// 덩어리가 아주 가는 틈으로 바깥과 이어져 있으면 놓치므로, 대신 "가장 큰 덩어리만
// 배경으로 남기고 나머지는 전부 채운다"는 크기 기준으로 판단한다.
// 색은 이미 올바른 채색이므로(그저 알파만 낮았을 뿐) 바꾸지 않고 알파만 255로 만든다.
//
// 실행: node scripts/close-mascot-holes.js
const sharp = require('sharp');
const path = require('path');

const FILES = ['mascot-profile', 'mascot-today', 'mascot-feed', 'mascot-calendar', 'mascot-settings', 'mascot', 'mascot-share'];
const assetsDir = path.join(__dirname, '..', 'src', 'assets');
const ALPHA_THRESHOLD = 200; // 이보다 낮으면 "반투명"으로 취급

function findComponents(lowAlphaMask, width, height) {
  const n = width * height;
  const visited = new Uint8Array(n);
  const components = [];

  for (let start = 0; start < n; start++) {
    if (!lowAlphaMask[start] || visited[start]) continue;
    const members = [];
    const stack = [start];
    visited[start] = 1;
    while (stack.length) {
      const idx = stack.pop();
      members.push(idx);
      const x = idx % width;
      const y = (idx / width) | 0;
      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < width - 1 ? idx + 1 : -1,
        y > 0 ? idx - width : -1,
        y < height - 1 ? idx + width : -1,
      ];
      for (const nIdx of neighbors) {
        if (nIdx >= 0 && lowAlphaMask[nIdx] && !visited[nIdx]) {
          visited[nIdx] = 1;
          stack.push(nIdx);
        }
      }
    }
    components.push(members);
  }
  return components;
}

async function fixInteriorRegions(name) {
  const file = path.join(assetsDir, name + '.png');
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const n = width * height;

  const lowAlphaMask = new Uint8Array(n);
  for (let i = 0; i < n; i++) lowAlphaMask[i] = data[i * channels + 3] < ALPHA_THRESHOLD ? 1 : 0;

  const components = findComponents(lowAlphaMask, width, height);
  components.sort((a, b) => b.length - a.length);

  // 가장 큰 덩어리(진짜 배경)만 남기고 나머지는 전부 안쪽 결함으로 보고 채운다.
  const out = Buffer.from(data);
  let fixedCount = 0;
  for (let c = 1; c < components.length; c++) {
    for (const idx of components[c]) {
      out[idx * channels + 3] = 255;
      fixedCount++;
    }
  }

  await sharp(out, { raw: { width, height, channels } })
    .png({ palette: true, quality: 100, effort: 10 })
    .toFile(file);

  console.log(name, '- 연결요소 수:', components.length, '/ 채운 픽셀 수:', fixedCount, '/ 배경(가장 큰 덩어리) 크기:', components[0]?.length ?? 0);
}

async function main() {
  for (const f of FILES) await fixInteriorRegions(f);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
