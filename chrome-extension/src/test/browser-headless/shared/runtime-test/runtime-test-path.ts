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
    debug: {
      debugDumpTriggerTest: "main_debug_debug_dump_trigger_test",
    },
    platform: {
      eventRegistryTest: "main_platform_event_registry_test",
    },
    adapter: {
      dom: {
        videoElementObserverTest: "main_adapter_dom_video_element_observer_test",
        urlChangeObserverTest: "main_adapter_dom_url_change_observer_test",
        videoInfoTest: "main_adapter_dom_video_info_test",
      },
      media: {
        pipRendererTest: "main_adapter_media_pip_renderer_test",
        pipStreamTest: "main_adapter_media_pip_stream_test",
        pipVideoElementTest: "main_adapter_media_pip_video_element_test",
        pipVideoElement: {
          pipVideoElementSizeTest: "main_adapter_media_pip_video_element_size_test",
          pipVideoElementPosterTest: "main_adapter_media_pip_video_element_poster_test",
          pipVideoElementLoadedMetadataTest: "main_adapter_media_pip_video_element_loaded_metadata_test",
        },
      },
    },
    domain: {
      elementsTest: "main_domain_elements_test",
      pageTest: "main_domain_page_test",
      statusTest: "main_domain_status_test",
      pipTest: "main_domain_pip_test",
      shared: {
        resolveEventTargetTest: "main_domain_shared_resolve_event_target_test",
      },
      pip: {
        pipRuntimeTest: "main_domain_pip_pip_runtime_test",
        pipPresentationTest: "main_domain_pip_pip_presentation_test",
        pipFullscreenTest: "main_domain_pip_pip_fullscreen_test",
        pipHandlersTest: "main_domain_pip_pip_handlers_test",
      },
    },
  },
} as const;

// エクスポート
export { runtimeTestPathMap };
