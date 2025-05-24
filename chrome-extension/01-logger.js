// カスタムロガー

// --- variable ----------------------------------------------------------------
const originalConsole = window.console;
let console = Object.create(originalConsole);
// -----------------------------------------------------------------------------

{
  // prefixを追加
  console.log = function(...args) { originalConsole.log(logPrefix, ...args); };
  console.info = function(...args) { originalConsole.info(logPrefix, ...args); };
  console.warn = function(...args) { originalConsole.warn(logPrefix, ...args); };
  console.error = function(...args) { originalConsole.error(logPrefix, ...args); };
  console.debug = function(...args) { originalConsole.debug(logPrefix, ...args); };

  // ログレベルに応じて出力を制御
  const logLevels = {
    "error": 4,
    "warn": 3,
    "info": 2,
    "log": 1,
    "debug": 0
  };
  const currentLogLevel = logLevels[logLevel];
  console.log = currentLogLevel <= logLevels["log"] ? console.log : function(...args) {};
  console.info = currentLogLevel <= logLevels["info"] ? console.info : function(...args) {};
  console.warn = currentLogLevel <= logLevels["warn"] ? console.warn : function(...args) {};
  console.error = currentLogLevel <= logLevels["error"] ? console.error : function(...args) {};
  console.debug = currentLogLevel <= logLevels["debug"] ? console.debug : function(...args) {};

  console.log('Custom logger initialized with level:', logLevel);
}
