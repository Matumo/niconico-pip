// 動作確認用のデバッグコード（スクラッチ）
//
// このファイルは拡張の isolated world 内で最後に読み込まれるため、他ファイルの
// const/let（selectors・イベント名・regex・videoPipElement・独自console 等）にそのまま触れる。
// ここで console.* を出すと [niconico-pip] prefix が付き、dev/pip-dev.sh logs で捕捉できる。
// 出力は debugMode（00-debug.js）が true のときだけにすること。
// 調査用コードはここに一時的に書き、動作確認が終わったら消す（中身は空でよい）。
// 読み込み登録は manifest.json の content_scripts。詳細は dev/docs/README.md を参照。
