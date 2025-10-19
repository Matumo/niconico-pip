"use strict";

// 監視機能

// --- function ----------------------------------------------------------------
let startObserver = null;
let stopObserver = null;
let fireObserverCallback = null;
// -----------------------------------------------------------------------------

const exec_util_observer_js = async function() {
  // 監視リスト
  // name: { observer, targetElement }
  let observerList = {};

  // 監視リストの名前（文字列）を返す関数
  function getObserverListNames() {
    return Object.keys(observerList);
  }

  // observerCallbackイベントを発火する関数
  fireObserverCallback = function (name) {
    window.dispatchEvent(new CustomEvent(observerCallbackEventName, {
      detail: { observerName: name }
    }));
  }

  // 監視の開始
  // args:
  //   _name: 監視の名前
  //   _targetElement: 監視対象の要素
  //   _callback: 監視時に実行するコールバック関数（戻り値は監視を継続するかどうか: trueなら継続、falseなら停止）
  //   _observe_options: 監視オプション（MutationObserverのオプション）デフォルトは { childList: true }
  startObserver = function (_name, _targetElement, _callback, _observe_options = {}) {
    const name = _name;
    const targetElement = _targetElement;
    if (targetElement === null) {
      console.error("Target element is null.");
      return;
    }
    const callback = _callback;
    if (typeof callback !== 'function') {
      console.error("Callback is not a function.");
      return;
    }
    const observeOptions = _observe_options;

    // 既に監視中の場合はスキップ
    if (targetElement === observerList[name]?.targetElement) {
      console.debug(`Target element is same as current observer for ${name}. Skip.`);
      return;
    }

    // 既存の監視を解除
    stopObserver(name);

    // 初回実行して継続不要であれば終了
    if (!callback()) {
      console.debug(`Initial callback for ${name} returned false. No observer started.`);
      return;
    }

    // callbackがfalseを返したら監視を終了するラッパー関数を作成
    const wrappedCallback = function (...args) {
      const isContinue = callback(...args);
      if (!isContinue) stopObserver(name);
    };
    // 新しい監視を設定
    const observer = new MutationObserver(wrappedCallback);
    // 監視リストに追加
    observerList[name] = {
      observer: observer,
      targetElement: targetElement
    };

    // 監視の開始
    console.debug(`Starting observer for ${name}.`);
    observer.observe(targetElement, {
      childList: true,
      ...observeOptions
    });
    console.debug("Current observerList:", getObserverListNames());
  }

  // 監視の停止
  stopObserver = function (name) {
    if (observerList[name]?.observer) {
      console.debug(`Disconnecting observer for ${name}.`);
      observerList[name].observer.disconnect();
      delete observerList[name];
      console.debug("Current observerList:", getObserverListNames());
    } else {
      //console.warn(`No observer found for ${name}.`);
    }
  }
}
