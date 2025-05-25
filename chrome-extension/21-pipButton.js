// --- function ----------------------------------------------------------------
let initPipButtonElement = null;
let updatePipButtonElement = null;
// -----------------------------------------------------------------------------

{
  // PIP用のボタン要素の初期化
  initPipButtonElement = function (_pipButtonClickCallback, _tooltipTriggerElement) {
    // 既にPIPボタンが存在する場合は何もしない
    if (document.getElementById(pipButtonElementId)) {
      console.debug("Pip button element already exists.");
      return;
    }

    const pipButtonClickCallback = _pipButtonClickCallback;
    const tooltipTriggerElement = _tooltipTriggerElement;

    if (pipButtonClickCallback === null) {
      console.warn("PIP button click callback is null.");
      return;
    }

    if (tooltipTriggerElement === null) {
      console.warn("Tooltip trigger element is null.");
      return;
    }

    // PIPの表示を切り替えるボタン要素を追加
    const pipButtonElement = document.createElement('button');
    pipButtonElement.id = pipButtonElementId;
    pipButtonElement.style.transform = 'none';
    pipButtonElement.textContent = 'PiP';
    pipButtonElement.style.width = '40px';
    pipButtonElement.style.height = '40px';
    pipButtonElement.style.padding = '0px';
    pipButtonElement.style.margin = '0px';
    pipButtonElement.style.border = 'none';
    pipButtonElement.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    pipButtonElement.style.fontSize = '18px';
    pipButtonElement.style.fontWeight = 'bold';
    pipButtonElement.style.cursor = 'pointer';
    pipButtonElement.style.marginTop = '-1px'; // 上に少しずらす
    // フォント指定: Segoe UI (Windows), Helvetica Neue (macOS)
    pipButtonElement.style.fontFamily = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

    // PIPボタンの色を設定
    pipButtonElement.style.color = pipButtonOnMouseOutColor;
    // ホバーで色を変える
    pipButtonElement.addEventListener('mouseenter', () => {
      pipButtonElement.style.color = pipButtonOnMouseOverColor;
    });
    pipButtonElement.addEventListener('mouseleave', () => {
      pipButtonElement.style.color = pipButtonOnMouseOutColor;
    });

    // ボタンをクリックしたときの処理
    pipButtonElement.addEventListener('click', pipButtonClickCallback);

    // ボタンを表示
    tooltipTriggerElement.insertAdjacentElement('beforebegin', pipButtonElement);
  }
}
