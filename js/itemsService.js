/* ==========================================================================
   items 테이블 관련 Supabase 통신 함수
   --------------------------------------------------------------------------
   화면(render.js)이나 이벤트 처리(main.js)에서는 이 함수들만 호출하고,
   실제 Supabase 쿼리 문법은 이 파일 안에만 존재하도록 분리했다.
   (나중에 API가 바뀌어도 이 파일만 수정하면 됨)
   ========================================================================== */
import { supabase } from "./supabaseClient.js";

/**
 * 내(익명 유저) 품목 전체를 등록순으로 가져온다.
 * RLS 정책이 자동으로 "내 데이터만" 필터링해준다.
 */
export async function fetchItems() {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

/** 새 품목 추가 */
export async function insertItem(name) {
  const { data, error } = await supabase
    .from("items")
    .insert({ name })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** 품목명 수정 */
export async function updateItemName(id, name) {
  const { data, error } = await supabase
    .from("items")
    .update({ name })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * 여러 품목을 한 번에 추가한다. (기본 품목 불러오기 등에서 사용)
 * @param {string[]} names 추가할 품목명 배열
 * @returns {Promise<object[]>} 생성된 품목 row 배열
 */
export async function insertItems(names) {
  if (!names || names.length === 0) return [];
  const { data, error } = await supabase
    .from("items")
    .insert(names.map((name) => ({ name })))
    .select();

  if (error) throw error;
  return data;
}

/** 체크 상태 토글/변경 */
export async function updateItemChecked(id, checked) {
  const { error } = await supabase
    .from("items")
    .update({ checked })
    .eq("id", id);

  if (error) throw error;
}

/** 품목 삭제 */
export async function deleteItemById(id) {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw error;
}

/**
 * 보내기 완료 후, 보낸 품목들의 체크 표시를 한 번에 초기화한다.
 * @param {string[]} ids 초기화할 품목 id 목록
 */
export async function resetCheckedByIds(ids) {
  if (!ids || ids.length === 0) return;
  const { error } = await supabase
    .from("items")
    .update({ checked: false })
    .in("id", ids);

  if (error) throw error;
}
