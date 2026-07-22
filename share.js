/* ==========================================================================
   공유 메시지 생성 + Web Share API / 클립보드 복사
   ========================================================================== */

/** 체크된 품목명 배열로 공유용 텍스트를 만든다 */
export function buildShareMessage(names) {
  const lines = ["장보기 목록", ""];
  names.forEach((name) => lines.push(`✔ ${name}`));
  return lines.join("\n");
}

/**
 * Web Share API를 우선 사용하고, 지원하지 않거나 실패하면 클립보드 복사로 대체한다.
 * @returns {Promise<{ method: "share" | "copy" | "cancelled" | "fail" }>}
 */
export async function shareOrCopy(message) {
  if (navigator.share) {
    try {
      await navigator.share({ text: message });
      return { method: "share" };
    } catch (err) {
      // 사용자가 공유 시트를 닫은 경우(취소)는 실패로 취급하지 않음
      if (err && err.name === "AbortError") {
        return { method: "cancelled" };
      }
      // 공유 자체가 실패하면 아래에서 복사로 대체 시도
    }
  }

  const copied = await copyToClipboard(message);
  return { method: copied ? "copy" : "fail" };
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    console.error("클립보드 복사 실패:", e);
  }
  // 구형 브라우저 대비: 임시 textarea를 이용한 복사
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch (e) {
    console.error("클립보드 복사(대체 방식) 실패:", e);
    return false;
  }
}
