"use strict";

// コンテキスト

// --- variables ---------------------------------------------------------------
// 処理間で共有する変数
// 参照は直接、変更はutil/context.jsの関数を利用して行う
let context = {
  // pageのデータは全ての処理より先に設定される
  // （ページ遷移時に設定される。拡張機能はページ遷移イベントで動き始める）
  page: {
    url: null,
    isWatchPage: false
  },
  // 動画情報はページ遷移時にクリアした後、動画再生ページの場合は取得を開始する
  info: {
    ready: false, // 動画情報が取得できたかどうか
    title: null,
    author: null,
    thumbnail: {
      url: null,
      width: 0,
      height: 0,
      type: null
    },
    url: null
  },
  // 要素はページ遷移時にクリアした後、動画再生ページの場合は取得を開始する
  elements: {},
  elementsReady: {},
  // ステータスはページ遷移時にクリアした後、動画再生ページの場合は開始する
  status: {
    playing: false,
    // "ad-xxx", "video", "supporter", "nextVideo", "error", "unknown", "loading"
    type: null,
    index: -1, // 動画のインデックス（必要に応じて追加）
    details: null // 詳細情報（必要に応じて追加）
  },
  checkAdSkipVideoId: 0, // 広告の動画を識別するためのID
  // 時間はcontrollerのタイマー変更時またはステータス変更時に更新される
  time: {
    current: null,  // 現在の再生時間（テキスト）
    duration: null, // 動画の総再生時間（テキスト）
  },
  pip: {
    status: null, // "enabled", "disabled", "otherElementEnabled"
    videoElement: null // PIP動画要素
  },
  // TODO: setterを作る
  image: {
    thumbnail: {
      url: null,
      data: null
    },
    supporterLogo: {
      url: null,
      data: null
    }
  },
  debug: {
    pip: {
      frameCount: 0,              // アニメーションフレームのカウント
      fps: 0,                     // FPS
      fpsLastUpdateTime: 0,       // FPSの更新時間
      fpsLastUpdateFrameCount: 0, // FPSの更新フレーム数
    },
    video: {
      // frameCount: 0, // 描画フレーム数
      // videoElement.getVideoPlaybackQuality().totalVideoFramesで取得可能
      fps: 0,                     // FPS
      fpsLastUpdateTime: 0,       // FPSの更新時間
      fpsLastUpdateFrameCount: 0  // FPS更新時のフレーム数
    },
    observer: { // key=Observer名, value=callback呼び出し回数
    }
  }
}
// -----------------------------------------------------------------------------

const exec_config_context_js = async function() {
}
