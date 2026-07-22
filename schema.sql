-- ============================================================================
-- 재고 부족 / 장보기 체크리스트 - Supabase 스키마
-- ----------------------------------------------------------------------------
-- 실행 방법: Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 실행
--
-- 인증 방식: Supabase Anonymous Sign-in (로그인 없이 기기별로 익명 계정 생성)
--   -> 반드시 Dashboard > Authentication > Providers > Anonymous Sign-Ins
--      를 "Enable" 로 켜야 앱이 정상 동작합니다.
--   -> 이 방식으로 auth.uid() 가 생기기 때문에, 별도 회원가입 없이도
--      사용자(기기)별로 데이터가 분리되고 RLS로 안전하게 보호됩니다.
-- ============================================================================

-- gen_random_uuid() 함수를 사용하기 위한 확장 (Supabase는 기본 활성화되어 있는 경우가 많음)
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. items 테이블 : 품목(재고) 목록
-- ----------------------------------------------------------------------------
create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),   -- 소유자(익명 유저) id
  name        text not null,                       -- 품목명 (예: 계란)
  checked     boolean not null default false,      -- 체크 여부
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.items is '재고 부족 / 장보기 품목 목록';

-- updated_at 자동 갱신 트리거
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_items_updated_at on public.items;
create trigger trg_items_updated_at
before update on public.items
for each row
execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. history 테이블 : 보내기 기록 (최근 3일만 유지)
-- ----------------------------------------------------------------------------
create table if not exists public.history (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid(),
  items     jsonb not null,          -- 그 당시 보낸 품목명 배열. 예: ["우유","라면"]
  sent_at   timestamptz not null default now()
);

comment on table public.history is '체크한 품목을 보낸 기록. 3일이 지나면 자동 삭제됨';

-- 조회 성능을 위한 인덱스
create index if not exists idx_items_user_id on public.items (user_id);
create index if not exists idx_history_user_id_sent_at on public.history (user_id, sent_at desc);

-- ----------------------------------------------------------------------------
-- 3. RLS (Row Level Security) : 본인(auth.uid()) 데이터만 읽고 쓸 수 있도록 제한
-- ----------------------------------------------------------------------------
alter table public.items   enable row level security;
alter table public.history enable row level security;

-- items 정책 -----------------------------------------------------------------
drop policy if exists items_select_own on public.items;
create policy items_select_own
  on public.items for select
  using (auth.uid() = user_id);

drop policy if exists items_insert_own on public.items;
create policy items_insert_own
  on public.items for insert
  with check (auth.uid() = user_id);

drop policy if exists items_update_own on public.items;
create policy items_update_own
  on public.items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists items_delete_own on public.items;
create policy items_delete_own
  on public.items for delete
  using (auth.uid() = user_id);

-- history 정책 (기록은 수정하지 않으므로 select/insert/delete 만 허용) --------
drop policy if exists history_select_own on public.history;
create policy history_select_own
  on public.history for select
  using (auth.uid() = user_id);

drop policy if exists history_insert_own on public.history;
create policy history_insert_own
  on public.history for insert
  with check (auth.uid() = user_id);

drop policy if exists history_delete_own on public.history;
create policy history_delete_own
  on public.history for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. 히스토리 3일 후 자동 삭제 (서버 측 스케줄러: pg_cron)
-- ----------------------------------------------------------------------------
-- 주의: pg_cron 확장은 Supabase 대시보드 > Database > Extensions 에서
--       먼저 활성화해야 아래 구문이 에러 없이 실행됩니다.
--       (무료 플랜에서도 사용 가능하지만, 프로젝트 리전에 따라 다를 수 있어
--        만약 활성화가 안 된다면 클라이언트 측 보조 삭제 로직이 대신 처리합니다.
--        -> js/historyService.js 의 deleteExpiredHistory() 참고)
create extension if not exists pg_cron;

select cron.schedule(
  'delete-old-history',        -- job 이름
  '0 * * * *',                 -- 매시 정각 실행
  $$ delete from public.history where sent_at < now() - interval '3 days'; $$
);

-- ============================================================================
-- 여기까지 실행하면 준비 완료.
-- 이후 js/config.js 에 Project URL 과 Publishable(anon) Key 를 넣고 배포하면 됩니다.
-- ============================================================================
