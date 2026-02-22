/**
 * コンテンツスクリプト実行中に使うheadlessテストブリッジ
 */
import { getLogger } from "@matumo/ts-simple-logger";
import { runtimeTestHandlerMap } from "@test/browser-headless/shared/runtime-test/runtime-test-registry";
import {
  type HeadlessBridgeDetails,
  headlessBridgeChannel,
  type HeadlessBridgeRequest,
  type HeadlessBridgeResponse,
} from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";

const registrationFlagKey = "__niconico_pip_headless_bridge_registered__";
const logger = getLogger("test");
const currentWindowSource = globalThis as unknown as MessageEventSource;

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isHeadlessBridgeRequest = (value: unknown): value is HeadlessBridgeRequest => {
  if (!isObjectRecord(value)) return false;
  const details = value.details;
  const isValidDetails = details === undefined || isObjectRecord(details);
  return value.channel === headlessBridgeChannel
    && value.messageType === "request"
    && typeof value.requestId === "string"
    && typeof value.path === "string"
    && isValidDetails;
};

const isBooleanRecord = (value: unknown): value is Record<string, boolean> => {
  if (!isObjectRecord(value)) return false;
  return Object.values(value).every((entry) => typeof entry === "boolean");
};

const createResponse = (
  request: HeadlessBridgeRequest,
  details: HeadlessBridgeDetails,
): HeadlessBridgeResponse => ({
  channel: headlessBridgeChannel,
  messageType: "response",
  requestId: request.requestId,
  path: request.path,
  ok: Object.values(details).every((value) => value === true),
  details,
});

const formatDetailsLog = (details: HeadlessBridgeDetails): string => {
  const lines = Object.entries(details).map(
    ([name, result]) => `  ${name}: ${result ? "OK" : "NG"}`,
  );
  return `\n${lines.join("\n")}\n`;
};

const logResponse = (
  path: string,
  response: HeadlessBridgeResponse,
  errorMessage?: string,
): void => {
  const errorLine = errorMessage ? `\n  error: ${errorMessage}` : "";
  logger.info(`end ${path} ok=${response.ok}${errorLine}${formatDetailsLog(response.details)}`);
};

const registerHeadlessBridge = (): void => {
  const windowRecord = globalThis as unknown as Record<string, unknown>;
  if (windowRecord[registrationFlagKey] === true) return;
  windowRecord[registrationFlagKey] = true;
  const targetOrigin = globalThis.location.origin;

  globalThis.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== currentWindowSource || event.origin !== targetOrigin ||
        !isHeadlessBridgeRequest(event.data)) {
      return;
    }

    const request = event.data;
    const handler = runtimeTestHandlerMap[request.path];

    if (!handler) {
      const details = { handlerRegistered: false };
      const response = createResponse(request, details);
      logResponse(request.path, response);
      globalThis.postMessage(response, targetOrigin);
      return;
    }

    void Promise.resolve(handler(request))
      .then((details) => {
        const resolvedDetails = isBooleanRecord(details)
          ? details
          : { runtimeTestDetailsResolved: false };
        const response = createResponse(request, resolvedDetails);
        logResponse(request.path, response);
        globalThis.postMessage(response, targetOrigin);
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const details = { handlerExecutionSucceeded: false };
        const response = createResponse(request, details);
        logResponse(request.path, response, errorMessage);
        globalThis.postMessage(response, targetOrigin);
      });
  });
};

// エクスポート
export { registerHeadlessBridge };
