"use strict";

// ステータス判定機能

// --- function ----------------------------------------------------------------
let checkStatus = null;
// -----------------------------------------------------------------------------

{
  function checkAdSkipAvailableResponseHandler(response) {
    if (response.type === checkAdSkipAvailableResponseMessageName) {
      console.debug("Ad skip button check response:", response,
                    "available:", response.details.skipAvailable);
      // レイテンシーを計測
      if (debugMode) {
        const now = performance.now();
        const sendTime = response.details.sendTime;
        const elapsedTime = now - sendTime;
        console.debug(`Ad skip button check elapsed time: ${elapsedTime.toFixed(2)}ms`);
      }
      // 現在のステータスがadである場合は、skipAvailableを書き換えたstatusでcontextを更新
      const currentStatusType = context.status.type;
      const skipAvailable = response.details.skipAvailable;
      const videoId = response.details.videoId;
      // 現在のステータスがadでない場合はスキップ
      if (!currentStatusType?.startsWith("ad-")) {
        console.debug("<Message Error> Ad skip button check response received,",
          "but current status is not ad. Current status:", currentStatusType);
          return;
      }
      // スキップ不可もしくは不明の場合はスキップ
      if (!skipAvailable) {
        return;
      }
      // videoIdが一致しない場合はスキップ
      if (videoId !== context.checkAdSkipVideoId) {
        console.debug("<Message Error> Ad skip button check response received,",
          "but videoId does not match. Expected:", context.checkAdSkipVideoId, "Received:", videoId);
      }
      // スキップ可能な状態になった場合のみ更新する
      // checkAdSkipVideoIdをインクリメント
      incCheckAdSkipVideoId();
      // ステータスを更新
      console.debug("Ad skip button is available. Updating status context.");
      const updatedStatus = Object.assign({}, context.status);
      updatedStatus.details = skipAvailable ? "skipAvailable" : "skipNotAvailable";
      updateStatusContext(updatedStatus);
    } else {
      console.debug("<Message Error> Unexpected response type:", response.type);
    }
  }
  function checkAdSkipAvailable() {
    try {
      chrome.runtime.sendMessage(
        {
          type: checkAdSkipAvailableRequestMessageName,
          videoId: context.checkAdSkipVideoId,
          sendTime: performance.now()
        },
        checkAdSkipAvailableResponseHandler);
    } catch (error) {
      console.debug("<Message Error> Ad skip button check failed:", error);
    }
  }

  function getStatus() {
    const res = {
      playing: false,
      // "ad-xxx", "video", "supporter", "nextVideo", "error", "unknown", "loading"
      type: "unknown",
      index: -1, // 動画のインデックス（必要に応じて追加）
      details: null // 詳細情報（必要に応じて追加）
    };

    // 必須要素が取得できていない場合はロード中
    if (!context.elementsReady.player ||
        !context.elementsReady.controller ||
        !context.elementsReady.menu) {
      res.type = "loading";
      res.details = "elementsNotReady";
      return res;
    }

    // 再生状況チェック
    const playButton = context.elements.controller.playBtn;
    // aria-label="再生する" or aria-label="一時停止する" で判定
    const playButtonLabel = playButton.getAttribute("aria-label");
    const isPlaying = playButtonLabel === "一時停止する";
    res.playing = isPlaying;

    // video要素が再生中であるかどうか
    const videoElement = context.elements.menu.video;
    const isVideoElementPlaying = videoElement.readyState >= 2 && videoElement.paused === false;

    // 次の動画チェック: 要素が取得できているかどうかで判定（アクティブ時にだけ存在する）
    if (context.elementsReady.nextVideo && !isVideoElementPlaying) {
      // 要素が本当に存在する場合は次の動画紹介
      const nextVideoElement = context.elements.player.player.querySelector(selector_player_nextVideo_thumbnail);
      if (nextVideoElement) {
        res.type = "nextVideo";
        res.details = null;
        return res;
      }
    }

    // 広告チェック: 要素がcontextに無い場合は取得し、表示状態であるかどうかで判定
    if (context.elementsReady.ad && !isVideoElementPlaying) {
      const adVideoElements = context.elements.ad.adVideo;
      for (let i = 0; i < adVideoElements.length; i++) {
        const adVideo = adVideoElements[i];
        const parentElement = adVideo.parentElement;
        const isVisible = parentElement.style.display !== "none";
        if (isVisible) {
          // 広告のインデックスを設定
          res.index = i;
          // 広告種別判定とスキップ可否判定
          const url = adVideo.getAttribute("src");
          const isGoogle = url?.includes(".googlevideo.com/");
          const isNico = url?.includes(".nimg.jp/");
          const is2mdn = url?.includes(".2mdn.net/");
          console.debug("Ad video URL:", url, "isGoogle:", isGoogle, "isNico:", isNico, "is2mdn:", is2mdn);
          // どの種別にも当てはまらない場合かつデバッグモードの場合は警告
          if (!isGoogle && !isNico && !is2mdn && debugMode) {
            console.warn("Ad video URL does not match any known patterns:", url);
          }
          if (isNico) {
            // いきなり動画紹介
            res.type = "ad-nico";
            // disabled属性があるかどうかで判定
            const adSkipButton = document.querySelector(selector_player_ad_skipButton);
            const isSkipButtonEnabled = adSkipButton && !adSkipButton.disabled;
            res.details = isSkipButtonEnabled ? "skipAvailable" : "skipNotAvailable";
          } else if (is2mdn) {
            // 2mdn広告
            res.type = "ad-2mdn";
            const skipButton = Array.from(document.querySelectorAll('button')).find(btn =>
              btn.textContent?.includes('広告をスキップ') &&
              btn.querySelector('img[alt="動画広告スキップボタンの矢印画像"]')
            );
            if (skipButton && !skipButton.disabled) {
              res.details = "skipAvailable";
            } else {
              res.details = "skipNotAvailable";
            }
          } else {
            // 通常の広告
            res.type = isGoogle ? "ad-google" : "ad-other";
            // 一旦、現在と同じ値を持つ
            res.details = context.status.details === "skipAvailable" ?
                                                     "skipAvailable" : "skipNotAvailable";
            // serviceWorkerにskipAvailableのチェックをリクエスト（非同期でステータス反映）
            checkAdSkipAvailable();
          }
          return res;
        }
      }
    }

    // ニコニ貢献チェック: contextの要素が表示状態であるかどうかで判定
    if (!isVideoElementPlaying) {
      const supporterElement = context.elements.menu.supporter;
      const isSupporterVisible = supporterElement.style.opacity !== "0";
      if (isSupporterVisible) {
        res.type = "supporter";
        res.details = null;
        return res;
      }
    }

    // 動画関連のチェック
    //const videoElement = context.elements.menu.video;
    const playerElement = context.elements.player.player;
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      // エラーチェック: videoサイズが0x0でエラーメッセージが表示されている場合はエラー
      // タブの開きすぎ
      const isTooManyTabsWarningShown = !!playerElement.querySelector('[data-scope="presence"]')
        ?.textContent?.includes("複数のタブやウィンドウで動画を視聴しています");
      if (isTooManyTabsWarningShown) {
        res.type = "error";
        res.details = "tooManyTabs";
        return res;
      }
      // 有料動画
      const isPaidVideoNoticeShown =
        !!playerElement.querySelector('h1')?.textContent?.includes("有料動画");
      if (isPaidVideoNoticeShown) {
        res.type = "error";
        res.details = "paidVideo";
        return res;
      }
      // 不明なエラーもしくはロード中なので、ロード中を候補にしてチェックを継続する
      const text = playerElement.querySelector('[data-scope="presence"]')?.textContent;
      res.type = "loading";
      res.details = "maybeLoading(" + (text || "None") + ")";
    } else {
      // 動画チェック: contextの要素が表示状態であるかどうかで判定（hidden以外の方法で非表示かどうか）
      const isVisible = videoElement.style.opacity !== "0";
      if (isVisible) {
        res.type = "video";
        res.details = null;
        return res;
      } else {
        res.type = "loading";
        res.details = "videoNotVisible";
      }
    }

    return res;
  };

  checkStatus = function () {
    // プレイヤーのステータスチェック
    const status = getStatus();
    updateStatusContext(status);
  }
}
