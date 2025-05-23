// 動画情報の取得

// --- function ----------------------------------------------------------------
let getVideoDataForMediaSession = null;
let getVideoThumbnail = null;
// -----------------------------------------------------------------------------

{
  // 動画情報を取得する関数
  function getVideoData() {
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

  // MediaSession用の動画情報を取得する関数
  getVideoDataForMediaSession = function() {
    const data = getVideoData();
    if (data) {
      const title = data.name;
      const author = data.author &&
                     data.author.name ? data.author.name : "unknown";
      const thumbnail_url = (data.thumbnail &&
                            data.thumbnail.length && data.thumbnail[0].url)
                            ? data.thumbnail[0].url :
                              (Array.isArray(data.thumbnailUrl) ? data.thumbnailUrl[0] : "");
      // サムネイルのサイズ情報も取得
      const thumbnail_width = data.thumbnail[0].width || 0;
      const thumbnail_height = data.thumbnail[0].height || 0;
      // サムネイルのtype（image/jpegなど）
      const thumbnail_type = data.thumbnail[0].type || "image/jpeg";
      // 返却値
      const result = {
        title: title,
        author: author,
        thumbnail: {
          url: thumbnail_url,
          width: thumbnail_width,
          height: thumbnail_height,
          type: thumbnail_type
        }
      };
      return result;
    } else {
      console.debug("VideoObject data not found.");
      return null;
    }
  }

  // サムネイルを取得する関数
  getVideoThumbnail = function() {
    const data = getVideoData();
    if (data) {
      const thumbnail_url = (data.thumbnail &&
                            data.thumbnail.length && data.thumbnail[0].url)
                            ? data.thumbnail[0].url :
                              (Array.isArray(data.thumbnailUrl) ? data.thumbnailUrl[0] : "");
      return thumbnail_url;
    } else {
      console.debug("VideoObject data not found.");
      return null;
    }
  }
}
