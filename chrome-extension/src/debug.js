"use strict";

// デバッグ用
const exec_debug_js = async function() {
  console.log("Debug mode is " + (debugMode ? "enabled" : "disabled") + ".");
  if (!debugMode) return;

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

  // // FPSを計測してコンソールに出力
  // if (debugMode) {
  //   let count = 0;
  //   let results = [];
  //   const func = () => {
  //     measureFps(1000, (fps) => {
  //       console.debug(`[FPS] ${fps.toFixed(2)} fps`);
  //       results.push(fps);
  //       count++;
  //       if (count < 10) func();
  //       else {
  //         // 中央値を出力
  //         results.sort((a, b) => a - b);
  //         const median = results[Math.floor(results.length / 2)];
  //         console.debug(`[FPS] Median: ${median.toFixed(2)} fps`);
  //       }
  //     });
  //   };
  //   func();
  // }

  // コンテナ作成
  const { leftBottomContainerList, rightBottomContainerList } = (() => {
    // createDebugContainers(`${prefixId}-left-bottom-debug`, 'left bottom');
    function createDebugContainers(id, pos) {
      const container = document.createElement('div');
      container.id = id;
      container.style.position = 'fixed';
      const posList = pos.split(' ');
      for (const p of posList) {
        container.style[p] = '10px'; // 10pxのマージン
      }
      container.style.zIndex = '9999';
      container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      container.style.padding = '15px';
      // 先頭タイトル
      const title = document.createElement('div');
      title.textContent = '<< DEBUG >>';
      container.appendChild(title);
      // コンテナリスト
      const containerList = [];
      for (let i = 0; i < 10; i++) {
        const div = document.createElement('div');
        container.appendChild(div);
        containerList.push(div);
      }
      return { container, containerList };
    }
    const { container: leftBottomContainer, containerList: leftBottomContainerList } =
      createDebugContainers(`${prefixId}-left-bottom-debug`, 'left bottom');
    const { container: rightBottomContainer, containerList: rightBottomContainerList } =
      createDebugContainers(`${prefixId}-right-bottom-debug`, 'right bottom');
    // main要素の中に追加
    addEventListener(window, "debug-ステータス更新時にmain要素にコンテナ2つを追加", statusChangedEventName, () => {
      // コンテナがすでに存在する場合はスキップ
      if (document.getElementById(leftBottomContainer.id) || document.getElementById(rightBottomContainer.id)) {
        console.debug("Debug containers already exist, skipping creation.");
        return;
      }
      // 追加た仕様が存在しない場合はスキップ（次回の実行で対応する）
      const mainElement = document.querySelector('main');
      if (!mainElement) {
        console.warn("Main element not found, appending to body.");
        return;
      }
      mainElement.appendChild(leftBottomContainer);
      mainElement.appendChild(rightBottomContainer);
      console.debug("Debug containers created and added to main element.");
    });
    return { leftBottomContainerList, rightBottomContainerList };
  })();
  function addContainer(pos, index, element, override = true) {
    if (pos.includes('left') && pos.includes('bottom')) {
      if (override) leftBottomContainerList[index].innerHTML = '';
      leftBottomContainerList[index].appendChild(element);
    } else if (pos.includes('right') && pos.includes('bottom')) {
      if (override) rightBottomContainerList[index].innerHTML = '';
      rightBottomContainerList[index].appendChild(element);
    }
  }

  // テキスト要素の追加更新
  function addTextElement(name, text, pos = 'left bottom', index) {
    const spanId = `${prefixId}-${name}-debug-span`;
    // 要素が存在しない場合は追加
    let span = document.getElementById(spanId);
    if (!span) {
      span = document.createElement('span');
      span.id = spanId;
      span.style.fontSize = '20px';
      span.style.fontFamily = fontFamily;
      span.style.color = 'white';
      span.style.whiteSpace = 'pre-line'; // \nで改行を有効にする
      span.style.margin = '10px 0'; // 上下 左右
      // 文字を縁取り
      span.style.webkitTextStroke = '3px black';
      span.style.textStroke = '3px black';
      span.style.paintOrder = 'stroke';
      // コンテナに追加
      addContainer(pos, index, span);
      console.debug(`Text element created: ${spanId}`);
    }
    // テキストを更新
    span.textContent = text;
  }

  // ステータスを表示
  if (debug_viewStatus) {
    // PIPステータスの表示
    function drawPipStatus(status) {
      console.debug("Drawing PIP status:", status);
      const name = 'debug-2-1';
      const text = `PiP: ${status}`;
      addTextElement(name, text, 'left bottom', 0);
    }
    // PIPステータス更新イベントはこのコードより先に発生するので、ここで明示的に初期描画する
    drawPipStatus(context.pip.status || 'unknown');
    addEventListener(window, "debug-PIPステータス更新時にステータスをコンテナに描画", pipStatusChangedEventName, (event) => {
      drawPipStatus(event.detail.status);
    });
    // 再生ステータスの表示
    addEventListener(window, "debug-再生ステータス更新時にステータスをコンテナに描画", statusChangedEventName, (event) => {
      const { detail } = event;
      const status = detail.status;
      const prev = detail.prevStatus;
      const name = 'debug-2-2';
      const text = `Current Status: ${status.playing ? 'Playing' : 'Paused'}, ` +
                   `Type: ${status.type || 'Unknown'}, Details: ${status.details || 'None'}\n` +
                   `Prev Status: ${prev.playing ? 'Playing' : 'Paused'}, ` +
                   `Type: ${prev.type || 'Unknown'}, Details: ${prev.details || 'None'}`;
      addTextElement(name, text, 'left bottom', 1);
    });
  }

  // 再生時間の表示
  if (debug_viewTime) {
    // 再生フレーム数とページ時間の表示
    // コンテナ（その1）を作成
    const fastUpdateInfoContainer = document.createElement('div');
    fastUpdateInfoContainer.id = `${prefixId}-fast-update-info-1`;
    fastUpdateInfoContainer.style.fontSize = '20px';
    fastUpdateInfoContainer.style.fontFamily = fontFamily;
    fastUpdateInfoContainer.style.color = 'white';
    fastUpdateInfoContainer.style.whiteSpace = 'pre-line'; // \nで改行を有効にする
    fastUpdateInfoContainer.style.margin = '10px 0'; // 上下 左右
    // span要素（その1）を作成
    const span1 = document.createElement('span');
    span1.id = `${prefixId}-fast-update-info-span-1`;
    span1.style.fontSize = '20px';
    span1.style.fontFamily = fontFamily;
    span1.style.color = 'white';
    span1.style.whiteSpace = 'pre-line'; // \nで改行を有効にする
    span1.style.margin = '10px 0'; // 上下 左右
    // 文字を縁取り
    span1.style.webkitTextStroke = '3px black';
    span1.style.textStroke = '3px black';
    span1.style.paintOrder = 'stroke';
    fastUpdateInfoContainer.appendChild(span1);
    addContainer('right bottom', 0, fastUpdateInfoContainer);
    // コンテナ（その2）を作成
    const fastUpdateInfoContainer2 = document.createElement('div');
    fastUpdateInfoContainer2.id = `${prefixId}-fast-update-info-2`;
    fastUpdateInfoContainer2.style.fontSize = '20px';
    fastUpdateInfoContainer2.style.fontFamily = fontFamily;
    fastUpdateInfoContainer2.style.color = 'white';
    fastUpdateInfoContainer2.style.whiteSpace = 'pre-line'; // \nで改行を有効にする
    fastUpdateInfoContainer2.style.margin = '10px 0'; // 上下 左右
    // span要素（その2）を作成
    const span2 = document.createElement('span');
    span2.id = `${prefixId}-fast-update-info-span-2`;
    span2.style.fontSize = '20px';
    span2.style.fontFamily = fontFamily;
    span2.style.color = 'white';
    span2.style.whiteSpace = 'pre-line'; // \nで改行を有効にする
    span2.style.margin = '10px 0'; // 上下 左右
    // 文字を縁取り
    span2.style.webkitTextStroke = '3px black';
    span2.style.textStroke = '3px black';
    span2.style.paintOrder = 'stroke';
    fastUpdateInfoContainer2.appendChild(span2);
    addContainer('right bottom', 1, fastUpdateInfoContainer2);

    addEventListener(window, "debug-再生時間更新時に再生時間をコンテナに描画", videoTimeChangedEventName, (event) => {
      const { detail } = event;
      const currentTime = detail.currentTime;
      const duration = detail.duration;
      const seekBarCurrentTime = getSeekBarCurrentTime();
      const seekBarDuration = getSeekBarDuration();
      const playerCurrentTime = getPlayerCurrentTime();
      const playerDuration = getPlayerDuration();
      const contentCurrentTime = getContentCurrentTime();
      const contentDuration = getContentDuration();
      // 時間を表示
      const name = 'debug-3';
      const text = `Player Text Current Time: ${currentTime}, Duration: ${duration}\n` +
                  `Player Current Time: ${playerCurrentTime < 0 ? 'N/A' : playerCurrentTime}, ` +
                  `Duration: ${playerDuration < 0 ? 'N/A' : playerDuration}\n` +
                  `SeekBar Current Time: ${seekBarCurrentTime < 0 ? 'N/A' : seekBarCurrentTime}, ` +
                  `Duration: ${seekBarDuration < 0 ? 'N/A' : seekBarDuration}\n` +
                  `Content Current Time: ${contentCurrentTime < 0 ? 'N/A' : contentCurrentTime}, ` +
                  `Duration: ${contentDuration < 0 ? 'N/A' : contentDuration}`;
      addTextElement(name, text, 'right bottom', 2);
    });
  }

  // ボタン作成関数
  function createButton(text, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.marginRight = '5px';
    button.style.fontFamily = fontFamily;
    // ボタンの周りに枠線を追加
    button.style.border = '2px solid #0078D4'; // Windowsのアクセントカラー
    button.style.borderRadius = '5px';
    button.style.padding = '5px 10px';
    button.style.backgroundColor = '#0078D4'; // Windowsのアクセントカラー
    button.style.color = 'white'; // 白文字
    button.style.cursor = 'pointer';
    button.style.transition = 'background-color 0.3s, color 0.3s';
    button.addEventListener('mouseover', () => {
      button.style.backgroundColor = '#005A9E'; // ホバー時の色
      button.style.color = 'white'; // ホバー時の文字色
    });
    button.addEventListener('mouseout', () => {
      button.style.backgroundColor = '#0078D4'; // 元の色に戻す
      button.style.color = 'white'; // 元の文字色に戻す
    });
    button.addEventListener('click', onClick);
    return button;
  }

  // コントローラーボタンの追加
  if (debug_viewController) {
    addEventListener(window, "debug-ステータス更新時にデバッグコントローラーを描画", statusChangedEventName, () => {
      const buttonContainerId = `${prefixId}-controller-buttons-debug-4`;
      // 既存のボタンコンテナがあればスキップ
      if (document.getElementById(buttonContainerId)) {
        console.debug("Controller buttons already exist, skipping creation.");
        return;
      }
      console.debug("Creating controller buttons.");
      // ボタンコンテナを作成
      const buttonContainer = document.createElement('div');
      buttonContainer.id = buttonContainerId;
      buttonContainer.style.zIndex = '9999';
      //buttonContainer.style.backgroundColor = 'rgb(255, 255, 255)';
      buttonContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
      buttonContainer.style.borderRadius = '5px';
      buttonContainer.style.padding = '10px';
      //buttonContainer.style.marginTop = '10px';
      //buttonContainer.style.marginBottom = '10px';
      buttonContainer.style.margin = '10px 0'; // 上下 左右
      // コンテナに追加
      addContainer('right bottom', 3, buttonContainer);
      // 再生ボタン
      const playButton = createButton('Play', () => {
        if (playerController_play) {
          playerController_play();
          console.debug("Play button clicked.");
        } else {
          console.warn("playerController_play is not defined.");
        }
      });
      buttonContainer.appendChild(playButton);
      // 停止ボタン
      const pauseButton = createButton('Pause', () => {
        if (playerController_pause) {
          playerController_pause();
          console.debug("Pause button clicked.");
        } else {
          console.warn("playerController_pause is not defined.");
        }
      });
      buttonContainer.appendChild(pauseButton);
      // シークボタン
      const seekButton = createButton('Seek 30s', () => {
        if (playerController_seek) {
          playerController_seek(30);
        } else {
          console.warn("playerController_seek is not defined.");
        }
      });
      buttonContainer.appendChild(seekButton);
      // シーク（前）ボタン
      const seekBackwardButton = createButton('-10s', () => {
        if (playerController_seekBackward) {
          playerController_seekBackward();
        } else {
          console.warn("playerController_seekBackward is not defined.");
        }
      });
      buttonContainer.appendChild(seekBackwardButton);
      // シーク（後）ボタン
      const seekForwardButton = createButton('+10s', () => {
        if (playerController_seekForward) {
          playerController_seekForward();
        } else {
          console.warn("playerController_seekForward is not defined.");
        }
      });
      buttonContainer.appendChild(seekForwardButton);
      // 前トラックボタン
      const previousTrackButton = createButton('Prev', () => {
        if (playerController_previousTrack) {
          playerController_previousTrack();
          console.debug("Previous Track button clicked.");
        } else {
          console.warn("playerController_previousTrack is not defined.");
        }
      });
      buttonContainer.appendChild(previousTrackButton);
      // 次トラックボタン
      const nextTrackButton = createButton('Next', () => {
        if (playerController_nextTrack) {
          playerController_nextTrack();
          console.debug("Next Track button clicked.");
        } else {
          console.warn("playerController_nextTrack is not defined.");
        }
      });
      buttonContainer.appendChild(nextTrackButton);
      // 広告スキップ
      const skipAdButton = createButton('Skip Ad', () => {
        if (clickAdSkipButton) {
          clickAdSkipButton();
          console.debug("Skip Ad button clicked.");
        } else {
          console.warn("clickAdSkipButton is not defined.");
        }
      });
      buttonContainer.appendChild(skipAdButton);
      // 全てのselectorの要素を再取得するボタン
      const resetSelectorsButton = createButton('Reset', () => {
        console.debug("Resetting all selectors.");
        // 既存の要素監視を停止
        stopElementObserver();
        // 要素のコンテキストをクリア
        clearElementContext();
        // 動画ページの要素監視を開始
        startElementObserver();
      });
      buttonContainer.appendChild(resetSelectorsButton);
      // PIPボタン
      const pipButton = createButton('PiP', () => {
        const pipButtonElement = document.getElementById(pipButtonElementId);
        if (pipButtonElement) {
          pipButtonElement.click();
          console.debug("PIP button clicked.");
        } else {
          console.warn("PIP button element not found.");
        }
      });
      buttonContainer.appendChild(pipButton);
    });
  }

  // PIP動画を挿入するイベントリスナー
  addEventListener(window, "debug-デバッグ用PIP動画要素をコンテナに挿入",
                   elementChangedEventName, function(event) {
    const details = event.detail;
    const category = details.category;
    const name = details.name;
    const element = details.element;
    if (category === "menu" && name === "contents" && element) {
      if (!debug_pipViewOutside) return; // フラグが立っていない場合はpipVideo.jsで対応
      if (debug_pipViewOutsideLayout) return; // レイアウトを適用する場合はもう一方のイベントリスナーで対応
      // PIP動画要素を取得
      const videoPipElement = context.pip.videoElement;
      if (!videoPipElement) {
        console.warn("No PIP video element found in context.");
        return;
      }
      // ラッパーを作成
      const wrapperId = `${prefixId}-pip-video-debug-5`;
      if (document.getElementById(wrapperId)) {
        console.debug("PIP video element already exists, skipping insertion.");
        return;
      }
      const wrapper = document.createElement('div');
      wrapper.id = wrapperId;
      wrapper.appendChild(videoPipElement);
      // サイズを小さくする
      wrapper.style.width = '320px';
      wrapper.style.height = '180px';
      wrapper.style.margin = '10px 0'; // 上下 左右
      // コンテナに追加
      addContainer('left bottom', 2, wrapper);
      console.debug("PIP video element inserted into left bottom container.");
    }
  });
  // PIP動画を挿入するイベントリスナー（レイアウト適用）
  addEventListener(window, "debug-デバッグ用PIP動画要素をコンテナに挿入（レイアウト適用）",
                   elementChangedEventName, function(event) {
    const details = event.detail;
    const category = details.category;
    const name = details.name;
    const element = details.element;
    if (category === "menu" && name === "contents" && element) {
      if (!debug_pipViewOutside) return; // フラグが立っていない場合はpipVideo.jsで対応
      if (!debug_pipViewOutsideLayout) return; // レイアウトを適用しない場合はもう一方のイベントリスナーで対応
      //toggleDraggableResizablePiP(true); // レイアウトを適用する
      console.debug("Draggable and resizable PIP video element created.");
    }
  });


// context.elements.player.playerが描画範囲外になったらshowDraggableResizablePiP()を呼ぶIntersectionObserverを設定
  addEventListener(window, "debug-要素が描画範囲外になったらPIP動画を表示",
                   elementChangedEventName, function(event) {
    const details = event.detail;
    const category = details.category;
    const name = details.name;
    const element = details.element;
    if (category === "player" && name === "player" && element) {
      const playerElement = context.elements.player.player;
      if (!playerElement) {
        console.warn("No player element found in context.");
        return;
      }
      // IntersectionObserverを設定
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) {
            // 描画範囲外になったらPIP動画を表示
            toggleDraggableResizablePiP(true);
            console.debug("Player element is out of view, showing PIP video.");
          } else {
            // 描画範囲内に戻ったらPIP動画を非表示
            toggleDraggableResizablePiP(false);
            console.debug("Player element is in view, hiding PIP video.");
          }
        });
      }, { threshold: 0.5 }); // 50%が描画範囲外になったら発火
      observer.observe(playerElement);
      console.debug("IntersectionObserver set for player element to show PIP video when out of view.");
    }
  });

  // // サムネイル画像のURLを取得するテスト
  // const testThumbnailUrl = async () => {
  //   const url = "https://www.nicovideo.jp/watch/sm9";
  //   const thumbnailUrl = await getNicoVideoThumbnailUrl(url);
  //   if (thumbnailUrl) {
  //     console.log("サムネイル画像のURLを取得しました:", thumbnailUrl);
  //   } else {
  //     console.error("サムネイル画像のURLの取得に失敗しました");
  //   }
  // };
  // testThumbnailUrl();

  // // サムネイル画像を取得するテスト
  // const testThumbnail = ({ url = "https://www.nicovideo.jp/watch/sm9",
  //                          max = 10, interval = 500, append = false } = {}) => {
  //   let n = 0;
  //   const timer = setInterval(() => {
  //     const img = getNicoVideoThumbnailImage(url);
  //     if (img) {
  //       if (append) document.body.appendChild(img);
  //       console.log(`Thumbnail retrieved successfully (attempt ${n + 1} of ${max}): ${img.src}`);
  //       clearInterval(timer);
  //     } else if (++n >= max) {
  //       console.error(`Thumbnail retrieval failed after ${max} attempts.`);
  //       clearInterval(timer);
  //     } else {
  //       console.debug(`Thumbnail not yet available. Retrying (attempt ${n + 1} of ${max})...`);
  //     }
  //   }, interval);
  // };
  // testThumbnail();


  // // サムネイル画像のキャッシュ機能のテスト
  // // sm9からsm20まで、1秒間隔でサムネイル画像を取得
  // for (let i = 9; i <= 20; i++) {
  //   const url = `https://www.nicovideo.jp/watch/sm${i}`;
  //   setTimeout(() => {
  //     getNicoVideoThumbnailImage(url);
  //   }, i * 1000);
  // }










// 直前のウィンドウ位置・サイズ記憶用
let pipWindowState = null;
let pipResizeCover = null;

function toggleDraggableResizablePiP(isAdd) {
  const seekbarMode = 'always';
  //const seekbarMode = 'hover';
  const CONTROLS_HEIGHT = 38;
  const BAR_BLUE = 'rgb(26, 128, 230)';
  const WRAPPER_ID = `${prefixId}-pip-video-debug-5`;

  // 初期値（左下）
  const INIT_LEFT = 20;
  const INIT_BOTTOM = 20;
  const INIT_WIDTH = 480;
  const INIT_ASPECT = 16 / 9;

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else {
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
  }

  // リサイズ時にPIP窓を画面内へ補正
  function ensurePiPInView() {
    const wrapper = document.getElementById(WRAPPER_ID);
    if (!wrapper) return;

    const winW = window.innerWidth, winH = window.innerHeight;
    const w = wrapper.offsetWidth, h = wrapper.offsetHeight;
    let left = parseFloat(wrapper.style.left) || 0;
    let top = parseFloat(wrapper.style.top) || (winH - h - INIT_BOTTOM);

    // 画面からはみ出さないよう補正
    if (left + w > winW) left = winW - w;
    if (top + h > winH) top = winH - h;
    if (left < 0) left = 0;
    if (top < 0) top = 0;

    let needInit = false;
    if (w > winW || h > winH) needInit = true;
    if (left + w > winW || top + h > winH) needInit = true;

    // 初期値でも収まらなければ削除
    const initVideoH = INIT_WIDTH / INIT_ASPECT;
    const initW = INIT_WIDTH;
    const initH = seekbarMode === 'always' ? (initVideoH + CONTROLS_HEIGHT) : initVideoH;
    if (needInit) {
      if (initW > winW || initH > winH) {
        wrapper.remove();
        pipWindowState = null;
        return;
      }
      wrapper.style.left = INIT_LEFT + 'px';
      wrapper.style.top = 'auto';
      wrapper.style.bottom = INIT_BOTTOM + 'px';
      wrapper.style.right = 'auto';
      wrapper.style.width = initW + 'px';
      wrapper.style.height = initH + 'px';
    } else {
      wrapper.style.left = left + 'px';
      wrapper.style.top = top + 'px';
      wrapper.style.bottom = 'auto';
      wrapper.style.right = 'auto';
    }
    // videoContainer高さ補正
    const videoContainer = wrapper.querySelector('div[style*="position: relative"]');
    if (videoContainer) {
      videoContainer.style.height = (parseFloat(wrapper.style.height) - CONTROLS_HEIGHT) + 'px';
    }
  }
  // windowリサイズで自動補正
  window.addEventListener('resize', ensurePiPInView);

  // 削除
  if (!isAdd) {
    const exist = document.getElementById(WRAPPER_ID);
    if (exist) {
      const rect = exist.getBoundingClientRect();
      pipWindowState = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };
      exist.remove();
    }
    // カバーも消す
    if (pipResizeCover) {
      pipResizeCover.remove();
      pipResizeCover = null;
    }
    return;
  }
  // 2重生成防止
  if (document.getElementById(WRAPPER_ID)) return;

  // スタイル
  if (!document.getElementById('pip-pip-style')) {
    const style = document.createElement('style');
    style.id = 'pip-pip-style';
    style.textContent = `
      input[type="range"].pip-flat::-webkit-slider-thumb {
        -webkit-appearance: none !important;
        appearance: none !important;
        width: 0 !important;
        height: 0 !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        pointer-events: none !important;
      }
      input[type="range"].pip-flat::-moz-range-thumb {
        width: 0 !important;
        height: 0 !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        pointer-events: none !important;
      }
      input[type="range"].pip-flat::-ms-thumb {
        width: 0 !important;
        height: 0 !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        pointer-events: none !important;
      }
      input[type="range"].pip-flat {
        min-width: 24px;
        max-width: 100%;
      }
      .pip-close-btn {
        opacity: 0;
        pointer-events: none;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        transition: opacity 0.2s;
        color: #fff !important;
        font-size: 20px;
        font-weight: bold;
        line-height: 1;
        z-index: 10010 !important;
      }
      .pip-wrapper:hover .pip-close-btn {
        opacity: 1;
        pointer-events: auto;
      }
      .pip-time-label {
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-size: 1em;
        color: #ccc;
        background: none;
        border: none;
        height: 28px;
        margin: 0 4px;
        padding: 0 3px;
        border-radius: 3px;
        box-sizing: border-box;
        min-width: 0;
        max-width: 100vw;
        white-space: pre;
      }
      .pip-resize-edge, .pip-resize-corner {
        position: absolute;
        z-index: 10005;
        pointer-events: auto;
        background: transparent;
        user-select: none;
      }
      .pip-resize-edge.pip-resize-n { top: 0; left: 8px; right: 8px; height: 8px; cursor: ns-resize; }
      .pip-resize-edge.pip-resize-s { bottom: 0; left: 8px; right: 8px; height: 8px; cursor: ns-resize; }
      .pip-resize-edge.pip-resize-w { left: 0; top: 8px; bottom: 8px; width: 8px; cursor: ew-resize; }
      .pip-resize-edge.pip-resize-e { right: 0; top: 8px; bottom: 8px; width: 8px; cursor: ew-resize; }
      .pip-resize-corner.pip-resize-nw { top: 0; left: 0; width: 16px; height: 16px; cursor: nwse-resize; }
      .pip-resize-corner.pip-resize-ne { top: 0; right: 0; width: 16px; height: 16px; cursor: nesw-resize; }
      .pip-resize-corner.pip-resize-sw { bottom: 0; left: 0; width: 16px; height: 16px; cursor: nesw-resize; }
      .pip-resize-corner.pip-resize-se { bottom: 0; right: 0; width: 16px; height: 16px; cursor: nwse-resize; }
      .pip-center-playpause {
        display: none;
        position: absolute;
        left: 50%;
        top: 50%;
        z-index: 10009;
        transform: translate(-50%, -50%);
        background: none !important;
        border: none !important;
        color: #fff !important;
        font-size: 46px;
        width: auto;
        height: auto;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        outline: none;
        user-select: none;
        box-shadow: none !important;
        border-radius: 50%;
        padding: 0;
      }
      .pip-video-overlay {
        pointer-events: none;
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.25);
        opacity: 0;
        z-index: 10008;
        transition: opacity 0.18s;
      }
      .pip-wrapper:hover .pip-video-overlay {
        opacity: 1;
      }
      .pip-wrapper:hover .pip-center-playpause {
        display: flex;
      }
      .pip-playpause-btn-fixed {
        font-family: 'Menlo', 'Consolas', 'monospace', 'Segoe UI Symbol', 'Arial Unicode MS', sans-serif;
        width: 26px; min-width: 26px; max-width: 26px;
        display: flex;
        align-items: center; justify-content: center;
        text-align: center;
        letter-spacing: 0;
        font-size: 20px;
        padding: 0;
        margin-left: 2px;
        margin-right: 4px;
        height: 26px;
        line-height: 1;
        background: none;
        border: none;
        color: #fff;
        cursor: pointer;
      }
      .pip-playpause-btn-fixed .pip-play-icon {
        position: relative;
        top: -1.5px;
      }
      .pip-resize-cover {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        z-index: 9998;
        background: transparent;
        pointer-events: auto !important;
        touch-action: none !important;
        user-select: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // video要素
  const videoPipElement = context.pip.videoElement;
  if (!videoPipElement) return;

  let aspect = INIT_ASPECT;
  if (videoPipElement.videoWidth && videoPipElement.videoHeight) {
    aspect = videoPipElement.videoWidth / videoPipElement.videoHeight;
  } else {
    videoPipElement.addEventListener('loadedmetadata', () => {
      aspect = videoPipElement.videoWidth / videoPipElement.videoHeight;
    }, { once: true });
  }
  const initialVideoH = INIT_WIDTH / aspect;

  // ウィンドウ位置・サイズ復元判定
  let useInit = false;
  if (pipWindowState) {
    const left = pipWindowState.left;
    const top = pipWindowState.top;
    const width = pipWindowState.width;
    const height = pipWindowState.height;
    const right = left + width;
    const bottom = top + height;
    if (
      left < 0 || top < 0 ||
      right > window.innerWidth || bottom > window.innerHeight ||
      width < 80 || height < 80
    ) {
      useInit = true;
    }
  } else {
    useInit = true;
  }

  // 初期値でも画面内に収まらない場合は追加しない
  let checkW = useInit ? INIT_WIDTH : pipWindowState.width;
  let checkH = useInit ? (seekbarMode === 'always' ? (initialVideoH + CONTROLS_HEIGHT) : initialVideoH) : pipWindowState.height;
  if (checkW > window.innerWidth || checkH > window.innerHeight) return;

  // ラッパー
  const wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;
  wrapper.classList.add('pip-wrapper');
  wrapper.style.position = 'fixed';

  if (useInit) {
    wrapper.style.left = INIT_LEFT + 'px';
    wrapper.style.bottom = INIT_BOTTOM + 'px';
    wrapper.style.width = INIT_WIDTH + 'px';
    wrapper.style.height = seekbarMode === 'always'
      ? (initialVideoH + CONTROLS_HEIGHT) + 'px'
      : initialVideoH + 'px';
    wrapper.style.right = 'auto';
    wrapper.style.top = 'auto';
  } else {
    wrapper.style.left = pipWindowState.left + 'px';
    wrapper.style.top = pipWindowState.top + 'px';
    wrapper.style.width = pipWindowState.width + 'px';
    wrapper.style.height = pipWindowState.height + 'px';
    wrapper.style.bottom = 'auto';
    wrapper.style.right = 'auto';
  }

  wrapper.style.background = '#000';
  wrapper.style.borderRadius = '8px';
  wrapper.style.overflow = 'hidden';
  wrapper.style.zIndex = '9999';
  wrapper.style.cursor = 'default';
  wrapper.style.boxShadow = '0 0 12px rgba(0,0,0,0.5)';
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.userSelect = 'none';

  // 閉じるボタン
  const closeBtn = document.createElement('button');
  closeBtn.className = 'pip-close-btn';
  closeBtn.textContent = '×';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '8px';
  closeBtn.style.right = '10px';
  closeBtn.style.width = '28px';
  closeBtn.style.height = '28px';
  closeBtn.style.display = 'flex';
  closeBtn.style.alignItems = 'center';
  closeBtn.style.justifyContent = 'center';
  closeBtn.style.padding = '0';
  closeBtn.style.margin = '0';
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = 'none';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.zIndex = '10010';
  closeBtn.title = '閉じる';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = wrapper.getBoundingClientRect();
    pipWindowState = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };
    wrapper.remove();
    if (pipResizeCover) {
      pipResizeCover.remove();
      pipResizeCover = null;
    }
  });

  // 動画領域
  const videoContainer = document.createElement('div');
  videoContainer.style.flex = '1 1 auto';
  videoContainer.style.position = 'relative';
  videoContainer.style.width = '100%';
  if (!useInit && pipWindowState) {
    videoContainer.style.height = (pipWindowState.height - CONTROLS_HEIGHT) + 'px';
  } else {
    videoContainer.style.height = seekbarMode === 'always'
      ? (initialVideoH + 'px')
      : '100%';
  }
  videoContainer.style.background = '#000';

  // オーバーレイ
  const videoOverlay = document.createElement('div');
  videoOverlay.className = 'pip-video-overlay';
  videoContainer.appendChild(videoOverlay);

  // video本体
  videoPipElement.style.width = '100%';
  videoPipElement.style.height = '100%';
  videoPipElement.style.display = 'block';
  videoPipElement.style.objectFit = 'cover';
  videoPipElement.style.position = 'relative';
  videoContainer.appendChild(videoPipElement);

  // 中央再生・停止ボタン
  const centerPlayPause = document.createElement('button');
  centerPlayPause.className = 'pip-center-playpause';
  centerPlayPause.textContent = videoPipElement.paused ? '▶' : '⏸';
  centerPlayPause.title = '再生/一時停止';
  function togglePlayPause() {
    if (videoPipElement.paused) {
      if (typeof playerController_play === 'function') playerController_play();
      centerPlayPause.textContent = '⏸';
    } else {
      if (typeof playerController_pause === 'function') playerController_pause();
      centerPlayPause.textContent = '▶';
    }
  }
  centerPlayPause.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlayPause();
  });
  videoPipElement.addEventListener('play', () => centerPlayPause.textContent = '⏸');
  videoPipElement.addEventListener('pause', () => centerPlayPause.textContent = '▶');
  videoContainer.appendChild(centerPlayPause);

  // コントロールバー
  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.alignItems = 'center';
  controls.style.width = '100%';
  controls.style.height = CONTROLS_HEIGHT + 'px';
  controls.style.zIndex = '10001';
  controls.style.gap = '0';
  controls.style.background = 'rgba(30,30,30,1)';
  controls.style.position = 'static';
  controls.style.padding = '4px 10px';
  controls.style.borderTop = '1px solid #222';

  // 再生/停止ボタン
  const playPauseBtn = document.createElement('button');
  playPauseBtn.className = 'pip-playpause-btn-fixed';
  playPauseBtn.innerHTML = videoPipElement.paused
    ? '<span class="pip-play-icon">▶</span>'
    : '<span>⏸</span>';
  playPauseBtn.style.flex = '0 0 auto';
  controls.appendChild(playPauseBtn);

  playPauseBtn.addEventListener('click', () => {
    togglePlayPause();
  });
  videoPipElement.addEventListener('play', () => playPauseBtn.innerHTML = '<span>⏸</span>');
  videoPipElement.addEventListener('pause', () => playPauseBtn.innerHTML = '<span class="pip-play-icon">▶</span>');

  // 現在時間
  const currentTimeLabel = document.createElement('span');
  currentTimeLabel.className = 'pip-time-label';
  currentTimeLabel.textContent = '0:00';
  controls.appendChild(currentTimeLabel);

  // シークバー
  const seekBar = document.createElement('input');
  seekBar.type = 'range';
  seekBar.min = '0';
  seekBar.max = '100';
  seekBar.value = '0';
  seekBar.classList.add('pip-flat');
  seekBar.style.flex = '1 1 0%';
  seekBar.style.margin = '0';
  seekBar.style.height = '4px';
  seekBar.style.borderRadius = '2px';
  seekBar.style.background = '#bbb';
  seekBar.style.appearance = 'none';
  seekBar.style.outline = 'none';
  seekBar.style.padding = '0';
  seekBar.style.cursor = 'pointer';
  seekBar.style.boxShadow = 'none';
  seekBar.style.setProperty('accent-color', BAR_BLUE);
  seekBar.addEventListener('mousedown', e => e.stopPropagation());
  controls.appendChild(seekBar);

  // 総時間
  const durationLabel = document.createElement('span');
  durationLabel.className = 'pip-time-label';
  durationLabel.textContent = '0:00';
  controls.appendChild(durationLabel);

  function updateSeekBarAndTime() {
    const seekBarCurrentTime = getSeekBarCurrentTime();
    const seekBarDuration = getSeekBarDuration();
    // 値をセット（シーク時に取得する）
    seekBar.max = seekBarDuration || 1;
    seekBar.value = seekBarCurrentTime || 0;
    // 値をパーセントに変換して青バーを更新
    const percent = Math.max(0, Math.min(1, seekBarDuration ? seekBarCurrentTime / seekBarDuration : 0));
    seekBar.style.background = `linear-gradient(to right, ${BAR_BLUE} 0%, ${BAR_BLUE} ${percent*100}%, #bbb ${percent*100}%, #bbb 100%)`;
    // 時間表示を更新
    currentTimeLabel.textContent = formatTime(seekBarCurrentTime);
    durationLabel.textContent = formatTime(seekBarDuration);
  }
  // 初回更新とイベントリスナー登録
  window.addEventListener(videoTimeChangedEventName, updateSeekBarAndTime);
  updateSeekBarAndTime();
  // シークバー操作
  seekBar.addEventListener('input', () => {
    if (typeof playerController_seek === 'function') {
      playerController_seek(Number(seekBar.value));
    }
  });

  // 最小サイズ
  const minW = 250, minH = 70 + CONTROLS_HEIGHT;

  function addResizeCover() {
    if (!pipResizeCover) {
      pipResizeCover = document.createElement('div');
      pipResizeCover.className = 'pip-resize-cover';
      document.body.appendChild(pipResizeCover);
      pipResizeCover.addEventListener('mousedown', e => e.preventDefault(), true);
      pipResizeCover.addEventListener('mouseup', e => e.preventDefault(), true);
      pipResizeCover.addEventListener('mousemove', e => e.preventDefault(), true);
    }
  }
  function removeResizeCover() {
    if (pipResizeCover) {
      pipResizeCover.remove();
      pipResizeCover = null;
    }
  }

  // ドラッグ移動
  let isDragging = false;
  let dragOffsetX = 0, dragOffsetY = 0;
  wrapper.addEventListener('mousedown', (e) => {
    if (
      controls.contains(e.target) ||
      e.target.classList.contains('pip-resize-edge') ||
      e.target.classList.contains('pip-resize-corner')
    ) return;
    isDragging = true;
    dragOffsetX = e.clientX - wrapper.offsetLeft;
    dragOffsetY = e.clientY - wrapper.offsetTop;
    wrapper.style.cursor = 'grabbing';
    addResizeCover();
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const winW = window.innerWidth, winH = window.innerHeight;
      const w = wrapper.offsetWidth, h = wrapper.offsetHeight;
      let left = e.clientX - dragOffsetX;
      let top = e.clientY - dragOffsetY;
      if (left < 0) left = 0;
      if (top < 0) top = 0;
      if (left + w > winW) left = winW - w;
      if (top + h > winH) top = winH - h;
      wrapper.style.left = `${left}px`;
      wrapper.style.top = `${top}px`;
      wrapper.style.bottom = 'auto';
      wrapper.style.right = 'auto';
      pipWindowState = {
        left, top, width: w, height: h
      };
      e.preventDefault();
    }
  });
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      wrapper.style.cursor = 'default';
      removeResizeCover();
    }
    if (isResizing) {
      isResizing = false;
      document.body.style.userSelect = "";
      removeResizeCover();
    }
  });

  // --- 全エッジ＆角ハンドル ---
  const edgeConfigs = [
    { dir: 'n' }, { dir: 's' }, { dir: 'w' }, { dir: 'e' }
  ];
  const cornerConfigs = [
    { dir: 'nw' }, { dir: 'ne' }, { dir: 'sw' }, { dir: 'se' }
  ];
  let isResizing = false;
  let resizeDir = '', startX = 0, startY = 0, startW = 0, startH = 0, startL = 0, startT = 0;
  function createEdge(cfg) {
    const edge = document.createElement('div');
    edge.className = 'pip-resize-edge pip-resize-' + cfg.dir;
    wrapper.appendChild(edge);
    edge.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      isResizing = true;
      resizeDir = cfg.dir;
      startX = e.clientX;
      startY = e.clientY;
      const rect = wrapper.getBoundingClientRect();
      startW = rect.width;
      startH = rect.height;
      startL = rect.left;
      startT = rect.top;
      document.body.style.userSelect = "none";
      addResizeCover();
    });
  }
  function createCorner(cfg) {
    const corner = document.createElement('div');
    corner.className = 'pip-resize-corner pip-resize-' + cfg.dir;
    wrapper.appendChild(corner);
    corner.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      isResizing = true;
      resizeDir = cfg.dir;
      startX = e.clientX;
      startY = e.clientY;
      const rect = wrapper.getBoundingClientRect();
      startW = rect.width;
      startH = rect.height;
      startL = rect.left;
      startT = rect.top;
      document.body.style.userSelect = "none";
      addResizeCover();
    });
  }
  edgeConfigs.forEach(createEdge);
  cornerConfigs.forEach(createCorner);

  document.addEventListener('mousemove', (e) => {
    if (isResizing) {
      let mouseX = e.clientX, mouseY = e.clientY;
      let newW = startW, newH = startH, newL = startL, newT = startT;
      if (resizeDir === 'n') {
        let diff = mouseY - startT;
        newH = startH - diff;
        newT = startT + diff;
        if (newH < minH) {
          newT = newT - (minH - newH);
          newH = minH;
        }
        let videoH = newH - CONTROLS_HEIGHT;
        newW = videoH * aspect;
        newL = startL + (startW - newW) / 2;
      } else if (resizeDir === 's') {
        let diff = mouseY - (startT + startH);
        newH = startH + diff;
        if (newH < minH) newH = minH;
        let videoH = newH - CONTROLS_HEIGHT;
        newW = videoH * aspect;
        newL = startL + (startW - newW) / 2;
      } else if (resizeDir === 'w') {
        let diff = mouseX - startL;
        newW = startW - diff;
        newL = startL + diff;
        if (newW < minW) {
          newL = newL - (minW - newW);
          newW = minW;
        }
        let videoH = newW / aspect;
        newH = videoH + CONTROLS_HEIGHT;
        newT = startT + (startH - newH) / 2;
      } else if (resizeDir === 'e') {
        let diff = mouseX - (startL + startW);
        newW = startW + diff;
        if (newW < minW) newW = minW;
        let videoH = newW / aspect;
        newH = videoH + CONTROLS_HEIGHT;
        newT = startT + (startH - newH) / 2;
      }
      // 角は変わらず
      else if (resizeDir === 'nw') {
        let diffX = mouseX - startL;
        let diffY = mouseY - startT;
        newW = startW - diffX;
        newH = startH - diffY;
        newL = startL + diffX;
        newT = startT + diffY;
        if (newW / (newH - CONTROLS_HEIGHT) > aspect) newW = (newH - CONTROLS_HEIGHT) * aspect;
        else newH = (newW / aspect) + CONTROLS_HEIGHT;
        if (newW < minW) { newW = minW; newH = (newW / aspect) + CONTROLS_HEIGHT; }
        if (newH < minH) { newH = minH; newW = (newH - CONTROLS_HEIGHT) * aspect; }
        newL = startL + (startW - newW);
        newT = startT + (startH - newH);
      } else if (resizeDir === 'ne') {
        let diffX = mouseX - (startL + startW);
        let diffY = mouseY - startT;
        newW = startW + diffX;
        newH = startH - diffY;
        newT = startT + diffY;
        if (newW / (newH - CONTROLS_HEIGHT) > aspect) newW = (newH - CONTROLS_HEIGHT) * aspect;
        else newH = (newW / aspect) + CONTROLS_HEIGHT;
        if (newW < minW) newW = minW, newH = (newW / aspect) + CONTROLS_HEIGHT;
        if (newH < minH) newH = minH, newW = (newH - CONTROLS_HEIGHT) * aspect;
        newL = startL;
        newT = startT + (startH - newH);
      } else if (resizeDir === 'sw') {
        let diffX = mouseX - startL;
        let diffY = mouseY - (startT + startH);
        newW = startW - diffX;
        newH = startH + diffY;
        newL = startL + diffX;
        if (newW / (newH - CONTROLS_HEIGHT) > aspect) newW = (newH - CONTROLS_HEIGHT) * aspect;
        else newH = (newW / aspect) + CONTROLS_HEIGHT;
        if (newW < minW) newW = minW, newH = (newW / aspect) + CONTROLS_HEIGHT, newL = startL + (startW - newW);
        if (newH < minH) newH = minH, newW = (newH - CONTROLS_HEIGHT) * aspect;
        newT = startT;
      } else if (resizeDir === 'se') {
        let diffX = mouseX - (startL + startW);
        let diffY = mouseY - (startT + startH);
        newW = startW + diffX;
        newH = startH + diffY;
        if (newW / (newH - CONTROLS_HEIGHT) > aspect) newW = (newH - CONTROLS_HEIGHT) * aspect;
        else newH = (newW / aspect) + CONTROLS_HEIGHT;
        if (newW < minW) newW = minW, newH = (newW / aspect) + CONTROLS_HEIGHT;
        if (newH < minH) newH = minH, newW = (newH - CONTROLS_HEIGHT) * aspect;
        newL = startL;
        newT = startT;
      }
      // 画面外に出ない制約
      newL = Math.max(0, Math.min(newL, window.innerWidth - newW));
      newT = Math.max(0, Math.min(newT, window.innerHeight - newH));
      if (newL + newW > window.innerWidth) newW = window.innerWidth - newL;
      if (newT + newH > window.innerHeight) newH = window.innerHeight - newT;
      wrapper.style.width = `${newW}px`;
      wrapper.style.height = `${newH}px`;
      wrapper.style.left = `${newL}px`;
      wrapper.style.top = `${newT}px`;
      wrapper.style.bottom = 'auto';
      wrapper.style.right = 'auto';
      videoContainer.style.height = `${newH - CONTROLS_HEIGHT}px`;
      pipWindowState = {
        left: newL, top: newT, width: newW, height: newH
      };
      e.preventDefault();
    }
  });

  // UI配置
  wrapper.appendChild(closeBtn);
  wrapper.appendChild(videoContainer);
  wrapper.appendChild(controls);

  addContainer('left bottom', 2, wrapper);

  // 追加時も念のため画面内に補正
  setTimeout(ensurePiPInView, 0);
}
















}
