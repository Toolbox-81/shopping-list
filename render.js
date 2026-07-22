/* ==========================================================================
   화면 렌더링 (DOM 생성/갱신)
   --------------------------------------------------------------------------
   이 파일은 "state 안의 데이터를 화면에 어떻게 그릴지"만 담당한다.
   실제 클릭 시 무엇을 할지(Supabase 호출 등)는 main.js에서 handlers 객체로
   전달받아 사용한다.
   ========================================================================== */
import { state } from "./state.js";

export const el = {
  main: document.querySelector(".app-main"),
  checklist: document.getElementById("checklist"),
  emptyMessage: document.getElementById("emptyMessage"),
  historyList: document.getElementById("historyList"),
  historyEmptyMessage: document.getElementById("historyEmptyMessage"),
  editToggleBtn: document.getElementById("editToggleBtn"),
};

// 인라인 수정(Escape/빈값 취소) 시 동일한 handlers로 다시 그리기 위해 기억해둔다.
let lastHandlers = null;

/**
 * 체크리스트를 다시 그린다.
 * @param {Object} handlers
 * @param {(id:string)=>void} handlers.onToggleCheck   체크 토글
 * @param {(id:string, newName:string)=>void} handlers.onRename  이름 수정 확정
 * @param {(id:string)=>void} handlers.onDelete        삭제
 */
export function renderChecklist(handlers) {
  lastHandlers = handlers;
  el.checklist.innerHTML = "";

  if (state.items.length === 0) {
    el.emptyMessage.hidden = false;
    return;
  }
  el.emptyMessage.hidden = true;

  state.items.forEach((item) => {
    el.checklist.appendChild(renderChecklistRow(item, handlers));
  });
}

function renderChecklistRow(item, handlers) {
  const li = document.createElement("li");
  li.className = "checklist-item" + (item.checked ? " is-checked" : "");
  li.dataset.id = item.id;

  const nameBtn = document.createElement("button");
  nameBtn.type = "button";
  nameBtn.className = "item-name-btn";
  nameBtn.setAttribute("aria-pressed", String(item.checked));

  const box = document.createElement("span");
  box.className = "checkbox";
  box.setAttribute("aria-hidden", "true");
  box.textContent = item.checked ? "✓" : "";

  const nameSpan = document.createElement("span");
  nameSpan.className = "item-name-text";
  nameSpan.textContent = item.name;

  nameBtn.appendChild(box);
  nameBtn.appendChild(nameSpan);
  nameBtn.addEventListener("click", () => {
    if (state.isEditing) {
      startInlineEdit(li, item, handlers.onRename);
    } else {
      handlers.onToggleCheck(item.id);
    }
  });
  li.appendChild(nameBtn);

  // 편집 모드일 때만 CSS로 노출되는 삭제 버튼
  const actions = document.createElement("div");
  actions.className = "item-actions";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "icon-btn delete";
  deleteBtn.setAttribute("aria-label", `${item.name} 삭제`);
  deleteBtn.textContent = "🗑";
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onDelete(item.id);
  });

  actions.appendChild(deleteBtn);
  li.appendChild(actions);

  return li;
}

// 편집 모드에서 품목명을 탭하면 인라인 입력창으로 전환해 바로 수정할 수 있게 한다.
function startInlineEdit(li, item, onRename) {
  const nameBtn = li.querySelector(".item-name-btn");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "item-name-edit";
  input.value = item.name;
  input.maxLength = 20;

  nameBtn.replaceWith(input);
  input.focus();
  input.select();

  let settled = false; // blur/Escape 중복 처리 방지

  const cancel = () => {
    if (settled) return;
    settled = true;
    renderChecklist(lastHandlers); // 원래 상태로 다시 그리기
  };

  const commit = () => {
    if (settled) return;
    const newName = input.value.trim();
    if (newName && newName !== item.name) {
      settled = true;
      onRename(item.id, newName);
    } else {
      cancel();
    }
  };

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") cancel();
  });
}

/** 편집 모드 on/off에 따라 헤더 버튼 텍스트 및 클래스를 갱신한다 */
export function applyEditingUI() {
  el.main.classList.toggle("is-editing", state.isEditing);
  el.editToggleBtn.textContent = state.isEditing ? "완료" : "편집";
  el.editToggleBtn.setAttribute("aria-pressed", String(state.isEditing));
}

/** 히스토리 목록을 다시 그린다 (날짜별로 이미 정렬되어 들어온다고 가정) */
export function renderHistory() {
  el.historyList.innerHTML = "";

  if (state.history.length === 0) {
    el.historyEmptyMessage.hidden = false;
    return;
  }
  el.historyEmptyMessage.hidden = true;

  state.history.forEach((entry) => {
    const group = document.createElement("div");
    group.className = "history-group";

    const dateEl = document.createElement("div");
    dateEl.className = "history-date";
    dateEl.textContent = formatDateLabel(entry.sent_at);
    group.appendChild(dateEl);

    const itemsEl = document.createElement("div");
    itemsEl.className = "history-items";
    entry.items.forEach((name) => {
      const row = document.createElement("div");
      row.className = "history-item-row";
      row.textContent = name;
      itemsEl.appendChild(row);
    });
    group.appendChild(itemsEl);

    el.historyList.appendChild(group);
  });
}

function formatDateLabel(isoString) {
  const d = new Date(isoString);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
