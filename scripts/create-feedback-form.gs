/**
 * 새김 테스터 피드백 구글 폼 생성 스크립트
 *
 * 사용법:
 *   1. https://script.google.com 에서 새 프로젝트를 만든다
 *   2. 이 파일 내용을 통째로 붙여넣는다
 *   3. createSaegimFeedbackForm 함수를 실행한다 (첫 실행 시 권한 승인 필요)
 *   4. 실행 로그에 찍히는 공개 링크를 테스터에게 보낸다
 *
 * 문항 원고: docs/feedback-form.md
 */

// 파일 업로드 문항은 응답자에게 구글 로그인을 강제해 익명성이 깨진다.
// 스크린샷을 꼭 폼으로 받아야 할 때만 true 로 바꾼다.
var INCLUDE_FILE_UPLOAD = false;

var FEATURES = [
  '매일 하나씩 도착하는 글감',
  '스티커를 떼면 글감이 보이는 연출',
  '3줄 제한',
  '다른 사람들의 생각을 보는 피드',
  '좋아요 / 댓글',
  '캘린더로 지난 기록 돌아보기',
  '연속 새김(스트릭)',
  '프로필 통계',
  '나만 보기 / 공개 전환',
];

function createSaegimFeedbackForm() {
  var form = FormApp.create('새김 테스트 피드백');

  form.setDescription(
    '새김을 테스트해 주셔서 감사합니다.\n\n' +
    '3분이면 충분합니다. 솔직할수록 도움이 됩니다 — 좋았던 점보다\n' +
    '불편했던 점이 훨씬 값집니다. 익명이라 이름은 남지 않습니다.\n\n' +
    '문의: saegimsemi@gmail.com'
  );

  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setProgressBar(true);
  form.setConfirmationMessage('소중한 의견 감사합니다! 새김을 더 낫게 만드는 데 쓰겠습니다. 🌱');

  // ── 1부. 어떻게 사용하셨나요 ───────────────────────────────
  form.addPageBreakItem().setTitle('1. 어떻게 사용하셨나요');

  form.addMultipleChoiceItem()
    .setTitle('어떤 환경에서 사용하셨나요?')
    .setChoiceValues([
      '안드로이드 폰 (Play 스토어 설치)',
      '안드로이드 태블릿',
      '웹 브라우저 (saegim.web.app)',
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('며칠 정도 써보셨나요?')
    .setChoiceValues(['오늘 처음 써봤어요', '2~3일', '4~7일', '일주일 이상'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('하루에 보통 몇 번 열어보셨나요?')
    .setChoiceValues(['거의 안 열었어요', '하루 1번', '하루 2~3번', '그보다 자주']);

  // ── 2부. 사용 경험 ────────────────────────────────────────
  form.addPageBreakItem().setTitle('2. 사용 경험');

  form.addScaleItem()
    .setTitle('전반적으로 얼마나 만족하셨나요?')
    .setBounds(1, 5)
    .setLabels('별로예요', '아주 좋아요')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('앱을 처음 켰을 때, 무엇을 하는 앱인지 바로 이해되었나요?')
    .setChoiceValues(['바로 이해했어요', '좀 헤맸지만 금방 알았어요', '뭘 해야 할지 몰랐어요'])
    .setRequired(true);

  form.addScaleItem()
    .setTitle('"오늘의 글감으로 3줄 쓰기"라는 흐름이 자연스러웠나요?')
    .setBounds(1, 5)
    .setLabels('부담스러웠어요', '딱 좋았어요');

  form.addCheckboxItem()
    .setTitle('마음에 든 기능을 모두 골라주세요.')
    .setChoiceValues(FEATURES)
    .showOtherOption(true);

  form.addCheckboxItem()
    .setTitle('불편하거나 아쉬웠던 부분을 모두 골라주세요.')
    .setChoiceValues(FEATURES.concat(['딱히 없었어요']))
    .showOtherOption(true);

  form.addParagraphTextItem()
    .setTitle('위에서 고른 항목, 구체적으로 어떤 점이 불편했나요?');

  // ── 3부. 오류 신고 ────────────────────────────────────────
  form.addPageBreakItem().setTitle('3. 오류 신고');

  form.addMultipleChoiceItem()
    .setTitle('오류나 이상한 동작을 겪으셨나요?')
    .setChoiceValues(['아니요, 없었어요', '네, 있었어요'])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('(있었다면) 어떤 상황에서 무슨 일이 있었나요?')
    .setHelpText('어느 화면에서, 무엇을 눌렀을 때, 어떻게 됐는지 적어주시면 큰 도움이 됩니다.');

  form.addMultipleChoiceItem()
    .setTitle('앱이 느리거나 멈춘 적이 있나요?')
    .setChoiceValues(['없었어요', '가끔 그랬어요', '자주 그랬어요']);

  if (INCLUDE_FILE_UPLOAD) {
    // 파일 업로드는 구글 로그인을 강제하므로 익명 응답이 불가능해진다.
    form.addFileUploadItem()
      .setTitle('화면 사진이 있다면 올려주세요.')
      .setHelpText('구글 로그인이 필요한 문항입니다.')
      .setMaxFiles(3);
  }

  // ── 4부. 마지막으로 ───────────────────────────────────────
  form.addPageBreakItem().setTitle('4. 마지막으로');

  form.addScaleItem()
    .setTitle('새김을 친구에게 추천할 의향은?')
    .setBounds(0, 10)
    .setLabels('전혀 아니다', '꼭 추천한다');

  form.addMultipleChoiceItem()
    .setTitle('테스트가 끝나도 계속 쓸 것 같나요?')
    .setChoiceValues(['계속 쓸 것 같아요', '가끔 열어볼 것 같아요', '안 쓸 것 같아요']);

  form.addParagraphTextItem()
    .setTitle('이런 기능이 있으면 좋겠다 싶은 게 있나요?');

  form.addParagraphTextItem()
    .setTitle('자유롭게 하고 싶은 말을 남겨주세요.');

  form.addTextItem()
    .setTitle('추가 질문을 드려도 괜찮다면 연락처를 남겨주세요.')
    .setHelpText('남기지 않으셔도 괜찮습니다.');

  Logger.log('테스터에게 보낼 링크: ' + form.getPublishedUrl());
  Logger.log('짧은 링크: ' + form.shortenFormUrl(form.getPublishedUrl()));
  Logger.log('응답/수정용 링크: ' + form.getEditUrl());
}
