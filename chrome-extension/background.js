// カスタムロガー
const logLevel = "info";

// --- variable ----------------------------------------------------------------
const originalConsole = globalThis.console;
let console = Object.create(originalConsole);
// -----------------------------------------------------------------------------

{
  // ログレベル
  const logLevels = {
    "error": 4,
    "warn": 3,
    "info": 2,
    "log": 1,
    "debug": 0
  };
  const currentLogLevel = logLevels[logLevel];

  // オーバーライド
  console = new Proxy(originalConsole, {
    get(target, prop) {
      const levelValue = logLevels[prop];
      // ログレベル管理対象かつ関数ならラップ
      if (typeof target[prop] === "function" && typeof levelValue === "number") {
        return (...args) => {
          // 経過時間を取得してログに追加する
          if (currentLogLevel <= levelValue) {
            const now = performance.now();
            // 元のconsoleの関数を呼び出す
            target[prop](`(${now.toFixed(1)} ms)`, ...args);
          }
        };
      }
      // 他は元のconsoleそのまま
      return target[prop];
    }
  });
}



// https://github.com/Matumo/niconico-pip/issues/69
(function() {

  const pipStateRequestMessageType = "com-matumo-dev-niconico-pip:msg:get-pip-state";
  const targetTabUrlPatterns = ["https://www.nicovideo.jp/*"];

  // タブをアクティブ化して成功時コールバックを実行する関数
  function activateTabWithCallback(tabId, reason, onSuccess) {
    if (typeof tabId !== "number") return;
    chrome.tabs.update(tabId, { active: true }, (updatedTab) => {
      if (chrome.runtime.lastError) {
        console.debug("バグ回避#69: 元タブの再アクティブ化 失敗:", chrome.runtime.lastError.message);
        return;
      }
      console.debug("バグ回避#69: 全フロー 成功:", `tabId=${tabId}`,
        `windowId=${updatedTab?.windowId ?? "unknown"}`, `reason=${reason}`);
      if (typeof onSuccess === "function") onSuccess(updatedTab);
    });
  }

  // タブをアクティブ化する関数
  function activateTab(tabId, reason) {
    activateTabWithCallback(tabId, reason);
  }

  // 元タブIDを使ってPiPタブの一時アクティブ化を完了する関数
  function activatePipAndMaybeRestore(pipTabId, originalTabId, reason) {
    activateTabWithCallback(pipTabId, `pip-tab:${reason}`, () => {
      if (typeof originalTabId !== "number" || originalTabId === pipTabId) return;
      activateTabWithCallback(originalTabId, `restore-tab:${reason}`);
    });
  }

  // PiPタブを一時的にアクティブ化して元タブへ戻す関数
  function activatePipTabThenRestoreOriginal(windowId, pipTabId, reason) {
    if (typeof windowId !== "number" || typeof pipTabId !== "number") return;

    chrome.tabs.query({ windowId, active: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.debug("バグ回避#69: PiPタブのアクティブ化 失敗:", chrome.runtime.lastError.message);
        activateTab(pipTabId, `pip-tab:${reason}`);
        return;
      }
      // 元タブに戻す
      const originalTabId = tabs[0]?.id;
      activatePipAndMaybeRestore(pipTabId, originalTabId, reason);
    });
  }

  // タブのPiP状態を問い合わせる関数
  function queryPipState(tabId, callback) {
    // 不正なタブIDではないことを確認
    if (typeof tabId !== "number") {
      callback(false);
      return;
    }
    // メッセージ送信
    chrome.tabs.sendMessage(tabId, { type: pipStateRequestMessageType }, (response) => {
      if (chrome.runtime.lastError) {
        callback(false);
        return;
      }
      callback(Boolean(response?.pipActive));
    });
  }

  // 指定ウィンドウ内のPiP中タブを探索する関数
  function resolvePipTabIdByCandidates(candidateTabIds, callback) {
    if (!candidateTabIds.length) {
      callback(null);
      return;
    }

    let remaining = candidateTabIds.length;
    let pipTabId = null;
    const handleProbeResult = (tabId, isPipActive) => {
      if (isPipActive && pipTabId === null) pipTabId = tabId;
      remaining -= 1;
      if (remaining === 0) callback(pipTabId);
    };

    for (const tabId of candidateTabIds) {
      queryPipState(tabId, (isPipActive) => {
        handleProbeResult(tabId, isPipActive);
      });
    }
  }

  // 指定ウィンドウ内のPiP中タブを探索する関数
  function findPipTabInWindow(windowId, callback) {
    if (typeof windowId !== "number") {
      callback(null);
      return;
    }

    chrome.tabs.query({ windowId, url: targetTabUrlPatterns }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.debug("バグ回避#69: 対象タブ取得 失敗:", chrome.runtime.lastError.message);
        callback(null);
        return;
      }

      const candidateTabIds = tabs.map((tab) => tab.id).filter((tabId) => typeof tabId === "number");
      resolvePipTabIdByCandidates(candidateTabIds, callback);
    });
  }

  // 検出したPiPタブをアクティブ化する関数
  function activateDetectedPipTab(windowId, reason) {
    findPipTabInWindow(windowId, (pipTabId) => {
      if (typeof pipTabId !== "number") {
        console.debug("バグ回避#69: PiP実行中のタブなし:", `windowId=${windowId}`, `reason=${reason}`);
        return;
      }
      // PiPタブをアクティブ化した後、元のタブを再アクティブ化する
      activatePipTabThenRestoreOriginal(windowId, pipTabId, reason);
    });
  }

  // ウィンドウ状態イベントを処理する関数
  function handleWindowState(windowInfo, reason) {
    if (!windowInfo || typeof windowInfo.id !== "number") return;

    console.debug("バグ回避#69: window イベント:", `windowId=${windowInfo.id}`,
      `state=${windowInfo.state || "unknown"}`, `reason=${reason}`);

    // 最小化しているウインドウのみ処理を進める
    if (windowInfo.state === "minimized") {
      activateDetectedPipTab(windowInfo.id, reason);
    }
  }

  // 最小化中のウィンドウを走査して処理する関数（フォーカスなし用）
  function handleMinimizedWindowsByRefresh(reason) {
    chrome.windows.getAll({}, (windows) => {
      if (chrome.runtime.lastError) {
        console.debug("バグ回避#69: windows全件取得 失敗:", chrome.runtime.lastError.message);
        return;
      }
      for (const windowInfo of windows) {
        if (!windowInfo || typeof windowInfo.id !== "number") continue;
        if (windowInfo.state !== "minimized") continue;
        handleWindowState(windowInfo, reason);
      }
    });
  }

  // ウィンドウのフォーカス変化を監視
  function handleFocusedWindowById(windowId) {
    chrome.windows.get(windowId, (windowInfo) => {
      if (chrome.runtime.lastError) {
        console.debug("バグ回避#69: windowId取得 失敗", chrome.runtime.lastError.message);
        return;
      }
      handleWindowState(windowInfo, "onFocusChanged");
    });
  }

  // ウィンドウのフォーカス変化を監視
  chrome.windows.onFocusChanged.addListener((windowId) => {
    console.debug("バグ回避#69: イベント検知", { windowId });
    // フォーカスなし（最小化/他アプリ前面など）: 対象が特定できないため全ウインドウを取得して処理
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      handleMinimizedWindowsByRefresh("onFocusChanged:none");
      return;
    }
    // フォーカスあり: ウィンドウIDを取得して、そのウインドウのみ処理
    handleFocusedWindowById(windowId);
  });

})();
