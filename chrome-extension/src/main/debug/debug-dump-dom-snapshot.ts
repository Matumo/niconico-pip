/**
 * debug dump用DOM要約
 */
import type { DebugDumpObject, DebugDumpValue } from "./debug-dump-types";

// 文字列をdebug dump向けに正規化する関数
const normalizeString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

// 長すぎる文字列を省略する関数
const truncateString = (value: string | null, maxLength: number): string | null => {
  if (value === null) return null;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
};

// ElementをPOJOへ要約する関数
const createElementDebugSnapshot = (element: Element | null): DebugDumpValue => {
  if (!element) return null;

  const snapshot: DebugDumpObject = {
    tagName: element.tagName.toLowerCase(),
    isConnected: element.isConnected,
  };

  if (element instanceof HTMLElement) {
    snapshot.id = normalizeString(element.id);
    snapshot.className = normalizeString(element.className);
    snapshot.hidden = element.hidden;
    snapshot.text = truncateString(normalizeString(element.textContent), 120);
  }

  if (element instanceof HTMLButtonElement) {
    snapshot.ariaLabel = normalizeString(element.getAttribute("aria-label"));
    snapshot.disabled = element.disabled;
  }

  if (element instanceof HTMLDivElement) {
    snapshot.childElementCount = element.childElementCount;
  }

  if (element instanceof HTMLVideoElement) {
    snapshot.currentSrc = normalizeString(element.currentSrc);
    snapshot.readyState = element.readyState;
    snapshot.paused = element.paused;
    snapshot.ended = element.ended;
    snapshot.videoWidth = element.videoWidth;
    snapshot.videoHeight = element.videoHeight;
    snapshot.currentTime = Number.isFinite(element.currentTime) ? element.currentTime : null;
  }

  if (element instanceof HTMLCanvasElement) {
    snapshot.width = element.width;
    snapshot.height = element.height;
  }

  return snapshot;
};

// NodeをPOJOへ要約する関数
const createNodeDebugSnapshot = (node: Node | null): DebugDumpValue => {
  if (!node) return null;

  if (node instanceof Element) {
    return {
      kind: "element",
      element: createElementDebugSnapshot(node),
    };
  }

  if (node instanceof Document) {
    return {
      kind: "document",
    };
  }

  return {
    kind: "node",
    nodeType: node.nodeType,
    nodeName: normalizeString(node.nodeName),
  };
};

// EventTargetをPOJOへ要約する関数
const createEventTargetDebugSnapshot = (target: EventTarget | null): DebugDumpValue => {
  if (!target) return null;

  if (target === globalThis) {
    return {
      kind: "window",
    };
  }

  if (target instanceof Element) {
    return {
      kind: "element",
      element: createElementDebugSnapshot(target),
    };
  }

  if (target instanceof Document) {
    return {
      kind: "document",
    };
  }

  return {
    kind: normalizeString(target.constructor?.name) ?? "unknown",
  };
};

// 要素一覧をPOJO配列へ要約する関数
const createElementListDebugSnapshot = (elements: Iterable<Element>): DebugDumpValue[] => {
  const snapshots: DebugDumpValue[] = [];
  for (const element of elements) {
    snapshots.push(createElementDebugSnapshot(element));
  }
  return snapshots;
};

// エクスポート
export {
  createElementDebugSnapshot,
  createNodeDebugSnapshot,
  createEventTargetDebugSnapshot,
  createElementListDebugSnapshot,
};
