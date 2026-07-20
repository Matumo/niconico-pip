// https://github.com/Matumo/niconico-pip/issues/69
// https://github.com/Matumo/niconico-pip/issues/80
(function() {
  // メッセージタイプ
  const pipStateRequestMessageType = "com-matumo-dev-niconico-pip:msg:get-pip-state";
  const pipTabActivationRequestMessageType = "com-matumo-dev-niconico-pip:msg:request-pip-tab-activation";

  // リカバリモード
  const recoveryModeSpaOnly = "spa-only";
  const recoveryModeSpaAndActivate = "spa-and-activate";

  // 描画停止検知
  const renderStallDetectionThresholdMs = 100;
  const renderStallRecoveryRetryMs = 200;
  let lastTimeupdateVideoElement = null;
  let lastTimeupdateMediaTime = null;
  let lastObservedRenderCount = 0;
  let renderStallRecoveryPending = false;
  let renderStallRecoveryRequestedAt = 0;

  // リカバリ処理の実行間隔
  const recoveryExecutionIntervalMs = 100;
  let lastRecoveryExecutedAt = Number.NEGATIVE_INFINITY;
  let pendingRecoveryTimerId = null;
  let pendingRecoveryReason = null;
  let pendingRecoveryMode = recoveryModeSpaOnly;

  // リカバリ処理の実行制限
  // 10秒間に15回まで許可し、16回目から10秒間一時停止
  const recoveryExecutionLimitWindowMs = 10000;
  const recoveryExecutionLimitMaxCount = 15;
  const recoveryExecutionPauseMs = 10000;
  let recoveryExecutionTimestamps = [];
  let recoveryExecutionPausedUntil = 0;

  // メッセージ対応確認
  const hasRuntimeMessageApi = (
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    chrome.runtime.onMessage
  );
  if (!hasRuntimeMessageApi) return;

  // 予約中のリカバリ処理をクリア
  const clearPendingRecovery = () => {
    if (pendingRecoveryTimerId !== null) {
      clearTimeout(pendingRecoveryTimerId);
    }
    pendingRecoveryTimerId = null;
    pendingRecoveryReason = null;
    pendingRecoveryMode = recoveryModeSpaOnly;
  };

  // 予約中のリカバリ処理へ要求を統合
  const mergePendingRecovery = (reason, mode) => {
    if (pendingRecoveryReason === null) {
      pendingRecoveryReason = reason;
    }
    if (mode === recoveryModeSpaAndActivate) {
      pendingRecoveryReason = reason;
      pendingRecoveryMode = recoveryModeSpaAndActivate;
    }
  };

  // リカバリ処理の一時停止状態を確認
  const resumeRecoveryExecutionIfNeeded = (now) => {
    if (now < recoveryExecutionPausedUntil) return false;
    if (recoveryExecutionPausedUntil <= 0) return true;

    recoveryExecutionPausedUntil = 0;
    recoveryExecutionTimestamps = [];
    console.debug("バグ回避#69: リカバリ処理 再開");
    return true;
  };

  // リカバリ処理の実行回数を確認
  const canExecuteRecovery = (now, reason, mode) => {
    if (!resumeRecoveryExecutionIfNeeded(now)) return false;

    const windowStart = now - recoveryExecutionLimitWindowMs;
    recoveryExecutionTimestamps = recoveryExecutionTimestamps.filter(
      (timestamp) => timestamp >= windowStart
    );
    if (recoveryExecutionTimestamps.length < recoveryExecutionLimitMaxCount) {
      return true;
    }

    recoveryExecutionPausedUntil = now + recoveryExecutionPauseMs;
    recoveryExecutionTimestamps = [];
    clearPendingRecovery();
    console.warn("バグ回避#69: リカバリ処理が集中したため一時停止", {
      reason,
      mode,
      pauseMs: recoveryExecutionPauseMs
    });
    return false;
  };

  // リカバリ処理を実行
  const executeRecovery = (reason, mode) => {
    const pipActive = document.pictureInPictureElement === videoPipElement;
    if (!pipActive) return false;

    const now = performance.now();
    if (!canExecuteRecovery(now, reason, mode)) return false;

    recoveryExecutionTimestamps.push(now);
    lastRecoveryExecutedAt = now;
    history.replaceState(history.state, "", globalThis.location.href);
    console.debug("バグ回避#69: リカバリ処理 実行", { reason, mode });

    if (mode === recoveryModeSpaAndActivate) {
      chrome.runtime.sendMessage({
        type: pipTabActivationRequestMessageType,
        reason
      }, (response) => {
        if (chrome.runtime.lastError || !response?.accepted) {
          console.debug("バグ回避#69: タブアクティブ化要求 失敗", {
            reason,
            message: chrome.runtime.lastError?.message || "rejected"
          });
        }
      });
    }

    return true;
  };

  // 予約中のリカバリ処理を実行
  const executePendingRecovery = () => {
    const reason = pendingRecoveryReason;
    const mode = pendingRecoveryMode;
    pendingRecoveryTimerId = null;
    pendingRecoveryReason = null;
    pendingRecoveryMode = recoveryModeSpaOnly;
    if (reason === null) return;
    executeRecovery(reason, mode);
  };

  // リカバリ処理のエントリーポイント
  // Content Script内のSPAトリガーを実行
  // 必要な場合だけBackgroundへPiPタブのアクティブ化を要求
  const requestRecovery = (reason, mode = recoveryModeSpaOnly) => {
    const pipActive = document.pictureInPictureElement === videoPipElement;
    if (!pipActive) {
      console.debug("バグ回避#69: リカバリ要求 スキップ", { reason, mode });
      return { pipActive: false, recoveryAccepted: false };
    }

    const now = performance.now();
    if (!resumeRecoveryExecutionIfNeeded(now)) {
      return { pipActive: true, recoveryAccepted: false };
    }

    mergePendingRecovery(reason, mode);
    const elapsedMs = now - lastRecoveryExecutedAt;
    if (elapsedMs >= recoveryExecutionIntervalMs) {
      if (pendingRecoveryTimerId !== null) {
        clearTimeout(pendingRecoveryTimerId);
      }
      const executedReason = pendingRecoveryReason;
      const executedMode = pendingRecoveryMode;
      pendingRecoveryTimerId = null;
      pendingRecoveryReason = null;
      pendingRecoveryMode = recoveryModeSpaOnly;
      const recoveryAccepted = executeRecovery(executedReason, executedMode);
      return { pipActive: true, recoveryAccepted };
    }

    if (pendingRecoveryTimerId === null) {
      const waitMs = recoveryExecutionIntervalMs - elapsedMs;
      pendingRecoveryTimerId = setTimeout(executePendingRecovery, waitMs);
    }
    return { pipActive: true, recoveryAccepted: true };
  };

  // Backgroundが最小化を検知したときのPiP状態問い合わせ
  // リカバリ処理の実行可否も返却
  // 実行制限中はBackground側のタブアクティブ化も抑止
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== pipStateRequestMessageType) return;
    const result = requestRecovery(
      message.reason || "Background問い合わせ",
      recoveryModeSpaAndActivate
    );
    console.debug("バグ回避#69: 問い合わせ受信", result);
    sendResponse(result);
  });

  // 可視性変更イベントリスナー
  globalThis.addEventListener("visibilitychange", () => {
    console.debug("バグ回避#69: 可視性変更");
    requestRecovery("可視性変更", recoveryModeSpaOnly);
  });

  // アクティブイベントリスナー
  // globalThis.addEventListener("focus", () => {
  //   console.debug("バグ回避#69: アクティブ");
  // });

  // 非アクティブイベントリスナー
  globalThis.addEventListener("blur", () => {
    console.debug("バグ回避#69: 非アクティブ");
    requestRecovery("非アクティブ", recoveryModeSpaOnly);
  });

  // 元videoが進行するたびに描画Heartbeatと比較
  // globalThisに登録するため、SPAでvideo要素が差し替わっても再登録は不要
  globalThis.addEventListener("timeupdate", (event) => {
    // console.debug("バグ回避#69: timeupdate", { video: event.target });
    const sourceVideoElement = event.target;
    if (!(sourceVideoElement instanceof HTMLVideoElement)) return;
    if (document.pictureInPictureElement !== videoPipElement) return;
    if (sourceVideoElement !== pipVideoRenderHeartbeat.sourceVideoElement) return;

    const now = performance.now();
    const mediaTime = sourceVideoElement.currentTime;
    const renderCount = pipVideoRenderHeartbeat.count;
    const sourceChanged = lastTimeupdateVideoElement !== sourceVideoElement;
    const mediaDelta = lastTimeupdateMediaTime === null ? 0 : mediaTime - lastTimeupdateMediaTime;
    const mediaAdvancedNormally = mediaDelta > 0 && mediaDelta < 5;
    const renderAdvanced = renderCount !== lastObservedRenderCount;

    lastTimeupdateVideoElement = sourceVideoElement;
    lastTimeupdateMediaTime = mediaTime;
    lastObservedRenderCount = renderCount;

    // 描画が進んだ時点で、前回のリカバリ要求を完了扱いにする
    if (renderAdvanced) {
      renderStallRecoveryPending = false;
      return;
    }

    if (sourceChanged) return;
    if (sourceVideoElement.paused) return;
    if (sourceVideoElement.ended) return;
    if (sourceVideoElement.seeking) return;
    if (!mediaAdvancedNormally || pipVideoRenderHeartbeat.lastRenderedAt <= 0) return;

    const renderStoppedForMs = now - pipVideoRenderHeartbeat.lastRenderedAt;
    if (renderStoppedForMs < renderStallDetectionThresholdMs) return;

    // リカバリが失敗して描画が再開しない場合も、一定時間は再要求を抑止する
    if (renderStallRecoveryPending) {
      const recoveryElapsedMs = now - renderStallRecoveryRequestedAt;
      if (recoveryElapsedMs < renderStallRecoveryRetryMs) {
        console.debug("バグ回避#69: 描画停止検知 リカバリ要求抑止", { renderStoppedForMs, recoveryElapsedMs });
        return;
      }
    }

    renderStallRecoveryPending = true;
    renderStallRecoveryRequestedAt = now;
    console.debug("バグ回避#69: 描画停止検知", { renderStoppedForMs });
    requestRecovery("描画停止", recoveryModeSpaAndActivate);
  }, true);
})();
