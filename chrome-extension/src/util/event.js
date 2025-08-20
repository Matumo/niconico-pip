"use strict";

// イベント管理

// --- functions ---------------------------------------------------------------
let addEventListener = null;
let removeEventListener = null;
// -----------------------------------------------------------------------------

{
  // イベントリスナーの一覧
  // イベント名ごとに情報を格納する
  const eventList = {};

  // 登録済みのイベントリスナーの名前一覧を取得する関数
  function getRegisteredEventListenerNames() {
    return Object.keys(eventList);
  }

  // イベントリスナーを登録する関数
  addEventListener = function (_target, _eventListenerName, _eventName, _callback, _options = {}) {
    const target = _target;
    const eventListenerName = _eventListenerName;
    const eventName = _eventName;
    const callback = _callback;
    const options = _options;

    // 既にイベントリスナー名のイベントリスナーが登録されている場合はエラー
    if (eventList[eventListenerName]) {
      console.error(`Event listener for ${eventListenerName} already exists.`);
      return;
    }

    // イベントリスナー情報を登録
    eventList[eventListenerName] = {
      target: target,
      callback: callback,
      options: options,
      eventName: eventName
    };

    // イベントリスナーを登録
    target.addEventListener(eventName, callback, options);
    console.debug(`Event listener for ${eventName} added.`);

    // 登録済みのイベントリスナー名を取得してログ出力
    const registeredEventListenerNames = getRegisteredEventListenerNames();
    console.debug("Registered event listeners:", registeredEventListenerNames);
  }

  // イベントリスナーを削除する関数
  removeEventListener = function (_eventListenerName) {
    const eventListenerName = _eventListenerName;

    // イベントリスナー名が存在しない場合はエラー
    if (!eventList[eventListenerName]) {
      //console.debug(`Event listener for ${eventName} does not exist.`);
      return;
    }

    // イベントリスナー情報を取得
    const { target, callback, options } = eventList[eventListenerName];

    // イベントリスナーを削除
    target.removeEventListener(eventListenerName, callback, options);
    console.debug(`Event listener for ${eventListenerName} removed.`);

    // イベントリスナー情報を削除
    delete eventList[eventListenerName];

    // 登録済みのイベントリスナー名を取得してログ出力
    const registeredEventListenerNames = getRegisteredEventListenerNames();
    console.debug("Registered event listeners:", registeredEventListenerNames);
  }
}
