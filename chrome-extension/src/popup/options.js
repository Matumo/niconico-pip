"use strict";

document.addEventListener('DOMContentLoaded', async () => {
  // タイトルを設定
  {
    const title = chrome.i18n.getMessage("extensionName");
    document.title = title;
    document.getElementById('title').textContent = title;
  }

  // 設定をロード
  await exec_config_storage_js();
  await loadStorageConfig();

  // 更新案内メッセージ表示
  let updateMessageTimeout = null;
  function showUpdateMessage() {
    const messageDiv = document.getElementById('message');
    const message = chrome.i18n.getMessage("savedMessage");
    messageDiv.textContent = message;
    // 一定時間後にメッセージを消す
    if (updateMessageTimeout) clearTimeout(updateMessageTimeout);
    updateMessageTimeout = setTimeout(() => {
      messageDiv.textContent = '';
      updateMessageTimeout = null;
    }, 2500);
  }

  // 設定を更新
  async function setConfig(key, value) {
    await setStorageConfig(key, value);
    showUpdateMessage();
    updateAllConfigsVisibility(storageConfig);
  }

  // 拡張機能有効化設定
  function renderConfigEnabled(config) {
    const input = document.getElementById('config-enabled-input');
    const label = document.getElementById('config-enabled-label');
    const description = document.getElementById('config-enabled-description');
    label.textContent = chrome.i18n.getMessage("configEnabledLabel") || "";
    description.textContent = chrome.i18n.getMessage("configEnabledDescription") || "";
    input.checked = config[STORAGE_CONFIG_KEY_ENABLED];
    input.onchange = () => {
      setConfig(STORAGE_CONFIG_KEY_ENABLED, input.checked);
    };
  }
  function updateVisibilityOfEnabled(config) {
  }

  // デバッグモード有効化設定
  function renderConfigDebugModeEnabled(config) {
    const input = document.getElementById('config-debug-mode-enabled-input');
    const label = document.getElementById('config-debug-mode-enabled-label');
    const description = document.getElementById('config-debug-mode-enabled-description');
    label.textContent = chrome.i18n.getMessage("configDebugModeEnabledLabel") || "";
    description.textContent = chrome.i18n.getMessage("configDebugModeEnabledDescription") || "";
    input.checked = config[STORAGE_CONFIG_KEY_DEBUG_MODE_ENABLED];
    input.onchange = () => {
      setConfig(STORAGE_CONFIG_KEY_DEBUG_MODE_ENABLED, input.checked);
    };
  }
  function updateVisibilityOfDebugModeEnabled(config) {
    const container = document.getElementById('config-debug-mode-enabled-container');
    const isVisible = config[STORAGE_CONFIG_KEY_ENABLED];
    container.classList.remove(isVisible ? 'hide' : 'show');
    container.classList.add(isVisible ? 'show' : 'hide');
    container.style.maxHeight = isVisible ? container.scrollHeight + 'px' : '0px';
  }

  // デバッグログ有効化設定
  function renderConfigDebugLogEnabled(config) {
    const input = document.getElementById('config-debug-log-enabled-input');
    const label = document.getElementById('config-debug-log-enabled-label');
    const description = document.getElementById('config-debug-log-enabled-description');
    label.textContent = chrome.i18n.getMessage("configDebugLogEnabledLabel") || "";
    description.textContent = chrome.i18n.getMessage("configDebugLogEnabledDescription") || "";
    input.checked = config[STORAGE_CONFIG_KEY_DEBUG_LOG_ENABLED];
    input.onchange = () => {
      setConfig(STORAGE_CONFIG_KEY_DEBUG_LOG_ENABLED, input.checked);
    };
  }
  function updateVisibilityOfDebugLogEnabled(config) {
    const container = document.getElementById('config-debug-log-enabled-container');
    const isVisible = config[STORAGE_CONFIG_KEY_ENABLED] && config[STORAGE_CONFIG_KEY_DEBUG_MODE_ENABLED];
    container.classList.remove(isVisible ? 'hide' : 'show');
    container.classList.add(isVisible ? 'show' : 'hide');
    container.style.maxHeight = isVisible ? container.scrollHeight + 'px' : '0px';
  }

  // 広告自動スキップ有効化設定
  function renderConfigAdAutoSkipEnabled(config) {
    const input = document.getElementById('config-ad-auto-skip-enabled-input');
    const label = document.getElementById('config-ad-auto-skip-enabled-label');
    const description = document.getElementById('config-ad-auto-skip-enabled-description');
    label.textContent = chrome.i18n.getMessage("configAdAutoSkipEnabledLabel") || "";
    description.textContent = chrome.i18n.getMessage("configAdAutoSkipEnabledDescription") || "";
    input.checked = config[STORAGE_CONFIG_KEY_AD_AUTO_SKIP_ENABLED];
    input.onchange = () => {
      setConfig(STORAGE_CONFIG_KEY_AD_AUTO_SKIP_ENABLED, input.checked);
    };
  }
  function updateVisibilityOfAdAutoSkipEnabled(config) {
    const container = document.getElementById('config-ad-auto-skip-enabled-container');
    const isVisible = config[STORAGE_CONFIG_KEY_ENABLED] && config[STORAGE_CONFIG_KEY_DEBUG_MODE_ENABLED];
    container.classList.remove(isVisible ? 'hide' : 'show');
    container.classList.add(isVisible ? 'show' : 'hide');
    container.style.maxHeight = isVisible ? container.scrollHeight + 'px' : '0px';
  }

  // 全設定描画
  function renderAllConfigs(config) {
    renderConfigEnabled(config);
    renderConfigDebugModeEnabled(config);
    renderConfigDebugLogEnabled(config);
    renderConfigAdAutoSkipEnabled(config);
  }
  // 全設定の描画状態更新
  function updateAllConfigsVisibility(config) {
    updateVisibilityOfEnabled(config);
    updateVisibilityOfDebugModeEnabled(config);
    updateVisibilityOfDebugLogEnabled(config);
    updateVisibilityOfAdAutoSkipEnabled(config);
  }
  // 初期化
  renderAllConfigs(storageConfig);
  updateAllConfigsVisibility(storageConfig);
});
