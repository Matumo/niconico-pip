"use strict";

// PIPの開始と終了に関する処理

// --- functions ---------------------------------------------------------------
let startPip = null; // PIPを開始する関数
let endPip = null;   // PIPを終了する関数
// -----------------------------------------------------------------------------

{
  // 既存のコンテンツを表示または非表示にするための関数
  function setVisibility(pipVisible) {
    // PIP動画を確認用にプレイヤー外に表示する場合、表示と非表示は切り替えない
    if (debugMode && debug_pipViewOutside) {
      console.debug("PIP video is always visible for debugging purposes.");
      return;
    }
    const targetElementList = [
      context.elements.menu.contents,        // コンテンツ要素
      context.elements.menu.comments,        // コメント要素
      context.elements.menu.supporter,       // ニコニ貢献要素
      context.elements.ad.ad,                // 広告要素
      context.elements.ad.ad?.parentElement, // 広告の親要素
      //context.elements.nextVideo.nextVideo,  // 次の動画要素
    ];
    // hidden属性を設定して表示/非表示を切り替える
    for (const element of targetElementList) {
      if (element) {
        if (pipVisible) {
          element.setAttribute('hidden', '');
          //console.debug("Element hidden:", element);
        } else {
          element.removeAttribute('hidden');
          //console.debug("Element visible:", element);
        }
      }
    }
    const pipElement = context.pip.videoElement;
    if (pipElement) {
      if (pipVisible) {
        pipElement.removeAttribute('hidden');
        //console.debug("PIP element visible:", pipElement);
      } else {
        pipElement.setAttribute('hidden', '');
        //console.debug("PIP element hidden:", pipElement);
      }
    }
  }

  // PIPを開始する関数
  startPip = function() {
    const videoPipElement = context.pip.videoElement;
    if (!videoPipElement) {
      console.warn("Video PIP element does not exist.");
      return;
    }
    // メタデータ読み込みが完了してからPIPを開始
    if (videoPipElement.readyState >= 1) {
      console.debug("Video metadata already loaded.");
      videoPipElement.requestPictureInPicture().then(() => {
      }).catch(error => {
        console.debug("Failed to enter Picture-in-Picture mode:", error);
      });
      console.debug("PIP started.");
    } else {
      console.debug("Video metadata not loaded. Waiting for metadata loaded.");
      videoPipElement.addEventListener('loadedmetadata', () => {
        console.debug("Video metadata loaded.");
        videoPipElement.requestPictureInPicture().then(() => {
        }).catch(error => {
          console.debug("Failed to enter Picture-in-Picture mode:", error);
        });
        console.debug("PIP started.");
      });
    }
  }

  // PIPを終了する関数
  endPip = function() {
    window.document.exitPictureInPicture().catch(error => {
      console.debug("Failed to exit Picture-in-Picture mode:", error);
    });
  }

  // PIPのステータスを取得する関数
  function checkPipStatus(pipElement) {
    if (!pipElement) return "disabled";
    if (pipElement !== context.pip.videoElement) return "otherElementEnabled";
    return "enabled";
  }

  // PIPのステータスを取得する関数
  function getPipStatus() {
    return checkPipStatus(document.pictureInPictureElement);
  }

  // PIPのステータスを更新する関数
  function updatePipStatus() {
    // PIPのステータスを取得
    const pipStatus = getPipStatus();
    // PIPのステータスが変わった場合のみ更新
    if (context.pip.status !== pipStatus) {
      updatePipStatusContext(pipStatus); // コンテキストを更新
      setVisibility(context.pip.status === "enabled"); // 表示を切り替える
      console.debug("PIP status updated:", pipStatus);
    } else {
      console.debug("PIP status unchanged:", pipStatus);
    }
  }

  addEventListener(window, "PIP開始時に割り込み処理", "enterpictureinpicture", (event) => {
    const pipElement = event.target;
    const pipStatus = checkPipStatus(pipElement);
    console.debug("Entered Picture-in-Picture mode with status:", pipStatus);
    // 他の要素でPIPを開始した場合、context.pip.videoElementでPIPを開始する
    if (pipStatus === "otherElementEnabled") {
      startPip();
      return;
    }
    // 全画面表示を終了する
    if (document.fullscreenElement) {
      console.debug("Exiting fullscreen mode.");
      document.exitFullscreen().catch(error => {
        console.debug("Failed to exit fullscreen mode:", error);
      });
    }
    // PIPの描画を再開する
    requestStreamResume();
    // PIPのステータスを更新
    updatePipStatus();
  });

  addEventListener(window, "PIP終了時に割り込み処理", "leavepictureinpicture", (event) => {
    console.debug("Exited Picture-in-Picture mode.");
    // PIPの描画を停止する
    requestStreamPause();
    // PIPのステータスを更新
    updatePipStatus();
    // PIPを終了
    endPip();
  });

  // 全画面表示を開始したときにPIPを終了
  addEventListener(window, "全画面表示時にPIPを終了", "fullscreenchange", () => {
    if (document.fullscreenElement) {
      console.debug("Fullscreen mode entered. Exiting Picture-in-Picture mode.");
      endPip();
    }
  });

  // PIPのステータスを初期化
  updatePipStatus();
}
