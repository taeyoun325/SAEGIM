// 실험 기능: "새김"을 계속할수록 함께 자라는 캐릭터.
// 개발자 서버 모드(관리자 계정에서만 보임)에서만 노출되는 시험용 기능이다.
//
// v1은 일부러 이모지로만 단계를 표현한다. 실제 성장형 캐릭터 스프라이트는
// 별도 그림 자산(여러 장, 애니메이션 고려)이 필요해 이번 틀 작업 범위를
// 넘어선다 — 조사한 무료(CC0) 소스는 아래에 남겨둔다. 다음 단계(Opus 등
// 더 큰 작업으로)에서 이 중 하나를 받아 src/assets에 넣고, 이모지 자리를
// 실제 이미지 require()로 바꾸면 된다.
//
// 조사한 무료 CC0 후보 (전부 상업적 이용 포함 자유 라이선스):
// - Shibu Front Sprites (Openmon Monster Sprites) — screensmith.itch.io
//   이벌리(Eevee)식으로 하나의 기본형에서 여러 진화형이 갈라지는 라인.
//   https://screensmith.itch.io/shibu-front-sprites-openmon-monster
// - CP50 — 30 Pixel RE Fantasy (Pixel Material Studio) — 3단계 진화 세트,
//   그중 한 세트는 무료로 제공됨.
//   https://pixelartmaterial.itch.io/cp50-30-pixel-re-fantasy-png-smlll
// - Kenney.nl — CC0 자산 4만여 개, 게임에 바로 쓸 수 있게 정리돼 있음.
//   https://kenney.nl (예: "Animal Pack", "Creature Mixer" 등에서 성장 단계로
//   쓸 만한 낱장을 직접 골라 조합하는 방식)

// 모든 종(constants/characterSpecies.ts)이 같은 성장 속도를 쓴다.
// 임계값은 기존 배지 체계(3/7/15/30/50/100)와 결이 맞게 잡은 1차 추정치다.
// 실제 사용자 데이터를 보며 조정이 필요할 수 있다(밸런싱은 다음 단계 과제).
export const STAGE_THRESHOLDS: number[] = [0, 3, 10, 30, 60, 100];
