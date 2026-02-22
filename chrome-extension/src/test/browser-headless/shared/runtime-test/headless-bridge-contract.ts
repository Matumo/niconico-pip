/**
 * browser-headlessランタイムテストブリッジの通信インターフェース
 */

type HeadlessBridgeDetails = Record<string, boolean>;
type HeadlessBridgeRequestDetails = Record<string, unknown>;

interface HeadlessBridgeRequest {
  channel: string;
  messageType: "request";
  requestId: string;
  path: string;
  details?: HeadlessBridgeRequestDetails;
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
export type {
  HeadlessBridgeDetails,
  HeadlessBridgeRequest,
  HeadlessBridgeRequestDetails,
  HeadlessBridgeResponse,
};
