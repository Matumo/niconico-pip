"use strict";

// コンテキスト

// --- function ----------------------------------------------------------------
let clearInfoContext = null;
let updateInfoContext = null;
let clearElementContext = null;
let updateElementContext = null;
let clearStatusContext = null;
let updateStatusContext = null;
let clearTimeContext = null;
let updateTimeContext = null;
let incCheckAdSkipVideoId = null;
// -----------------------------------------------------------------------------

{
  incCheckAdSkipVideoId = function () {
    // checkAdSkipVideoIdをインクリメント
    context.checkAdSkipVideoId++;
    return context.checkAdSkipVideoId;
  }

  clearTimeContext = function () {
    updateTimeContext(null, null);
  }

  updateTimeContext = function (_currentTime, _duration) {
    const currentTime = _currentTime;
    const duration = _duration;
    // 変更がない場合は何もしない（current, durationを比較）
    if (context.time.current === currentTime && context.time.duration === duration) {
      //console.debug("Video time is unchanged. Skip update.");
      return;
    }
    // 時間を更新
    context.time.current = currentTime;
    context.time.duration = duration;
    // イベントを発火
    //console.debug("{Event} Video time changed:", currentTime, duration);
    window.dispatchEvent(new CustomEvent(videoTimeChangedEventName, {
      detail: {
        currentTime: currentTime,
        duration: duration
      }
    }));
  }

  clearStatusContext = function () {
    updateStatusContext(null);
  }

  updateStatusContext = function (_status) {
    const status = _status;
    // 変更がない場合は何もしない（playing, typeを比較）
    if ((!status && !context.status.type) ||
        (status && status.playing === context.status.playing &&
          status.type === context.status.type &&
          status.index === context.status.index &&
          status.details === context.status.details)) {
      //console.debug("Video status is unchanged. Skip update.");
      return;
    }
    // statusがnullの場合はクリア
    const prevStatus = Object.assign({}, context.status);
    if (!status) {
      context.status.playing = false;
      context.status.type = null;
      context.status.index = -1;
      context.status.details = null;
    } else {
      context.status.playing = status.playing;
      context.status.type = status.type;
      context.status.index = status.index;
      context.status.details = status.details || null;
    }
    // イベントを発火
    console.debug("{Event} Video status changed:", status, "prev:", prevStatus);
    window.dispatchEvent(new CustomEvent(statusChangedEventName, {
      detail: {
        status: status,
        prevStatus: prevStatus
      }
    }));
  }

  // context.elementsの初期化
  {
    for (const category in selectorList) {
      context.elements[category] = {};
      for (const name in selectorList[category]) {
        if (selectorList[category].hasOwnProperty(name)) {
          context.elements[category][name] = null;
          context.elementsReady[category] = false;
        }
      }
    }
  }

  clearInfoContext = function () {
    updateInfoContext(null);
  }

  updateInfoContext = function (_info) {
    const info = _info;
    // 変更がない場合は何もしない（title, author, urlを比較）
    if ((!info && !context.info.ready) ||
        (info && info.title === context.info.title &&
         info.author === context.info.author && info.url === context.info.url)) {
      console.debug("Video info is unchanged. Skip update.");
      return;
    }
    // infoがnullの場合はクリア
    if (!info) {
      context.info.ready = false;
      context.info.title = null;
      context.info.author = null;
      context.info.thumbnail.url = null;
      context.info.thumbnail.width = 0;
      context.info.thumbnail.height = 0;
      context.info.thumbnail.type = null;
      context.info.url = null;
    } else {
      context.info.ready = true;
      context.info.title = info.title;
      context.info.author = info.author;
      context.info.thumbnail = info.thumbnail;
      context.info.url = info.url;
    }
    // イベントを発火
    //console.debug("{Event} Video info changed:", info ? info : "cleared");
    console.debug("{Event} Video info changed:", info);
    window.dispatchEvent(new CustomEvent(videoInfoChangedEventName, {
      detail: {
        info: info
      }
    }));
  }

  clearElementContext = function () {
    for (const category in selectorList) {
      for (const name in selectorList[category]) {
        if (selectorList[category].hasOwnProperty(name)) {
          updateElementContext(category, name, null);
        }
      }
    }
  }

  function compareListElements(prevList, newList) {
    if (!prevList || !newList) return false;
    if (prevList.length !== newList.length) return false;
    for (let i = 0; i < prevList.length; i++) {
      if (prevList[i] !== newList[i]) return false;
    }
    return true;
  }

  updateElementContext = function (_category, _name, _element) {
    const category = _category;
    const name = _name;
    const element = _element;
    const prevElement = context.elements[category][name];
    // 既に同じ要素が設定されている場合は何もしない
    if (prevElement === element) {
      //console.debug(`Element for ${name} is already set. Skip.`);
      return;
    }
    // adVideoの場合はリストの中身を比較
    if (category?.startsWith("ad-") && name === "adVideo" && prevElement && element) {
      const result = compareListElements(prevElement, element);
      if (result) return; // リストの中身が同じ場合は何もしない
      // 要素が異なる場合は更新
      console.debug(`Ad video element changed. Previous:`, prevElement, `New:`, element);
    }
    // 要素を更新
    context.elements[category][name] = element;
    // カテゴリの要素がすべて設定されているかチェック
    {
      let allSet = true;
      for (const key in context.elements[category]) {
        if (context.elements[category].hasOwnProperty(key)) {
          if (!context.elements[category][key]) {
            allSet = false;
            break;
          }
        }
      }
      // カテゴリの要素がすべて設定されている場合は、readyフラグを立てる
      context.elementsReady[category] = allSet;
    }
    //console.debug(`Updated context for ${category}.${name}:`, element);
    // イベントを発火
    console.debug("{Event} Element changed:", category, name, element ? "set" : "cleared");
    window.dispatchEvent(new CustomEvent(elementChangedEventName, {
      detail: {
        category: category,
        name: name,
        element: element
      }
    }));
  }
}
