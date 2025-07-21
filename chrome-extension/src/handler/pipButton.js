"use strict";

// PIPボタンの処理
{
  // PIPボタンのコールバック
  function pipButtonClickCallback() {
    console.debug("PIP button clicked.");
    if (!document.pictureInPictureElement) {
      startPip();
    } else {
      endPip();
    }
  }

  // PIPの表示を切り替えるボタン要素
  const pipButtonElement = document.createElement('button');
  {
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
    // フォント指定
    pipButtonElement.style.fontFamily = fontFamily;
    // 文字の選択を無効化
    pipButtonElement.style.userSelect = 'none';
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
  }

  // PIP用のボタン要素の初期化（挿入）
  function initPipButton() {
    // 既にPIPボタンが存在する場合は何もしない
    if (document.getElementById(pipButtonElementId)) {
      console.debug("Pip button element already exists.");
      return;
    }

    // PIPボタンの挿入目標
    const targetElement = context.elements.controller.commentBtn;
    if (!targetElement) {
      console.debug("Target element for PIP button not found.");
      return;
    }

    // ボタンを表示
    targetElement.insertAdjacentElement('beforebegin', pipButtonElement);
    console.debug("Pip button element initialized.");
  }

  // PIPボタンの初期化イベントリスナー
  addEventListener(window, "コントローラーの要素が変更されたときにPIPボタンを初期化",
                   elementChangedEventName, (event) => {
    const { detail } = event;
    const category = detail.category;
    const name = detail.name;
    const element = detail.element;
    if (category === "controller" && name === "commentBtn" && element) {
      // PIPボタンの初期化
      initPipButton();
    }
  });
}
