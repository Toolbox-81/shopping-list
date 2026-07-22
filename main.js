/* ==========================================================================
   앱 진입점 (main.js)
   --------------------------------------------------------------------------
   흐름: 익명 로그인 -> Supabase에서 데이터 로드 -> 화면 렌더 -> 이벤트 연결
   이후 사용자 조작(추가/수정/삭제/체크/보내기)이 있을 때마다
     1) Supabase에 반영 (itemsService / historyService)
     2) 로컬 state 갱신
     3) 화면 다시 그리기
   순서로 동작한다.
   ========================================================================== */
import { state } from "./state.js";
import { ensureAnonymousSession } from "./supabaseClient.js";
import {
  fetchItems,
  insertItem,
  insertItems,
  updateItemName as updateItemNameRemote,
  updateItemChecked,
  deleteItemById,
  resetCheckedByIds,
} from "./itemsService.js";
import { DEFAULT_ITEMS } from "./defaultItems.js";
import {
  fetchRecentHistory,
  insertHistory,
  deleteExpiredHistory,
} from "./historyService.js";
import { renderChecklist, renderHistory, applyEditingUI, el } from "./render.js";
import { buildShareMessage, shareOrCopy } from "./share.js";

/* --------------------------------------------------------------------------
   추가 DOM 참조 (index.html의 정적 요소들)
   -------------------------------------------------------------------------- */
const ui = {
  editToggleBtn: document.getElementById("editToggleBtn"),
  showAddFormBtn: document.getElementById("showAddFormBtn"),
  seedDefaultsBtn: document.getElementById("seedDefaultsBtn"),
  addItemForm: document.getElementById("addItemForm"),
  newItemInput: document.getElementById("newItemInput"),
  sendBtn: document.getElementById("sendBtn"),
  toast: document.getElementById("toast"),
  loadingOverlay: document.getElementById("loadingOverlay"),
};

/* --------------------------------------------------------------------------
   토스트 (짧은 안내 메시지)
   -------------------------------------------------------------------------- */
function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    ui.toast.hidden = true;
  }, 1800);
}

/* --------------------------------------------------------------------------
   화면 다시 그리기 헬퍼 (체크리스트용 handlers를 한 곳에서 정의)
   -------------------------------------------------------------------------- */
const checklistHandlers = {
  onToggleCheck: handleToggleCheck,
  onRename: handleRenameItem,
  onDelete: handleDeleteItem,
};

function redrawChecklist() {
  renderChecklist(checklistHandlers);
}

/* --------------------------------------------------------------------------
   품목 CRUD 핸들러
   -------------------------------------------------------------------------- */
async function handleAddItem(rawName) {
  const name = rawName.trim();
  if (!name) return;

  try {
    const created = await insertItem(name);
    state.items.push(created);
    redrawChecklist();
  } catch (err) {
    console.error(err);
    showToast("품목 추가에 실패했어요");
  }
}

async function handleRenameItem(id, newName) {
  try {
    const updated = await updateItemNameRemote(id, newName);
    const item = state.items.find((it) => it.id === id);
    if (item) item.name = updated.name;
    redrawChecklist();
  } catch (err) {
    console.error(err);
    showToast("품목 수정에 실패했어요");
    redrawChecklist();
  }
}

async function handleDeleteItem(id) {
  // 낙관적 업데이트: 화면에서 먼저 지우고, 실패하면 다시 불러와 복구
  const before = state.items;
  state.items = state.items.filter((it) => it.id !== id);
  redrawChecklist();

  try {
    await deleteItemById(id);
  } catch (err) {
    console.error(err);
    showToast("삭제에 실패했어요");
    state.items = before;
    redrawChecklist();
  }
}

async function handleToggleCheck(id) {
  const item = state.items.find((it) => it.id === id);
  if (!item) return;

  const nextChecked = !item.checked;
  item.checked = nextChecked; // 낙관적 업데이트로 즉각 반응
  redrawChecklist();

  try {
    await updateItemChecked(id, nextChecked);
  } catch (err) {
    console.error(err);
    showToast("체크 상태 저장에 실패했어요");
    item.checked = !nextChecked; // 실패 시 롤백
    redrawChecklist();
  }
}

/**
 * 기본 품목 목록(js/defaultItems.js)을 한 번에 불러온다.
 * 이미 등록되어 있는 이름(공백/대소문자 무시하고 비교)은 건너뛴다.
 */
async function handleSeedDefaults() {
  const existingNames = new Set(
    state.items.map((it) => it.name.trim().toLowerCase())
  );
  const namesToAdd = DEFAULT_ITEMS.filter(
    (name) => !existingNames.has(name.trim().toLowerCase())
  );

  if (namesToAdd.length === 0) {
    showToast("이미 모든 기본 품목이 등록되어 있어요");
    return;
  }

  try {
    const created = await insertItems(namesToAdd);
    state.items.push(...created);
    redrawChecklist();
    showToast(`${created.length}개 품목을 추가했어요`);
  } catch (err) {
    console.error(err);
    showToast("기본 품목 불러오기에 실패했어요");
  }
}

/* --------------------------------------------------------------------------
   편집 모드 토글
   -------------------------------------------------------------------------- */
function toggleEditingMode() {
  state.isEditing = !state.isEditing;
  applyEditingUI();
}

/* --------------------------------------------------------------------------
   보내기 (체크된 품목만 전송 + 히스토리 기록 + 체크 초기화)
   -------------------------------------------------------------------------- */
async function handleSend() {
  const checkedItems = state.items.filter((it) => it.checked);
  if (checkedItems.length === 0) {
    showToast("체크된 품목이 없어요");
    return;
  }

  const names = checkedItems.map((it) => it.name);
  const message = buildShareMessage(names);

  const result = await shareOrCopy(message);
  if (result.method === "cancelled") {
    return; // 사용자가 공유를 취소한 경우: 히스토리도 남기지 않고 종료
  }
  if (result.method === "fail") {
    showToast("공유/복사에 실패했어요");
    return;
  }
  showToast(result.method === "share" ? "보냈어요" : "클립보드에 복사했어요");

  // 히스토리 기록
  try {
    const entry = await insertHistory(names);
    state.history.unshift(entry);
    renderHistory();
  } catch (err) {
    console.error(err);
    showToast("히스토리 저장에 실패했어요");
  }

  // 보낸 품목들의 체크 표시 초기화
  const idsToReset = checkedItems.map((it) => it.id);
  checkedItems.forEach((it) => (it.checked = false));
  redrawChecklist();

  try {
    await resetCheckedByIds(idsToReset);
  } catch (err) {
    console.error(err);
    // 초기화 저장 실패는 치명적이지 않으므로 조용히 로그만 남김
  }
}

/* --------------------------------------------------------------------------
   이벤트 바인딩
   -------------------------------------------------------------------------- */
function bindEvents() {
  ui.editToggleBtn.addEventListener("click", toggleEditingMode);

  ui.showAddFormBtn.addEventListener("click", () => {
    ui.addItemForm.hidden = false;
    ui.showAddFormBtn.hidden = true;
    ui.newItemInput.focus();
  });

  ui.addItemForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleAddItem(ui.newItemInput.value);
    ui.newItemInput.value = "";
    ui.newItemInput.focus(); // 여러 품목을 연속으로 추가하기 편하도록 포커스 유지
  });

  ui.sendBtn.addEventListener("click", handleSend);

  ui.seedDefaultsBtn.addEventListener("click", handleSeedDefaults);
}

/* --------------------------------------------------------------------------
   초기화
   -------------------------------------------------------------------------- */
async function init() {
  try {
    const user = await ensureAnonymousSession();
    state.userId = user.id;

    // 클라이언트 측 보조 삭제 (pg_cron이 아직 반영 전이어도 최신 3일만 보이도록)
    await deleteExpiredHistory();

    const [items, history] = await Promise.all([
      fetchItems(),
      fetchRecentHistory(),
    ]);
    state.items = items;
    state.history = history;

    redrawChecklist();
    renderHistory();
    bindEvents();
  } catch (err) {
    console.error("초기화 실패:", err);
    showToast("초기 데이터를 불러오지 못했어요. 새로고침 해주세요.");
  } finally {
    if (ui.loadingOverlay) ui.loadingOverlay.hidden = true;
  }
}

init();
