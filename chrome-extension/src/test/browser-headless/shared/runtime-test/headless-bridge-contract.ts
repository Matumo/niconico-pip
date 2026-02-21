/**
 * browser-headlessランタイムテストブリッジの通信インターフェース
 */

type HeadlessBridgeDetails = Record<string, boolean>;

interface HeadlessBridgeRequest {
  channel: string;
  messageType: "request";
  requestId: string;
  path: string;
}

interface HeadlessBridgeResponse {
  channel: string;
  messageType: "response";
  requestId: string;
  path: string;
  ok: boolean;
  details: HeadlessBridgeDetails;
}

const headlessBridgeChannel = "niconico-pip-headless-bridge";

// エクスポート
export { headlessBridgeChannel };
export type { HeadlessBridgeDetails, HeadlessBridgeRequest, HeadlessBridgeResponse };
