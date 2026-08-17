// 화면별 새미 이미지를 동일한 규격으로 정규화한다.
// 크림색 배경을 투명하게 만들고, 캐릭터 경계에 맞춰 트림한 뒤 400x400 정사각 캔버스 중앙에 배치한다.
// 이렇게 하면 모든 화면에서 새미가 같은 크기/여백으로 잘림 없이 보인다.
const sharp = require('sharp');
const path = require('path');

const FILES = ['mascot-profile', 'mascot-today', 'mascot-feed', 'mascot-calendar', 'mascot-settings', 'mascot', 'mascot-share'];
const assetsDir = path.join(__dirname, '..', 'src', 'assets');

// 새미 캐릭터는 배경과 비슷한 크림/흰 톤(밝은 배, 하이라이트)을 많이 쓰기 때문에,
// 픽셀 색만 보고 "크림 계열이면 지운다"는 식으로 전체 캔버스를 훑으면 캐릭터 내부의
// 밝은 부분까지 뚫려 버린다. 그래서 이미지 가장자리에서부터 배경색 픽셀을 따라
// flood fill로 연결된 영역만 배경으로 인정한다.
function isBackgroundColor(r, g, b) {
  return r > 232 && g > 220 && b > 200 && Math.abs(r - g) < 22 && r - b < 48;
}

function floodFillBackground(buf, width, height, channels) {
  const isBg = new Uint8Array(width * height);
  const stack = [];

  function seed(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (isBg[idx]) return;
    const o = idx * channels;
    if (!isBackgroundColor(buf[o], buf[o + 1], buf[o + 2])) return;
    isBg[idx] = 1;
    stack.push(idx);
  }

  for (let x = 0; x < width; x++) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    seed(0, y);
    seed(width - 1, y);
  }

  while (stack.length) {
    const idx = stack.pop();
    const x = idx % width;
    const y = (idx / width) | 0;
    seed(x + 1, y);
    seed(x - 1, y);
    seed(x, y + 1);
    seed(x, y - 1);
  }

  return isBg;
}

// 배경으로 지워질 픽셀의 RGB를 캐릭터 쪽 가장 가까운 픽셀 색으로 미리 덮어씌운다.
// (알파를 곱해서/나눠서 보정하는 premultiply 방식은 8비트 정수 버퍼에서 낮은 알파
// 구간의 반올림 오차가 커져 오히려 흰 테두리가 남는 문제가 있었다. 대신 색 자체를
// "캐릭터 색으로 확장"해두면, 이후 블러/리사이즈가 색을 섞어도 항상 캐릭터와
// 비슷한 색끼리만 섞이므로 흰/크림색이 번져 들어올 여지가 없다.)
function extendEdgeColor(buf, width, height, channels, isBg, iterations) {
  let needsColor = isBg;
  for (let iter = 0; iter < iterations; iter++) {
    const next = Uint8Array.from(needsColor);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (!needsColor[idx]) continue;
        const neighbors = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nidx = ny * width + nx;
          if (needsColor[nidx]) continue;
          const o = idx * channels;
          const no = nidx * channels;
          buf[o] = buf[no];
          buf[o + 1] = buf[no + 1];
          buf[o + 2] = buf[no + 2];
          next[idx] = 0;
          break;
        }
      }
    }
    needsColor = next;
  }
}

async function process(name) {
  const src = path.join(assetsDir, name + '.png');
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.from(data);

  const isBg = floodFillBackground(out, width, height, channels);
  extendEdgeColor(out, width, height, channels, isBg, 6);
  for (let idx = 0; idx < width * height; idx++) {
    if (isBg[idx]) out[idx * channels + 3] = 0;
  }

  // flood fill은 이진(계단식) 알파 경계를 만든다. 색은 이미 캐릭터 색으로 확장해뒀으므로
  // 이제 블러를 줘도 흰색이 섞일 걱정 없이 알파만 부드럽게 풀어진다.
  const blurred = await sharp(out, { raw: { width, height, channels } }).blur(0.8).png().toBuffer();
  const trimmed = await sharp(blurred).trim({ threshold: 1 }).toBuffer();
  const tm = await sharp(trimmed).metadata();

  // 트림된 캐릭터를 400x400 캔버스에 꽉 차게(비율 유지) 리사이즈한다.
  // sharp는 composite보다 resize를 먼저 적용하므로 트림 결과를 직접 리사이즈해야 한다.
  await sharp(trimmed)
    .resize(400, 400, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'mitchell' })
    .png()
    .toFile(path.join(assetsDir, name + '.png'));

  console.log(name, '->', tm.width + 'x' + tm.height, '-> 400x400 (flood-fill + edge color 확장)');
}

async function main() {
  for (const f of FILES) await process(f);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
