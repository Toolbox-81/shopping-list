/* ==========================================================================
   history 테이블 관련 Supabase 통신 함수
   --------------------------------------------------------------------------
   히스토리는 "최근 3일"만 보여주고, 3일이 지난 기록은 자동으로 사라져야 한다.
   1차 삭제 담당: supabase/schema.sql 의 pg_cron 스케줄 (매시 정각 서버에서 삭제)
   2차 안전장치: 아래 deleteExpiredHistory() -> 앱 실행 시마다 클라이언트에서도
                한 번 더 만료 데이터를 정리한다. (pg_cron이 아직 못 켜졌거나
                지연되는 경우 대비)
   ========================================================================== */
import { supabase } from "./supabaseClient.js";

const RETENTION_DAYS = 3;

function cutoffIso() {
  return new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** 최근 3일 이내에 보낸 기록만 최신순으로 가져온다 */
export async function fetchRecentHistory() {
  const { data, error } = await supabase
    .from("history")
    .select("*")
    .gte("sent_at", cutoffIso())
    .order("sent_at", { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * 새 히스토리 기록 추가
 * @param {string[]} names 이번에 보낸 품목명 배열
 */
export async function insertHistory(names) {
  const { data, error } = await supabase
    .from("history")
    .insert({ items: names })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** 클라이언트 측 보조 삭제: 3일이 지난 기록을 정리 (실패해도 앱 사용에는 지장 없음) */
export async function deleteExpiredHistory() {
  const { error } = await supabase.from("history").delete().lt("sent_at", cutoffIso());
  if (error) {
    // 이 삭제는 보조 수단이므로 실패해도 화면에 에러를 노출하지 않고 콘솔에만 기록
    console.error("만료된 히스토리 삭제 중 오류:", error.message);
  }
}
