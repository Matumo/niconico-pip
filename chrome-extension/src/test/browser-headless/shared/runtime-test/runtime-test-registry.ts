/**
 * ランタイムテストハンドラーのレジストリ
 */
import { runTest as run_main_config_config_test } from "@test/browser-headless/main/config/config.test.runtime";
import { runTest as run_main_config_event_test } from "@test/browser-headless/main/config/event.test.runtime";
import { runTest as run_main_config_http_test } from "@test/browser-headless/main/config/http.test.runtime";
import { runTest as run_main_config_selector_test } from "@test/browser-headless/main/config/selector.test.runtime";
import { runTest as run_main_adapter_dom_video_element_observer_test } from "@test/browser-headless/main/adapter/dom/video-element-observer.test.runtime";
import { runTest as run_main_adapter_dom_url_change_observer_test } from "@test/browser-headless/main/adapter/dom/url-change-observer.test.runtime";
import { runTest as run_main_adapter_dom_video_info_test } from "@test/browser-headless/main/adapter/dom/video-info.test.runtime";
import { runTest as run_main_adapter_media_pip_video_element_test } from "@test/browser-headless/main/adapter/media/pip-video-element.test.runtime";
import { runTest as run_main_adapter_media_pip_video_element_size_test } from "@test/browser-headless/main/adapter/media/pip-video-element-size.test.runtime";
import { runTest as run_main_adapter_media_pip_video_element_poster_test } from "@test/browser-headless/main/adapter/media/pip-video-element-poster.test.runtime";
import { runTest as run_main_adapter_media_pip_video_element_loaded_metadata_test } from "@test/browser-headless/main/adapter/media/pip-video-element-loaded-metadata.test.runtime";
import { runTest as run_main_domain_elements_test } from "@test/browser-headless/main/domain/elements.test.runtime";
import { runTest as run_main_domain_page_test } from "@test/browser-headless/main/domain/page.test.runtime";
import { runTest as run_main_domain_pip_test } from "@test/browser-headless/main/domain/pip.test.runtime";
import { runTest as run_main_domain_status_test } from "@test/browser-headless/main/domain/status.test.runtime";
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
  [runtimeTestPathMap.main.adapter.dom.videoElementObserverTest]: () => run_main_adapter_dom_video_element_observer_test(),
  [runtimeTestPathMap.main.adapter.dom.urlChangeObserverTest]: () => run_main_adapter_dom_url_change_observer_test(),
  [runtimeTestPathMap.main.adapter.dom.videoInfoTest]: () => run_main_adapter_dom_video_info_test(),
  [runtimeTestPathMap.main.adapter.media.pipVideoElementTest]: () => run_main_adapter_media_pip_video_element_test(),
  [runtimeTestPathMap.main.adapter.media.pipVideoElementSizeTest]: () => run_main_adapter_media_pip_video_element_size_test(),
  [runtimeTestPathMap.main.adapter.media.pipVideoElementPosterTest]: (request) => run_main_adapter_media_pip_video_element_poster_test(request),
  [runtimeTestPathMap.main.adapter.media.pipVideoElementLoadedMetadataTest]: () => run_main_adapter_media_pip_video_element_loaded_metadata_test(),
  [runtimeTestPathMap.main.domain.elementsTest]: (request) => run_main_domain_elements_test(request),
  [runtimeTestPathMap.main.domain.pageTest]: (request) => run_main_domain_page_test(request),
  [runtimeTestPathMap.main.domain.pipTest]: (request) => run_main_domain_pip_test(request),
  [runtimeTestPathMap.main.domain.statusTest]: (request) => run_main_domain_status_test(request),
};

// エクスポート
export { runtimeTestHandlerMap };
export type { RuntimeTestHandler, RuntimeTestCheckMap };
