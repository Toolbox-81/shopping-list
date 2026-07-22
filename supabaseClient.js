/* ==========================================================================
   Supabase 클라이언트 초기화
   --------------------------------------------------------------------------
   - CDN(esm.sh)에서 supabase-js 를 ES 모듈로 불러온다. (별도 빌드/설치 불필요
     -> Cloudflare Pages에 정적 파일 그대로 올려도 동작함)
   - 로그인 화면 없이도 사용자별 데이터를 구분하기 위해 "익명 로그인
     (Anonymous Sign-in)"을 사용한다. 앱을 처음 열면 자동으로 익명 계정이
     생성되고, 이후에는 브라우저에 저장된 세션을 재사용한다.
   ========================================================================== */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,      // 세션을 localStorage에 저장 -> 다음 방문 시 재로그인 불필요
    autoRefreshToken: true,
  },
});

/**
 * 익명 세션을 보장한다.
 * - 이미 세션이 있으면 그대로 재사용
 * - 없으면 새로 익명 로그인을 시도
 *
 * 주의: Supabase 대시보드 > Authentication > Providers 에서
 *       "Anonymous Sign-Ins" 를 활성화해야 정상 동작한다.
 *
 * @returns {Promise<import('@supabase/supabase-js').User>}
 */
export async function ensureAnonymousSession() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    return sessionData.session.user;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error("익명 로그인 실패:", error.message);
    throw new Error(
      "로그인에 실패했습니다. Supabase 대시보드에서 Anonymous Sign-In이 " +
        "활성화되어 있는지 확인해주세요."
    );
  }
  return data.user;
}
