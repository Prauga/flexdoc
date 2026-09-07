export interface ApiClientEditorCaretPosition {
  left: number;
  top: number;
  bottom: number;
}

export function apiClientEditorCaretPosition(textarea: HTMLTextAreaElement, position: number): ApiClientEditorCaretPosition {
  const style = window.getComputedStyle(textarea);
  const rect = textarea.getBoundingClientRect();
  const mirror = document.createElement('div');
  mirror.style.position = 'fixed';
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.left = `${rect.left}px`;
  mirror.style.top = `${rect.top}px`;
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.height = `${textarea.clientHeight}px`;
  mirror.style.overflow = 'hidden';
  mirror.style.whiteSpace = style.whiteSpace;
  mirror.style.overflowWrap = style.overflowWrap;
  mirror.style.wordBreak = style.wordBreak;
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.fontStyle = style.fontStyle;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.tabSize = style.tabSize;

  const before = document.createTextNode(textarea.value.slice(0, position));
  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  mirror.append(before, marker);
  document.body.appendChild(mirror);
  const markerRect = marker.getBoundingClientRect();
  const lineHeight = Number.parseFloat(style.lineHeight) || 24;
  const result = {
    left: markerRect.left - textarea.scrollLeft,
    top: markerRect.top - textarea.scrollTop,
    bottom: markerRect.top - textarea.scrollTop + lineHeight,
  };
  mirror.remove();
  return result;
}
