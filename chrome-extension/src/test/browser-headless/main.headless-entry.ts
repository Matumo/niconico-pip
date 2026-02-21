/**
 * browser-headlessテスト用エントリーポイント
 * 拡張機能のmain処理を読み込んだ後にテストブリッジを登録する
 */
import "@main/main";
import { registerHeadlessBridge } from "@test/browser-headless/shared/runtime-test/register-headless-bridge";

registerHeadlessBridge();
