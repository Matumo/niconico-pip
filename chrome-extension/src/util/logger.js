"use strict";

// カスタムロガー

// --- variable ----------------------------------------------------------------
const originalConsole = window.console;
let console = Object.create(originalConsole);
// -----------------------------------------------------------------------------

{
  // ログレベル
  const logLevels = {
    "error": 4,
    "warn": 3,
    "info": 2,
    "log": 1,
    "debug": 0
  };
  const currentLogLevel = logLevels[logLevel];

  // 呼び出し元を示す文字列を取得する関数（パス版）
  function getCallerLocation(depth = 3) {
    const stack = new Error().stack;
    const lines = stack?.split('\n');
    return lines?.[depth]?.trim().replace(/^at\s+/, '') || '';
  }

  // 呼び出し元を示す文字列を取得する関数（ファイル名のみ短縮版）
  function getCallerLocationShort(depth = 3) {
    const stack = new Error().stack;
    const lines = stack?.split('\n');
    const target = lines?.[depth]?.trim().replace(/^at\s+/, '') || '';
    const m = target.match(/([^\/\\]+\.js:\d+:\d+)/);
    return m ? m[1] : target;
  }

  // オーバーライド
  console = new Proxy(originalConsole, {
    get(target, prop) {
      const levelValue = logLevels[prop];
      // ログレベル管理対象かつ関数ならラップ
      if (typeof target[prop] === "function" && typeof levelValue === "number") {
        return (...args) => {
          // 出力対象のログレベルはprefixを付けて出力
          // 経過時間とcallerを取得してログに追加する
          if (currentLogLevel <= levelValue) {
            const now = performance.now();
            const sufix = logSufixType === 'short' ? `@${getCallerLocationShort()}` :
              logSufixType === 'long' ? `@${getCallerLocation()}` : '';
            // 元のconsoleの関数を呼び出す
            target[prop](logPrefix, `(${now.toFixed(1)} ms)`, ...args, sufix);
          }
        };
      }
      // 他は元のconsoleそのまま
      return target[prop];
    }
  });

  console.log('Custom logger initialized.',
              `Log level: ${logLevel},`,
              `Date: ${new Date().toISOString()}`);
}
