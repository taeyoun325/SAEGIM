// 앱에 들어가는 PNG를 팔레트 방식으로 다시 인코딩해 용량을 줄인다.
// 크기(400x400)와 그림 자체는 그대로 두고 색 표현 방식만 바꾸는 것이라
// 여러 번 실행해도 더 나빠지지 않는다.
//
// 새미 그림은 색 수가 많지 않은 일러스트라서 팔레트 PNG로 바꾸면 용량이 크게 준다.
// 바꾼 뒤 밝은 배경과 어두운 배경 양쪽에 합성해 원본과 픽셀 차이를 재고,
// 눈에 띌 정도로 달라지면 그 파일은 건너뛴다.
//
// 실행: node scripts/optimize-images.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'src', 'assets');

// 평균 오차가 이 값을 넘으면 품질 저하로 보고 원본을 유지한다(255 기준).
const MAX_ACCEPTABLE_MAE = 2.0;

async function measureDifference(originalBuffer, candidateBuffer, width, height) {
  // 알파가 있는 그림이라 배경에 따라 차이가 다르게 보인다. 라이트/다크 양쪽에서 잰다.
  const grounds = [
    { r: 255, g: 251, b: 245 },
    { r: 26, g: 23, b: 20 },
  ];
  let worstMae = 0;
  for (const background of grounds) {
    const [a, b] = await Promise.all(
      [originalBuffer, candidateBuffer].map((buf) =>
        sharp({ create: { width, height, channels: 3, background } })
          .composite([{ input: buf }])
          .raw()
          .toBuffer()
      )
    );
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
    worstMae = Math.max(worstMae, sum / a.length);
  }
  return worstMae;
}

async function optimize(file) {
  const filePath = path.join(assetsDir, file);
  const original = fs.readFileSync(filePath);
  const { width, height } = await sharp(original).metadata();

  const candidate = await sharp(original).png({ palette: true, quality: 100, effort: 10 }).toBuffer();

  if (candidate.length >= original.length) {
    console.log(`${file.padEnd(24)} 그대로 (이미 충분히 작음)`);
    return { before: original.length, after: original.length };
  }

  const mae = await measureDifference(original, candidate, width, height);
  if (mae > MAX_ACCEPTABLE_MAE) {
    console.log(`${file.padEnd(24)} 건너뜀 (평균오차 ${mae.toFixed(2)} > ${MAX_ACCEPTABLE_MAE})`);
    return { before: original.length, after: original.length };
  }

  fs.writeFileSync(filePath, candidate);
  const saved = ((1 - candidate.length / original.length) * 100).toFixed(0);
  console.log(
    `${file.padEnd(24)} ${(original.length / 1024).toFixed(1).padStart(7)}KB → ${(candidate.length / 1024)
      .toFixed(1)
      .padStart(6)}KB  (-${saved}%, 평균오차 ${mae.toFixed(2)})`
  );
  return { before: original.length, after: candidate.length };
}

async function main() {
  const files = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.png'));
  let before = 0;
  let after = 0;
  for (const file of files) {
    const result = await optimize(file);
    before += result.before;
    after += result.after;
  }
  console.log(
    `\n합계 ${(before / 1024).toFixed(1)}KB → ${(after / 1024).toFixed(1)}KB ` +
      `(-${((1 - after / before) * 100).toFixed(0)}%, ${((before - after) / 1024).toFixed(0)}KB 절약)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
