"use strict";

// 要素の監視機能

// --- function ----------------------------------------------------------------
let startElementObserver = null;
let stopElementObserver = null;
// -----------------------------------------------------------------------------

const exec_observer_elements_js = async function() {
  // 監視リスト
  const observerNameList = {
    playerElement: "phase1-playerElement",
      controllerElements: "phase1.1-controllerElements",
        observePlayerForever: "phase1.1.1-observePlayerForever",
        // DEBUG: Observer軽量化モード無効化フラグが無効の場合のみ有効化
        playbackStatusForever: debug_observerLightModeDisabled ? undefined : "phase1.1.2-playbackStatusForever"
  };

  // --- ユーティリティ関数 -------------------------------------------------------

  // セレクタリストの要素を取得して返す関数
  function getElements(_selectors) {
    const selectors = _selectors;
    const elements = {};
    for (const key in selectors) {
      if (selectors.hasOwnProperty(key)) {
        if (key === "adVideo") {
          elements[key] = document.querySelectorAll(selectors[key]);
          if (elements[key].length === 0) {
            console.debug("Element not found:", key);
            return null;
          }
        } else {
          elements[key] = document.querySelector(selectors[key]);
          if (!elements[key]) {
            console.debug("Element not found:", key);
            return null;
          }
        }
      }
    }
    return elements;
  }

  // 要素の取得とコンテキストの更新を行う関数
  function getAndSetElements(_category, _selectors) {
    const category = _category;
    const selectors = _selectors;
    // 要素の取得
    const elements = getElements(selectors);
    if (!elements) return true; // 監視を継続する
    // 取得完了
    console.debug(`Element found: ${category}`);
    // コンテキストを更新
    for (const key in elements) {
      if (elements.hasOwnProperty(key)) {
        updateElementContext(category, key, elements[key]);
      }
    }
    return false; // 監視を継続しない
  }

  // シークバーの大量発生するMutationRecordを検出する関数
  function isSeekBarMutation(mutations) {
    // 再生バーにカーソルを合わせたときに発生する大量の要素変更に関する対策
    // MutationRecordが1つ、addedNodesが1つ、removeNodesが1つ
    // それぞれのtargetがspan要素のとき、処理をスキップする
    return mutations?.length === 1 &&
           mutations[0]?.addedNodes?.length === 1 &&
           mutations[0]?.removedNodes?.length === 1 &&
           mutations[0]?.target?.tagName?.toLowerCase() === 'span';
  }

  // ---------------------------------------------------------------------------



  // --- 再生ボタン要素の監視（永続的）----------------------------------------------

  // 再生ボタン要素の状態変化を監視を永続的に行う関数
  function observePlaybackStatusForever() {
    if (debug_observerLightModeDisabled) return; // DEBUG: Observer軽量化モード無効化フラグが有効の場合は処理をスキップ
    const observerName = observerNameList.playbackStatusForever;
    const playerButtonElement = context.elements.controller.playBtn;
    if (!playerButtonElement) {
      console.warn("Playback button element not found.");
      return;
    }

    // コールバック関数
    const callback = function () {
      // observerCallbackイベントを発火
      fireObserverCallback(observerName);
      return true; // 監視を継続する
    };

    // 監視の開始
    startObserver(observerName, playerButtonElement, callback, {
      attributes: true,
      attributeFilter: ['data-state']
    });
    console.debug(`Started observing for ${observerName}.`);
  }

  // 再生ボタン要素の永続的な監視を開始するイベントリスナー
  addEventListener(window, "コントローラー要素の変更時に再生ボタン要素の永続的な監視を開始",
                   elementChangedEventName, (event) => {
    if (debug_observerLightModeDisabled) return; // DEBUG: Observer軽量化モード無効化フラグが有効の場合は処理をスキップ
    const { detail } = event;
    const category = detail.category;
    const name = detail.name;
    const element = detail.element;
    if (category === "controller" && name === "playBtn" && element) {
      observePlaybackStatusForever();
    }
  });

  // ---------------------------------------------------------------------------



  // --- プレイヤー要素の監視（永続的）----------------------------------------------

  // プレイヤー要素の監視を永続的に行う関数
  function observePlayerForever() {
    const observerName = observerNameList.observePlayerForever;
    const playerElement = context.elements.player.player;
    if (!playerElement) {
      console.warn("Player element not found.");
      return;
    }

    // コールバック関数
    const callback = function (mutations) {
      // 再生バーにカーソルを合わせたときに発生する大量の要素変更に関する対策
      if (isSeekBarMutation(mutations)) return true; // 監視を継続する
      // observerCallbackイベントを発火
      fireObserverCallback(observerName);
      // 要素の取得と設定
      getAndSetElements("menu", selectorList.menu);
      getAndSetElements("nextVideo", selectorList.nextVideo);
      getAndSetElements("ad", selectorList.ad);
      return true; // 監視を継続する
    };

    // 監視の開始
    startObserver(observerName, playerElement, callback, {
      childList: true,
      subtree: debug_observerLightModeDisabled // DEBUG: Observer軽量化モード無効化フラグが有効の場合はsubtreeを有効化
    });
    console.debug(`Started observing for ${observerName}.`);
  }

  // プレイヤー要素の永続的な監視を開始するイベントリスナー
  addEventListener(window, "コントローラー要素の変更時にプレイヤー要素の永続的な監視を開始",
                   elementChangedEventName, (event) => {
    const { detail } = event;
    const category = detail.category;
    const name = detail.name;
    const element = detail.element;
    if (category === "controller" && name === "controller" && element) {
      observePlayerForever();
    }
  });

  // ---------------------------------------------------------------------------



  // --- コントローラー要素の監視 -------------------------------------------------

  // コントローラー要素の監視を開始する関数
  function setControllerElements() {
    const observerName = observerNameList.controllerElements;
    const playerElement = context.elements.player.player;
    if (!playerElement) {
      console.warn("Player element not found.");
      return;
    }

    // コールバック関数
    const callback = function (mutations) {
      // 再生バーにカーソルを合わせたときに発生する大量の要素変更に関する対策
      if (isSeekBarMutation(mutations)) return true; // 監視を継続する
      // observerCallbackイベントを発火
      fireObserverCallback(observerName);
      // 要素の取得と設定
      const res = getAndSetElements("controller", selectorList.controller);
      if (!res) return true; // 監視を継続する
      // DEBUG: Observer軽量化モード無効化フラグが有効の場合は永続的な監視を開始
      if (debug_observerLightModeDisabled) observePlayerForever(); // プレイヤー要素の永続的な監視を開始
      if (debug_observerLightModeDisabled) observePlaybackStatusForever(); // 再生ボタン要素の永続的な監視を開始
      return false; // 監視を継続しない
    };

    // 監視の開始
    startObserver(observerName, playerElement, callback, {
      childList: true,
      subtree: debug_observerLightModeDisabled // DEBUG: Observer軽量化モード無効化フラグが有効の場合はsubtreeを有効化
    });
    console.debug(`Started observing for ${observerName}.`);
  }

  // コントローラー要素の監視を開始するイベントリスナー
  addEventListener(window, "プレイヤー要素の変更時にコントローラー要素の監視を開始",
                   elementChangedEventName, (event) => {
    const { detail } = event;
    const category = detail.category;
    const name = detail.name;
    const element = detail.element;
    if (category === "player" && name === "player" && element) {
      // プレイヤー要素が取得可能になったらコントローラー要素の監視を開始
      setControllerElements();
    }
  });

  // bodyに対してラジオボタンの変更を監視
  addEventListener(document.body, "動画プレイヤー設定の変更時にコントローラー要素の再取得を開始",
                  "change", (event) => {
    // 動画プレイヤー設定の「コントローラーを常に表示」を切り替えた際にPIPボタンを再描画するための処理
    if (event.target.matches('input[type="radio"]')) {
      console.debug("Controller setting changed, re-observing controller elements.");
      // コントローラー要素の再取得
      setControllerElements();
    }
  });

  // ---------------------------------------------------------------------------



  // --- プレイヤー要素の監視（初回） -----------------------------------------------

  // プレイヤー要素の監視を開始する関数
  function setPlayerElement() {
    const observerName = observerNameList.playerElement;
    const selector = selectorList.player.player;

    // コールバック関数
    const callback = function () {
      // observerCallbackイベントを発火
      fireObserverCallback(observerName);
      // 要素の取得
      const playerElement = document.querySelector(selector);
      if (!playerElement) {
        console.debug("Element not found:", observerName);
        return true; // 監視を継続する
      }
      // 取得完了
      console.debug(`Element found: ${observerName}`);
      // コンテキストを更新
      updateElementContext("player", "player", playerElement);
      // DEBUG: Observer軽量化モード無効化フラグが有効の場合はコントローラー要素の監視を開始
      if (debug_observerLightModeDisabled) setControllerElements(); // コントローラー要素の監視を開始
      return false; // 監視を継続しない
    };

    // 監視の開始
    startObserver(observerName, document, callback, {
      childList: true,
      subtree: true
    });
    console.debug(`Started observing for ${observerName}.`);
  }

  // 監視の開始
  startElementObserver = function () {
    setPlayerElement();
  }

  // ---------------------------------------------------------------------------



  // --- 監視の停止 -------------------------------------------------------------

  // 監視の停止
  stopElementObserver = function () {
    for (const observerName in observerNameList) {
      if (observerNameList.hasOwnProperty(observerName)) {
        stopObserver(observerNameList[observerName]);
      }
    }
    console.debug("Stopped all element observers.");
  }
}
