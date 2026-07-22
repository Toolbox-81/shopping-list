# 재고 부족 / 장보기 체크리스트 (Supabase + Cloudflare Pages)

모바일 우선으로 만든 심플한 장보기 체크리스트 웹앱입니다.
데이터는 전부 Supabase에 저장되고, 정적 파일 그대로 Cloudflare Pages에 배포할 수 있습니다.

---

## 1. 프로젝트 구조

```
grocery-app-supabase/
├── index.html              # 화면 구조
├── css/
│   └── style.css           # 디자인 (흰 배경, 큰 글씨, 큰 체크박스, 모바일 최적화)
├── js/
│   ├── config.js           # Supabase URL / anon key 설정
│   ├── supabaseClient.js   # Supabase 클라이언트 생성 + 익명 로그인
│   ├── state.js            # 앱 전역 상태 (메모리 캐시)
│   ├── itemsService.js     # items 테이블 CRUD
│   ├── historyService.js   # history 테이블 CRUD + 3일 자동 삭제 보조 로직
│   ├── render.js            # DOM 렌더링
│   ├── share.js             # Web Share API + 클립보드 복사
│   └── main.js              # 앱 진입점 (초기화, 이벤트 바인딩)
├── supabase/
│   └── schema.sql           # 테이블 생성 + RLS 정책 + 자동 삭제 스케줄(pg_cron)
├── _headers                 # Cloudflare Pages 캐시 헤더
├── wrangler.toml             # (선택) CLI 배포용 설정
└── README.md
```

빌드 과정이 없는 순수 HTML/CSS/JS(ES Modules)라서, 파일을 그대로 정적 호스팅에 올리면 됩니다.

---

## 2. Supabase 설정

### 2-1. SQL 실행
Supabase 대시보드 → **SQL Editor** → `supabase/schema.sql` 파일 내용 전체를 붙여넣고 실행합니다.

이 스크립트가 하는 일:
- `items`, `history` 테이블 생성
- 두 테이블 모두 RLS(Row Level Security) 활성화 + "본인 데이터만" 접근 가능한 정책 생성
- `pg_cron`을 이용해 매시 정각마다 3일 지난 `history` 기록을 서버에서 자동 삭제

> `pg_cron` 확장이 아직 프로젝트에 활성화되어 있지 않다면, 대시보드 **Database → Extensions**에서
> `pg_cron`을 먼저 켠 뒤 SQL을 실행하세요. (혹시 못 켜더라도 앱이 실행될 때마다
> `js/historyService.js`의 `deleteExpiredHistory()`가 클라이언트에서 한 번 더 정리해주므로
> 기능은 정상 동작합니다.)

### 2-2. 익명 로그인 활성화 (필수)
이 앱은 별도 회원가입 화면 없이 **Supabase Anonymous Sign-in**으로 기기별 사용자를 구분합니다.

대시보드 → **Authentication → Sign In / Providers → Anonymous Sign-Ins** → **Enable** 로 켜주세요.
(이걸 켜지 않으면 로그인에 실패하고 데이터를 저장할 수 없습니다.)

### 2-3. 연결 정보
`js/config.js`에 이미 아래 값이 채워져 있습니다. 다른 프로젝트를 쓰신다면 이 파일만 수정하면 됩니다.

```js
export const SUPABASE_URL = "https://svitqfgaasukgllvdyjv.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_2sOGTCM0KMoRsyel6uhZ1w_XfI93Tf7";
```

Publishable(anon) key는 브라우저에 그대로 노출되어도 되도록 설계된 키입니다.
실제 데이터 보호는 SQL의 RLS 정책이 담당합니다.

---

## 3. 로컬에서 테스트하기

ES Modules(`type="module"`)를 쓰기 때문에 `file://`로 직접 열면 브라우저가 막을 수 있습니다.
아래처럼 간단한 로컬 서버를 띄워서 테스트하세요.

```bash
# 파이썬이 있다면
python3 -m http.server 8080

# 또는 Node가 있다면
npx serve .
```

이후 브라우저에서 `http://localhost:8080` 접속 (모바일 화면 테스트는 브라우저 개발자 도구의
반응형 모드 사용을 추천합니다).

---

## 4. Cloudflare Pages 배포

### 방법 A. 대시보드에서 Git 연동 (추천)
1. 이 프로젝트 폴더를 GitHub 저장소로 push
2. Cloudflare 대시보드 → **Workers & Pages → Create → Pages → Connect to Git**
3. 저장소 선택 후:
   - **Build command**: 비워둠 (빌드 불필요)
   - **Build output directory**: `/` (루트)
4. **Save and Deploy** 클릭 → 완료되면 `https://프로젝트명.pages.dev` 주소로 접속 가능

### 방법 B. Wrangler CLI로 바로 배포
```bash
npm install -g wrangler   # 최초 1회
cd grocery-app-supabase
npx wrangler pages deploy . --project-name=grocery-checklist
```

배포 후 안내되는 URL로 접속하면 바로 사용할 수 있습니다.

---

## 5. 기능 요약

| 기능 | 구현 위치 |
|---|---|
| 품목 추가 / 수정 / 삭제 | `js/itemsService.js`, `js/main.js` |
| 체크박스 (체크/해제) | `js/main.js` → `handleToggleCheck` |
| 체크한 품목만 보내기 (Web Share API, 미지원 시 복사) | `js/share.js` |
| 최근 보낸 목록(히스토리) | `js/historyService.js`, `js/render.js` |
| 히스토리 3일 후 자동 삭제 | `supabase/schema.sql` (pg_cron) + `deleteExpiredHistory()` 보조 |
| 모든 데이터 Supabase 저장 | `items`, `history` 테이블 (RLS로 사용자별 격리) |
| 모바일 최적화 / 반응형 | `css/style.css` (큰 글씨, 큰 체크박스, 하단 고정 보내기 버튼) |

---

## 6. 참고 / 향후 확장 아이디어
- 여러 사람이 같은 목록을 공유하려면: 익명 로그인 대신 이메일 로그인 + `household_id` 같은 공유 그룹 컬럼을 추가하고 RLS를 그룹 단위로 바꾸면 됩니다.
- 실시간 동기화(다른 기기에서 추가한 품목이 바로 보이게)가 필요하면 Supabase Realtime(`supabase.channel(...)`)을 `main.js`에 추가하면 됩니다.
