/**
 * browser-headlessランタイムテストのパス定義
 */

const runtimeTestPathMap = {
  main: {
    config: {
      configTest: "main_config_config_test",
      eventTest: "main_config_event_test",
      selectorTest: "main_config_selector_test",
      httpTest: "main_config_http_test",
    },
    adapter: {
      dom: {
        urlChangeObserverTest: "main_adapter_dom_url_change_observer_test",
      },
    },
    domain: {
      pageTest: "main_domain_page_test",
    },
  },
};

// エクスポート
export { runtimeTestPathMap };
