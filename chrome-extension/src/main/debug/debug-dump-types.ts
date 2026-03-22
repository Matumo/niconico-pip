/**
 * debug dump型定義
 */
import type { ElementsSnapshot } from "@main/config/event";
import type { VideoInfoSnapshot } from "@main/adapter/dom/video-info";

// debug dumpで扱うJSON互換の基本値
type DebugDumpPrimitive = string | number | boolean | null;
type DebugDumpValue = DebugDumpPrimitive | DebugDumpObject | DebugDumpValue[];

interface DebugDumpObject {
  [key: string]: DebugDumpValue;
}

// registryに登録される各dump sourceの関数型
type DebugDumpSource = () => DebugDumpValue;

// page domainから受け取るdebug dump入力
interface PageDomainDebugDumpInput {
  lastKnownUrl: string;
}

// elements domainから受け取るdebug dump入力
interface ElementsDomainDebugDumpInput {
  snapshot: ElementsSnapshot;
  elementsGeneration: number;
  activePlayerContainer: HTMLDivElement | null;
  unsubscribePageUrlChanged: (() => void) | null;
}

// status domainから受け取るdebug dump入力
interface StatusDomainDebugDumpInput {
  snapshot: VideoInfoSnapshot;
  infoGeneration: number;
  pageGeneration: number;
  unsubscribePageUrlChanged: (() => void) | null;
  unsubscribeElementsUpdated: (() => void) | null;
}

// PiP domainから受け取るdebug dump入力
interface PipDomainDebugDumpInput {
  pipVideoElementAdapter: {
    getElement(): HTMLVideoElement | null;
    isOwnPictureInPictureElement(): boolean;
  };
  pipStream: {
    isRunning(): boolean;
  };
  unsubscribePageUrlChanged: (() => void) | null;
  unsubscribeElementsUpdated: (() => void) | null;
  unsubscribeVideoInfoChanged: (() => void) | null;
  enterPictureInPictureListener: EventListener | null;
  leavePictureInPictureListener: EventListener | null;
  fullscreenChangeListener: EventListener | null;
  sourceVideoElement: HTMLVideoElement | null;
  sourceCommentsCanvas: HTMLCanvasElement | null;
  fullscreenToggleButton: HTMLButtonElement | null;
  browserSizeFullscreenActive: boolean | null;
  hiddenSourceElements: Set<HTMLElement>;
}

// page domain用dump source登録時の入力
interface RegisterPageDomainDebugDumpOptions {
  resolveRuntime: () => PageDomainDebugDumpInput | null;
  resolveCurrentUrl: () => string | null;
}

// elements domain用dump source登録時の入力
interface RegisterElementsDomainDebugDumpOptions {
  resolveRuntime: () => ElementsDomainDebugDumpInput | null;
  createEmptySnapshot: () => ElementsSnapshot;
}

// status domain用dump source登録時の入力
interface RegisterStatusDomainDebugDumpOptions {
  resolveRuntime: () => StatusDomainDebugDumpInput | null;
}

// PiP domain用dump source登録時の入力
interface RegisterPipDomainDebugDumpOptions {
  resolveRuntime: () => PipDomainDebugDumpInput | null;
}

// main codeから経由して使うdebug dump公開API
interface DebugDumpRegistry {
  registerAppContext: () => void;
  unregisterAppContext: () => void;
  registerPageDomain: (options: RegisterPageDomainDebugDumpOptions) => void;
  unregisterPageDomain: () => void;
  registerElementsDomain: (options: RegisterElementsDomainDebugDumpOptions) => void;
  unregisterElementsDomain: () => void;
  registerStatusDomain: (options: RegisterStatusDomainDebugDumpOptions) => void;
  unregisterStatusDomain: () => void;
  registerPipDomain: (options: RegisterPipDomainDebugDumpOptions) => void;
  unregisterPipDomain: () => void;
  installTrigger: () => void;
  uninstallTrigger: () => void;
  clearSources: () => void;
  size: () => number;
  collect: () => DebugDumpObject;
}

// エクスポート
export type {
  DebugDumpPrimitive,
  DebugDumpValue,
  DebugDumpObject,
  DebugDumpSource,
  PageDomainDebugDumpInput,
  ElementsDomainDebugDumpInput,
  StatusDomainDebugDumpInput,
  PipDomainDebugDumpInput,
  RegisterPageDomainDebugDumpOptions,
  RegisterElementsDomainDebugDumpOptions,
  RegisterStatusDomainDebugDumpOptions,
  RegisterPipDomainDebugDumpOptions,
  DebugDumpRegistry,
};
