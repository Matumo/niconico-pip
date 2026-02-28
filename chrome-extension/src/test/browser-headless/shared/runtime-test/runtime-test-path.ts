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
        videoElementObserverTest: "main_adapter_dom_video_element_observer_test",
        urlChangeObserverTest: "main_adapter_dom_url_change_observer_test",
      },
    },
    domain: {
      elementsTest: "main_domain_elements_test",
      pageTest: "main_domain_page_test",
    },
  },
};

// エクスポート
export { runtimeTestPathMap };
