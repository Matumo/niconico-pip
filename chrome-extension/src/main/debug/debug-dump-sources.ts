/**
 * debug dump source生成
 */
import type { ElementsSnapshot } from "@main/config/event";
import { createElementDebugSnapshot, createElementListDebugSnapshot } from "@main/debug/debug-dump-dom-snapshot";
import type {
  DebugDumpObject,
  DebugDumpSource,
  RegisterElementsDomainDebugDumpOptions,
  RegisterPageDomainDebugDumpOptions,
  RegisterPipDomainDebugDumpOptions,
  RegisterStatusDomainDebugDumpOptions,
} from "@main/debug/debug-dump-types";
import type { AppContext } from "@main/types/app-context";

// registry内で利用するdump source名の一覧
const debugDumpSourceNames = {
  appContext: "app/context",
  pageDomain: "domain/page",
  elementsDomain: "domain/elements",
  statusDomain: "domain/status",
  pipDomain: "domain/pip",
} as const;

type DebugDumpSourceName = (typeof debugDumpSourceNames)[keyof typeof debugDumpSourceNames];

// null/undefinedをまとめてfalse扱いにして、debug dump用booleanへ正規化する
const hasDebugDumpHandle = <TValue>(value: TValue | null | undefined): boolean => value != null;

// AppContextのうちdebug dumpで見たいconfig項目だけを要約する
const createConfigDebugSnapshot = (context: AppContext) => ({
  appName: context.config.appName,
  prefixId: context.config.prefixId,
  debugMode: context.config.debugMode,
  shouldUseDebugLog: context.config.shouldUseDebugLog,
  shouldExitPipOnNonWatchPage: context.config.shouldExitPipOnNonWatchPage,
  watchPageUrlPatternSource: context.config.watchPageUrlPattern.source,
  pipButtonElementId: context.config.pipButtonElementId,
  pipVideoElementId: context.config.pipVideoElementId,
  videoPipCanvasWidth: context.config.videoPipCanvasWidth,
  videoPipCanvasHeight: context.config.videoPipCanvasHeight,
});

// AppContext全体のstateとregistry規模をひとまとめに確認できるsource
const createAppContextDebugDumpSource = (context: AppContext): DebugDumpSource =>
  () => ({
    config: createConfigDebugSnapshot(context),
    state: {
      page: { ...context.state.page.get() },
      elements: { ...context.state.elements.get() },
      status: { ...context.state.status.get() },
      time: { ...context.state.time.get() },
      pip: { ...context.state.pip.get() },
      info: { ...context.state.info.get() },
    },
    registrySizes: {
      debugDumpRegistry: context.debugDumpRegistry?.size() ?? 0,
      eventRegistry: context.eventRegistry.size(),
      observerRegistry: context.observerRegistry.size(),
    },
  });

// page domainのURL同期状態を追える最小セットをまとめるsource
const createPageDomainDebugDumpSource = (
  context: AppContext,
  options: RegisterPageDomainDebugDumpOptions,
): DebugDumpSource =>
  () => {
    const runtime = options.resolveRuntime();
    return {
      state: { ...context.state.page.get() },
      currentUrl: options.resolveCurrentUrl(),
      lastKnownUrl: runtime?.lastKnownUrl ?? null,
    };
  };

// ElementsSnapshotはkeyごとにDOM要約へ変換してそのまま辿れる形にする
const createElementsSnapshotDebugSnapshot = (snapshot: ElementsSnapshot): DebugDumpObject => {
  const debugSnapshot: DebugDumpObject = {};
  for (const [key, value] of Object.entries(snapshot)) {
    debugSnapshot[key] = createElementDebugSnapshot(value);
  }
  return debugSnapshot;
};

// elements domainの解決結果と購読状態を並べて確認するsource
const createElementsDomainDebugDumpSource = (
  context: AppContext,
  options: RegisterElementsDomainDebugDumpOptions,
): DebugDumpSource =>
  () => {
    const runtime = options.resolveRuntime();
    return {
      state: { ...context.state.elements.get() },
      pageState: { ...context.state.page.get() },
      elementsGeneration: runtime?.elementsGeneration ?? null,
      activePlayerContainer: createElementDebugSnapshot(runtime?.activePlayerContainer ?? null),
      snapshot: createElementsSnapshotDebugSnapshot(runtime?.snapshot ?? options.createEmptySnapshot()),
      subscriptions: {
        hasPageUrlChangedSubscription: hasDebugDumpHandle(runtime?.unsubscribePageUrlChanged),
      },
    };
  };

// status domainの動画情報snapshotと更新世代を確認するsource
const createStatusDomainDebugDumpSource = (
  context: AppContext,
  options: RegisterStatusDomainDebugDumpOptions,
): DebugDumpSource =>
  () => {
    const runtime = options.resolveRuntime();
    return {
      infoState: { ...context.state.info.get() },
      pageState: { ...context.state.page.get() },
      snapshot: runtime ? { ...runtime.snapshot } : null,
      infoGeneration: runtime?.infoGeneration ?? null,
      pageGeneration: runtime?.pageGeneration ?? null,
      subscriptions: {
        hasPageUrlChangedSubscription: hasDebugDumpHandle(runtime?.unsubscribePageUrlChanged),
        hasElementsUpdatedSubscription: hasDebugDumpHandle(runtime?.unsubscribeElementsUpdated),
      },
    };
  };

// PiPの実状態とsource側の保持状態を見比べるためのsource
const createPipDomainDebugDumpSource = (
  context: AppContext,
  options: RegisterPipDomainDebugDumpOptions,
): DebugDumpSource =>
  () => {
    const runtime = options.resolveRuntime();
    const documentNode = globalThis.document;
    // PiP実状態との食い違いを見やすくするため、documentとruntimeの両方を載せる
    const pipVideoElement = runtime?.pipVideoElementAdapter.getElement() ?? null;

    return {
      pipState: { ...context.state.pip.get() },
      infoState: { ...context.state.info.get() },
      ownPictureInPictureActive: runtime?.pipVideoElementAdapter.isOwnPictureInPictureElement() ?? false,
      pipStreamRunning: runtime?.pipStream.isRunning() ?? false,
      documentPictureInPictureElement: createElementDebugSnapshot(documentNode?.pictureInPictureElement ?? null),
      documentFullscreenElement: createElementDebugSnapshot(documentNode?.fullscreenElement ?? null),
      pipVideoElement: createElementDebugSnapshot(pipVideoElement),
      sourceVideoElement: createElementDebugSnapshot(runtime?.sourceVideoElement ?? null),
      sourceCommentsCanvas: createElementDebugSnapshot(runtime?.sourceCommentsCanvas ?? null),
      fullscreenToggleButton: createElementDebugSnapshot(runtime?.fullscreenToggleButton ?? null),
      browserSizeFullscreenActive: runtime?.browserSizeFullscreenActive ?? null,
      hiddenSourceElements: runtime ? createElementListDebugSnapshot(runtime.hiddenSourceElements) : [],
      subscriptions: {
        hasPageUrlChangedSubscription: hasDebugDumpHandle(runtime?.unsubscribePageUrlChanged),
        hasElementsUpdatedSubscription: hasDebugDumpHandle(runtime?.unsubscribeElementsUpdated),
        hasVideoInfoChangedSubscription: hasDebugDumpHandle(runtime?.unsubscribeVideoInfoChanged),
      },
      nativeListeners: {
        enterPictureInPicture: hasDebugDumpHandle(runtime?.enterPictureInPictureListener),
        leavePictureInPicture: hasDebugDumpHandle(runtime?.leavePictureInPictureListener),
        fullscreenChange: hasDebugDumpHandle(runtime?.fullscreenChangeListener),
      },
    };
  };

// エクスポート
export {
  createAppContextDebugDumpSource,
  createElementsDomainDebugDumpSource,
  createPageDomainDebugDumpSource,
  createPipDomainDebugDumpSource,
  createStatusDomainDebugDumpSource,
  debugDumpSourceNames,
};
export type { DebugDumpSourceName };
