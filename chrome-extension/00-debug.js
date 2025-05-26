// デバッグモード設定
const debugMode = false;

// gitの追跡除外設定（ローカル設定）
//   git update-index --assume-unchanged chrome-extension/00-debug.js
// 設定解除
//   git update-index --no-assume-unchanged chrome-extension/00-debug.js

// animationFrameのFPS計測
function measureFps(durationMs, callback) {
  let frameCount = 0;
  let startTime = performance.now();
  function countFrames() {
    frameCount++;
    const currentTime = performance.now();
    if (currentTime - startTime >= durationMs) {
      const fps = frameCount / (durationMs / 1000);
      callback(fps);
    } else {
      requestAnimationFrame(countFrames);
    }
  }
  requestAnimationFrame(countFrames);
}

// FPSを計測してコンソールに出力
if (debugMode) {
  let count = 0;
  let results = [];
  const func = () => {
    measureFps(1000, (fps) => {
      console.debug(`[FPS] ${fps.toFixed(2)} fps`);
      results.push(fps);
      count++;
      if (count < 10) func();
      else {
        // 中央値を出力
        results.sort((a, b) => a - b);
        const median = results[Math.floor(results.length / 2)];
        console.debug(`[FPS] Median: ${median.toFixed(2)} fps`);
      }
    });
  };
  func();
}
