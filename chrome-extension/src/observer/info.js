"use strict";

// 動画情報の取得

// --- function ----------------------------------------------------------------
let startInfoObserver = null;
let stopInfoObserver = null;
// -----------------------------------------------------------------------------

const exec_observer_info_js = async function() {
  const observerName = "videoInfo";

  // 動画情報を取得する関数
  function getJsonData() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      let data;
      try {
        data = JSON.parse(script.textContent);
      } catch (e) {
        continue; // パース失敗はスキップ
      }
      // 配列の場合も考慮
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item['@type'] === "VideoObject") return item;
        }
      } else if (data['@type'] === "VideoObject") {
        return data;
      }
    }
    return null;
  }

  // URLからパラメータを除去する関数
  function removeUrlParams(url) {
    try {
      const urlObj = new URL(url);
      urlObj.search = ""; // パラメータを除去
      return urlObj.toString();
    } catch (e) {
      console.error("Invalid URL:", url, e);
      return null;
    }
  }

  // データ抽出
  function getInfo() {
    const data = getJsonData();
    //console.debug("Extracted VideoObject data:", data);
    if (data) {
      // パラメーターを除いたページURLと動画情報のURLが一致しない場合はスキップ
      {
        const url1 = removeUrlParams(data.url);
        const url2 = removeUrlParams(context.page.url);
        //console.debug("Comparing URLs:", url1, url2);
        if (!url1 || !url2) {
          console.error("Invalid URL format. Skip.",
                        "Page URL:", context.page.url,
                        "VideoObject URL:", data.url);
          return null;
        }
        if (url1 !== url2) {
          console.debug("VideoObject URL does not match page URL. Skip.",
                        "Page URL:", context.page.url,
                        "VideoObject URL:", data.url);
          return null;
        }
      }
      // 動画情報の抽出
      const title = data.name;
      const author = data.author &&
                     data.author.name ? data.author.name : "unknown";
      const thumbnail_url = (data.thumbnail &&
                            data.thumbnail.length && data.thumbnail[0].url)
                            ? data.thumbnail[0].url :
                              (Array.isArray(data.thumbnailUrl) ? data.thumbnailUrl[0] : "");
      const thumbnail_width = data.thumbnail[0].width || 0;
      const thumbnail_height = data.thumbnail[0].height || 0;
      const thumbnail_type = data.thumbnail[0].type || "image/jpeg";
      const url = data.url || "";
      // 返却値
      const result = {
        title: title,
        author: author,
        thumbnail: {
          url: thumbnail_url,
          width: thumbnail_width,
          height: thumbnail_height,
          type: thumbnail_type
        },
        url: url
      };
      return result;
    } else {
      console.debug("VideoObject data not found.");
      return null;
    }
  }

  startInfoObserver = function () {
    // コールバック関数
    const callback = function () {
      // observerCallbackイベントを発火
      fireObserverCallback(observerName);
      // 動画情報の取得
      const info = getInfo();
      if (!info) return true; // 監視を継続する
      // コンテキストを更新
      updateInfoContext(info);
      return false; // 監視を継続しない
    };

    // 監視の開始
    startObserver(observerName, document.head, callback,
                  { childList: true, subtree: true, attributes: true });
    console.debug(`Started observer for ${observerName}.`);
  }

  stopInfoObserver = function () {
    // 監視を停止する
    stopObserver(observerName);
    console.debug(`Stopped observer for ${observerName}.`);
  }
}
