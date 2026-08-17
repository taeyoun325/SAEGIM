# 새김

매일 같은 글감으로 함께 쓰는 3줄 SNS.

**웹으로 바로 써보기**: https://saegim.web.app

## 기술 스택

- Expo (React Native) + TypeScript
- Firebase: Authentication, Firestore, Hosting
- EAS Build (Android AAB / iOS 빌드용, 로컬 Android Studio 불필요)

## 웹 배포

```bash
npm run deploy:web
```

- 배포 주소: `https://saegim.web.app`, `https://post-it-665d6.web.app` (동일한 사이트, 두 주소로 접속 가능)
- PWA 지원: 모바일 브라우저에서 "홈 화면에 추가"로 앱처럼 설치 가능
- `firebase.json`의 `ignore`에 `**/node_modules/**`를 넣지 말 것 — Expo가 폰트/아이콘을
  `dist/assets/node_modules/...` 경로로 내보내므로 그 규칙을 쓰면 에셋이 통째로 빠진다.

## 관리자 (신고 처리)

```bash
node scripts/set-admin.js add <이메일>     # 관리자 지정
node scripts/set-admin.js remove <이메일>  # 관리자 해제
node scripts/set-admin.js list             # 관리자 목록
```

관리자로 지정된 계정은 앱의 **설정 → 🛡️ 신고 관리**에서 미처리 신고를 확인하고,
신고된 게시물/댓글을 삭제하거나 "문제 없음"으로 처리할 수 있다.
`admins/{uid}` 문서는 보안 규칙상 클라이언트가 쓸 수 없어 이 스크립트로만 지정 가능하다.

## 시작하기

### 1. Firebase 프로젝트 연결

1. https://console.firebase.google.com 에서 프로젝트를 열고 웹 앱을 추가한다 (아직 없다면 "앱 추가 → 웹").
2. 발급된 설정값으로 `.env` 파일을 만든다 (`.env.example` 참고):

   ```bash
   cp .env.example .env
   ```

3. `.env`에 `EXPO_PUBLIC_FIREBASE_*` 값을 채운다.
4. Firebase Console에서 다음을 활성화한다:
   - Authentication → 이메일/비밀번호 로그인
   - Firestore Database (프로덕션 모드로 생성)
   - Storage

### 2. 보안 규칙 배포

```bash
npm install -g firebase-tools
firebase login
firebase use --add   # 프로젝트 선택
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 3. 오늘의 글감 시드 (개발용)

Cloud Functions로 AI 글감을 자동 생성하기 전까지, 아래 스크립트로 미리 글감을 채워둔다.
Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 후 `serviceAccountKey.json`으로 저장한다 (git에 커밋하지 않는다).

```bash
npm install firebase-admin --no-save
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node scripts/seed-prompts.js 30
```

### 4. 앱 실행

```bash
npm install
npm run web       # 브라우저에서 빠르게 확인
npx expo start    # QR코드로 Expo Go 실기기 테스트
```

## 폴더 구조

```
src/
  assets/      마스코트 "새미" 이미지 (화면별 포즈)
  components/  Text/TextInput 래퍼(공통 폰트), 마스코트, 오프라인 배너 등
  config/      firebase 초기화
  constants/   글자수 제한(config.ts), 테마(theme.ts), 앱 정보(appInfo.ts), 글감 풀(promptPool.ts)
  context/     AuthContext, DialogContext
  hooks/       useResponsive (데스크톱/모바일 분기)
  navigation/  스택/탭 네비게이터
  screens/     화면
  services/    Firestore CRUD + 닉네임/계정/초안/알림/온보딩
  types/       데이터 모델
  utils/       날짜/닉네임 유틸
docs/          개인정보처리방침 공개용 HTML
scripts/       개발용 스크립트 (글감 시드, 아이콘/마스코트 생성, e2e 테스트)
```

## 검증 방법

```bash
npx tsc --noEmit                      # 타입 체크
node scripts/e2e-two-users.mjs        # User A/B 통합 테스트 (실제 Firebase, 30개 검증)
node scripts/e2e-rate-limit.mjs       # 도배 방지 쿨다운 규칙 검증 (우회 시도 차단 확인)
node scripts/verify-prompt-fallback.mjs  # 글감 폴백 결정론성 검증
```

## 도배 방지 (쿨다운)

보안 규칙은 요청마다 상태가 없어서, `rateLimits/{uid}/actions/{action}` 문서에 마지막 시각을
남겨 쿨다운을 건다. 핵심은 **클라이언트가 시각을 위조할 수 없게** 하는 것이다.

- 쿨다운 문서에는 서버 시각(`request.time`)만 쓸 수 있고, 삭제는 규칙으로 막혀 있다.
- 글/댓글 생성은 **쿨다운 기록과 같은 배치(원자적 커밋)** 로 보내야 통과한다
  (규칙이 `getAfter()`로 이 커밋에서 갱신됐는지 확인한다). `src/services/rateLimitService.ts` 참고.
- 현재 쿨다운: 댓글 15초 / 글 60초.
- 좋아요는 문서 ID가 `${postId}_${userId}`라 중복 자체가 불가능해 별도 제한이 없다.
- 남은 한계: "글감당 한 편"은 앱에서만 강제하고 규칙에서는 못 막는다(규칙에서 쿼리 불가).

## 다크모드

기기의 다크모드 설정을 **앱 실행 시점에 한 번** 읽어 팔레트를 고른다
(`src/constants/theme.ts`의 `isDarkMode`). 29개 화면이 `StyleSheet.create`에 색을 구워넣는
구조라 실행 중 전환은 하지 않는다 — 테마를 바꾸면 앱 재시작(웹은 새로고침)이 필요하다.

- 다크 팔레트 대비는 브라우저에서 실측해 맞췄다(라이트 대비 회귀 없음).
- `primary`는 제목 텍스트와 버튼 배경(흰 글자)을 겸하므로 중간 톤이어야 한다. 밝게 바꾸면
  버튼 글자가 사라지니 값을 고칠 때 양쪽 대비를 함께 확인할 것.
- 공유 카드는 SNS로 나가는 산출물이라 기기 테마를 따르지 않고 라이트 팔레트로 고정한다.

## 분석 이벤트

Firebase Analytics(JS SDK)는 웹 전용이고 GA4 데이터를 앱에서 되읽을 수도 없어서,
이미 쓰던 `dailyStats` 카운터를 확장해 퍼널 이벤트를 쌓는다(`src/services/statsService.ts`).

- 이벤트 하나 = 문서 쓰기 하나이므로 탭 단위가 아니라 퍼널 분기점만 굵게 남긴다.
- `openUserIds`(앱 실행)로 실제 DAU/WAU/MAU를, `activeUserIds`(글 작성)로 작성자 지표를 낸다.
- 관리자 대시보드에서 퍼널·전환율을 바로 확인할 수 있다.

## 글감 운영

글감은 Firestore `prompts` 문서를 우선 사용하고, 없으면 `src/constants/promptPool.ts`에서
**날짜 기반으로 결정론적으로** 하나를 고릅니다. 덕분에 서버 없이도 모든 사용자가 같은 날 같은
글감을 보고, 시드가 소진돼도 앱이 멈추지 않습니다.

- 특정 날짜에 원하는 글감을 넣고 싶으면: `node scripts/seed-prompts.js <일수>`
- 글감을 추가할 때는 `promptPool.ts` **배열 맨 끝에만** 추가하세요. 중간에 끼워 넣으면 과거 날짜의
  글감이 바뀝니다.

## 개인정보처리방침 URL 배포 (Play Console 필수)

`docs/privacy.html`을 공개 주소로 올려야 합니다. GitHub Pages가 가장 간단합니다.

1. GitHub에 이 저장소를 push
2. 저장소 Settings → Pages → Source: `main` 브랜치 / `/docs` 폴더 선택
3. 발급된 주소(`https://<아이디>.github.io/<저장소>/privacy.html`)를
   `src/constants/appInfo.ts`의 `PRIVACY_POLICY_URL`과 Play Console에 입력

## 확정된 출시 정보

| 항목 | 값 |
|---|---|
| 앱 이름 | 새김 |
| 패키지명 (Android/iOS 공통) | `com.saegimsemi.saegim` |
| 문의 이메일 | `saegimsemi@gmail.com` |
| versionName / versionCode | `1.0.0` / `1` |

### 아직 남은 교체 항목

`src/constants/appInfo.ts`의 `PRIVACY_POLICY_URL` 하나만 남았습니다.
아래 GitHub Pages 배포를 마치고 발급된 주소로 교체하세요.

## 현재 진행 상태

- [x] Phase 1~9: 인증/글감/작성/게시/피드/좋아요·댓글/기록·프로필/신고·차단 — 실제 Firebase로 검증 완료
- [x] Phase 10: 글감 운영 (2년치 시드 + 날짜 기반 폴백)
- [x] 시작화면, 마스코트, 캘린더, 데스크톱 웹 레이아웃
- [x] 댓글 신고, 계정 삭제 시 콘텐츠 완전 삭제, 닉네임 유니크, 온보딩 1회, 오프라인 감지
- [ ] Phase 11: 실기기 테스트 — **안드로이드 기기 필요**
- [ ] Phase 12: Release AAB 빌드 — **expo.dev 계정(무료) 필요**
- [ ] Phase 13: Google Play 출시 — **개발자 계정 $25 필요**

## 다음 단계

1. `app.json` 패키지명 확정, `appInfo.ts` 이메일/방침 URL 교체
2. `docs/privacy.html`을 GitHub Pages로 배포
3. `npx expo start` → Expo Go로 실기기 테스트 (Phase 11)
4. `npx eas build -p android --profile production` → AAB 생성 (Phase 12)
