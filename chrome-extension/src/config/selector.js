"use strict";

// セレクタ設定

// プレイヤーの要素セレクタ（r3相当の要素でコメント入力欄の高さの要素は含まれない）ここにPIP動画を挿入する
const selector_player = 'div.grid-area_\\[player\\] > div > div > div[data-styling-id]';

// コントローラー要素のセレクタ（再生バーと制御ボタンが含まれる）
//const selector_player_controller = selector_player + ' > div[data-styling-id] > div.max-h_watchController\\.height';
const selector_player_controller = 'div.grid-area_\\[player\\] > div > div' + ' div.max-h_watchController\\.height';
// コメント非表示ボタンのセレクタ（この手前にPIPボタンを追加する）
const selector_common_tooltip_button = 'button[data-scope="tooltip"][data-part="trigger"]';
const selector_player_controller_comment =
  selector_player_controller + ' ' + selector_common_tooltip_button + '[aria-label="コメントを非表示にする"], ' +
  selector_player_controller + ' ' + selector_common_tooltip_button + '[aria-label="コメントを表示する"]';
// 再生ボタンのセレクタ
const selector_player_controller_play =
  selector_player_controller + ' ' + selector_common_tooltip_button + '[aria-label="一時停止する"], ' +
  selector_player_controller + ' ' + selector_common_tooltip_button + '[aria-label="再生する"]';
// ミュートボタンのセレクタ
const selector_player_controller_mute =
  selector_player_controller + ' ' + selector_common_tooltip_button + '[aria-label="ミュートする"], ' +
  selector_player_controller + ' ' + selector_common_tooltip_button + '[aria-label="ミュートを解除する"]';
// 10秒戻るボタンのセレクタ
const selector_player_controller_seekBackward =
  selector_player_controller + ' ' + selector_common_tooltip_button + '[aria-label="10 秒戻る"]';
// タイマーのセレクタ
const selector_player_controller_timer = selector_player_controller_seekBackward + ' + div';
// タイマーの現在時間のセレクタ
const selector_player_controller_timer_currentTime = selector_player_controller_timer + ' > span:first-of-type';
// タイマーの合計時間のセレクタ
const selector_player_controller_timer_duration = selector_player_controller_timer + ' > span:last-of-type';
// 10秒送るボタンのセレクタ
const selector_player_controller_seekForward =
  selector_player_controller + ' ' + selector_common_tooltip_button + '[aria-label="10 秒送る"]';

// メニュー要素のセレクタ（r5相当の要素で動画などのコンテンツとコメントが含まれる）
const selector_player_menu =
  selector_player + ' > div[data-scope="menu"][data-part="context-trigger"]';
// コンテンツ要素のセレクタ（動画や広告などが含まれる）
const selector_player_menu_contents = selector_player_menu + ' div[data-name="content"]';
// 動画要素のセレクタ
const selector_player_menu_contents_video = selector_player_menu_contents + ' > video[data-name="video-content"]';
// ニコニ貢献のセレクタ
const selector_player_menu_contents_supporter = selector_player_menu_contents + ' > div[data-name="supporter-content"]';
// ニコニ貢献のキャンバスのセレクタ
const selector_player_menu_contents_supporter_canvas = selector_player_menu_contents_supporter + ' > canvas';
// ニコニ貢献ロゴのセレクタ
const selector_player_menu_contents_supporter_logo = selector_player_menu_contents_supporter + ' > div > img';
// コメント要素のセレクタ
const selector_player_menu_comments = selector_player_menu + ' div[data-name="comment"] > canvas';

// 次の動画紹介のセレクタ
const selector_player_nextVideo = selector_player + ' > div > div.w_\\[440px\\]';
// 次の動画に移動するまでの残り秒数
const selector_player_nextVideo_remainingTime =
  selector_player_nextVideo + ' > div.d_flex.ai_center.jc_space-between > p';
// 次の動画に移動するまでのプログレス値
const selector_player_nextVideo_progress =
  selector_player_nextVideo + ' div[data-scope="progress"][data-part="track"][role="progressbar"]';
// 次の動画のリンク
const selector_player_nextVideo_link = selector_player_nextVideo + ' a[data-anchor-page="watch"]';
// 次の動画のサムネイル
const selector_player_nextVideo_thumbnail = selector_player_nextVideo_link + ' img';
// 次の動画の広告枠（次の動画紹介のセレクタ配下）
const selector_player_nextVideo_adBox_suffix = ' > div[data-group="true"][data-anchor="1"][data-anchor-page="watch"][data-anchor-area="player"][data-anchor-href][data-decoration-video-id] > div[class="pos_relative"] > img';
// 次の動画の広告枠
const selector_player_nextVideo_adBox = selector_player_nextVideo + selector_player_nextVideo_adBox_suffix;
// キャンセルボタン
//const selector_player_nextVideo_cancelButton =
//  selector_player_nextVideo + ' button[data-element-page="watch"][data-element-area="player"][data-element-name="next_video_confirmation_cancel"]';
// 今すぐ再生ボタン
const selector_player_nextVideo_playNowButton =
  selector_player + ' > div a[data-element-page="watch"][data-element-area="player"][data-element-name="next_video_confirmation_play_now"]';

// 広告のセレクタ
const selector_player_ad = selector_player + ' div#nv_watch_VideoAdContainer';
// 広告の動画要素のセレクタ（複数のケースあり。広告ブロッカーが有効な場合は存在しない）
const selector_player_ad_video = selector_player_ad + ' > div > div > video';
// 広告スキップボタンのセレクタ（いきなり動画紹介の場合のみ存在する）
const selector_player_ad_skipButton = selector_player_ad + ' > button.pos_absolute';

// セレクタ一覧
const selectorList = {
  // プレイヤー要素
  player: {
    player: selector_player,
  },
  // コントローラー要素
  controller: {
    controller: selector_player_controller,
    playBtn: selector_player_controller_play,
    muteBtn: selector_player_controller_mute,
    seekBackwardBtn: selector_player_controller_seekBackward,
    timer: selector_player_controller_timer,
    timerCurrentTime: selector_player_controller_timer_currentTime,
    timerDuration: selector_player_controller_timer_duration,
    seekForwardBtn: selector_player_controller_seekForward,
    commentBtn: selector_player_controller_comment,
  },
  // メニュー要素
  menu: {
    menu: selector_player_menu,
    contents: selector_player_menu_contents,
    video: selector_player_menu_contents_video,
    comments: selector_player_menu_comments,
    supporter: selector_player_menu_contents_supporter,
    supporterCanvas: selector_player_menu_contents_supporter_canvas,
    //supporterLogo: selector_player_menu_contents_supporter_logo
  },
  // 次の動画紹介
  nextVideo: {
    nextVideo: selector_player_nextVideo,
    nextVideoRemainingTime: selector_player_nextVideo_remainingTime,
    nextVideoProgress: selector_player_nextVideo_progress,
    nextVideoLink: selector_player_nextVideo_link,
    nextVideoThumbnail: selector_player_nextVideo_thumbnail,
    //nextVideoAdBox: selector_player_nextVideo_adBox,
    //nextVideoCancelBtn: selector_player_nextVideo_cancelButton,
    nextVideoPlayNowBtn: selector_player_nextVideo_playNowButton
  },
  // 広告
  ad: {
    ad: selector_player_ad,
    adVideo: selector_player_ad_video,
    //adSkipButton: selector_player_ad_skipButton
  }
};
