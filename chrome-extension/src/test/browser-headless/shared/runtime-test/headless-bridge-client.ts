/**
 * browser-headlessランタイムテストブリッジのクライアント
 */
import type { Page } from "@playwright/test";
import {
  headlessBridgeChannel,
  type HeadlessBridgeDetails,
  type HeadlessBridgeResponse,
} from "@test/browser-headless/shared/runtime-test/headless-bridge-contract";
import { logRuntimeTestFailure } from "@test/shared/test-logger";

interface ExecuteHeadlessRuntimeTestOptions {
  timeoutMs?: number;
}

interface ExecuteHeadlessRuntimeTestResult {
  ok: boolean;
  details: HeadlessBridgeDetails;
}

const defaultRequestTimeoutMs = 3000;

const executeHeadlessRuntimeTest = async (
  page: Page,
  path: string,
  options: ExecuteHeadlessRuntimeTestOptions = {},
): Promise<ExecuteHeadlessRuntimeTestResult> => {
  const timeoutMs = options.timeoutMs ?? defaultRequestTimeoutMs;

  const result = await page.evaluate(({ channel, requestPath, requestTimeoutMs }) =>
      new Promise<ExecuteHeadlessRuntimeTestResult>((resolve, reject) => {
        const targetOrigin = globalThis.location.origin;
        const currentWindowSource = globalThis as unknown as MessageEventSource;
        const requestId = typeof crypto.randomUUID === "function" ?
          crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const timerId = globalThis.setTimeout(() => {
          globalThis.removeEventListener("message", onMessage);
          reject(new Error(`Headless bridge request timeout: ${requestPath}`));
        }, requestTimeoutMs);

        const onMessage = (event: MessageEvent<unknown>): void => {
          if (event.source !== currentWindowSource || event.origin !== targetOrigin) return;

          const response = event.data as HeadlessBridgeResponse | null;
          if (!response) return;
          if (response.channel !== channel || response.messageType !== "response" ||
              response.requestId !== requestId || response.path !== requestPath) {
            return;
          }

          globalThis.clearTimeout(timerId);
          globalThis.removeEventListener("message", onMessage);
          resolve({
            ok: response.ok === true,
            details: response.details,
          });
        };

        globalThis.addEventListener("message", onMessage);
        globalThis.postMessage(
          {
            channel,
            messageType: "request",
            requestId,
            path: requestPath,
          },
          targetOrigin,
        );
      }),
    {
      channel: headlessBridgeChannel,
      requestPath: path,
      requestTimeoutMs: timeoutMs,
    },
  );

  if (!result.ok) logRuntimeTestFailure(path, result.details);
  return result;
};

// エクスポート
export { executeHeadlessRuntimeTest };
export type { ExecuteHeadlessRuntimeTestOptions, ExecuteHeadlessRuntimeTestResult };
