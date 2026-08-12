// 화면별 새미 이미지를 동일한 규격으로 정규화한다.
// 크림색 배경을 투명하게 만들고, 캐릭터 경계에 맞춰 트림한 뒤 400x400 정사각 캔버스 중앙에 배치한다.
// 이렇게 하면 모든 화면에서 새미가 같은 크기/여백으로 잘림 없이 보인다.
const sharp = require('sharp');
const path = require('path');

const FILES = ['mascot-profile', 'mascot-today', 'mascot-feed', 'mascot-calendar', 'mascot-settings', 'mascot'];
const assetsDir = path.join(__dirname, '..', 'src', 'assets');

async function process(name) {
  const src = path.join(assetsDir, name + '.png');
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.from(data);

  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const r = out[o];
    const g = out[o + 1];
    const b = out[o + 2];
    // 배경(크림/흰색 계열)만 투명 처리한다. 캐릭터의 밝은 배 부분은 이보다 노란기가 강하다.
    if (r > 243 && g > 238 && b > 225 && Math.abs(r - g) < 14 && r - b < 32) {
      out[o + 3] = 0;
    }
  }

  const cleaned = await sharp(out, { raw: { width, height, channels } }).png().toBuffer();
  const trimmed = await sharp(cleaned).trim({ threshold: 1 }).toBuffer();
  const tm = await sharp(trimmed).metadata();

  // 트림된 캐릭터를 400x400 캔버스에 꽉 차게(비율 유지) 리사이즈한다.
  // sharp는 composite보다 resize를 먼저 적용하므로 트림 결과를 직접 리사이즈해야 한다.
  await sharp(trimmed)
    .resize(400, 400, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(assetsDir, name + '.png'));

  console.log(name, '->', tm.width + 'x' + tm.height, '-> 400x400');
}

async function main() {
  for (const f of FILES) await process(f);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
