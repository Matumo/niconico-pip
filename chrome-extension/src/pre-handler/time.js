"use strict";

// 再生時間のキャッシュ更新処理
{
  // タイマーが更新されるときに動画時間のキャッシュを更新する
  addEventListener(window, "再生時間の変更時に動画時間のキャッシュを更新", videoTimeChangedEventName, () => {
    updateTimeCaches();
  });

  // 要素が変更されたときに動画時間のキャッシュを更新する
  addEventListener(window, "ステータスの変更時に動画時間のキャッシュを更新", statusChangedEventName, () => {
    updateTimeCaches();
  });
}
