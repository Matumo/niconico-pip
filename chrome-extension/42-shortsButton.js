// ニコニコショート用PIPボタン

// --- function ----------------------------------------------------------------
let initShortsPipButtonElement = null;
// -----------------------------------------------------------------------------

{
  // ショート用PIPボタンを生成/流用し、アンカー（コメントトグル等）の直前へ挿す
  initShortsPipButtonElement = function(_pipButtonClickCallback, _anchorElement) {
    const pipButtonClickCallback = _pipButtonClickCallback;
    const anchorElement = _anchorElement;

    if (pipButtonClickCallback === null) {
      console.warn("Shorts PIP button click callback is null.");
      return;
    }
    if (anchorElement === null) {
      console.warn("Shorts PIP button anchor element is null.");
      return;
    }

    // 既存のPIPボタンがあれば流用、無ければ生成（watch用21-pipButton.jsと同じ見た目）
    let pipButtonElement = document.getElementById(pipButtonElementId);
    if (!pipButtonElement) {
      pipButtonElement = document.createElement('button');
      pipButtonElement.id = pipButtonElementId;
      pipButtonElement.type = 'button';
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
      pipButtonElement.style.fontFamily = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
      pipButtonElement.style.userSelect = 'none';
      // 色とホバー挙動
      pipButtonElement.style.color = pipButtonOnMouseOutColor;
      pipButtonElement.addEventListener('mouseenter', () => {
        pipButtonElement.style.color = pipButtonOnMouseOverColor;
      });
      pipButtonElement.addEventListener('mouseleave', () => {
        pipButtonElement.style.color = pipButtonOnMouseOutColor;
      });
    }

    // クリック処理を設定し、アンカー（再生/一時停止等）の直前へ挿入
    // 既に正しい位置にあれば再挿入しない（切替のたびに重複させない）
    pipButtonElement.onclick = pipButtonClickCallback;
    if (pipButtonElement.nextElementSibling !== anchorElement) {
      anchorElement.insertAdjacentElement('beforebegin', pipButtonElement);
    }
  }
}
