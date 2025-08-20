"use strict";

// イベント設定

// イベント名
const eventNamePrefix = `event-${prefixId}`;
// ステータス変更イベント名
const statusChangedEventName = `${eventNamePrefix}-statusChanged`;
// 要素の変更イベント名
const elementChangedEventName = `${eventNamePrefix}-elementChanged`;
// Observerのcallback実行イベント名（ステータス変更のトリガー）
const observerCallbackEventName = `${eventNamePrefix}-observerCallback`;
// サイトURLの変更イベント名
const pageUrlChangedEventName = `${eventNamePrefix}-pageUrlChanged`;
// 動画情報の変更イベント名
const videoInfoChangedEventName = `${eventNamePrefix}-videoInfoChanged`;
// プレイヤーの時間変更イベント名
const videoTimeChangedEventName = `${eventNamePrefix}-videoTimeChanged`;
// Stream変更時のイベント名
const streamChangedEventName = `${eventNamePrefix}-streamChanged`;
