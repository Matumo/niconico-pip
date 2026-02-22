/**
 * ランタイムテストハンドラーのレジストリ
 */
import { runTest as run_main_config_config_test } from "@test/browser-headless/main/config/config.test.runtime";
import { runTest as run_main_config_event_test } from "@test/browser-headless/main/config/event.test.runtime";
import { runTest as run_main_config_http_test } from "@test/browser-headless/main/config/http.test.runtime";
import { runTest as run_main_config_selector_test } from "@test/browser-headless/main/config/selector.test.runtime";
import { runTest as run_main_adapter_dom_url_change_observer_test } from "@test/browser-headless/main/adapter/dom/url-change-observer.test.runtime";
import { runTest as run_main_domain_page_test } from "@test/browser-headless/main/domain/page.test.runtime";
import type {
  HeadlessBridgeDetails,
  HeadlessBridgeRequest,
} from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";
import { runtimeTestPathMap } from "@test/browser-headless/shared/runtime-test/runtime-test-path";

type RuntimeTestCheckMap = HeadlessBridgeDetails;
type RuntimeTestHandler = (request: HeadlessBridgeRequest) => RuntimeTestCheckMap | Promise<RuntimeTestCheckMap>;

const runtimeTestHandlerMap: Record<string, RuntimeTestHandler> = {
  [runtimeTestPathMap.main.config.configTest]: () => run_main_config_config_test(),
  [runtimeTestPathMap.main.config.eventTest]: () => run_main_config_event_test(),
  [runtimeTestPathMap.main.config.selectorTest]: () => run_main_config_selector_test(),
  [runtimeTestPathMap.main.config.httpTest]: () => run_main_config_http_test(),
  [runtimeTestPathMap.main.adapter.dom.urlChangeObserverTest]: () => run_main_adapter_dom_url_change_observer_test(),
  [runtimeTestPathMap.main.domain.pageTest]: (request) => run_main_domain_page_test(request),
};

// エクスポート
export { runtimeTestHandlerMap };
export type { RuntimeTestHandler, RuntimeTestCheckMap };
