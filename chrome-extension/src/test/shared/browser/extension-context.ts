/**
 * 拡張機能コンテキスト起動ヘルパー
 * 拡張機能を一時ディレクトリへ複製し、manifestのmatchesをテスト用URLに書き換えて起動する
 */
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { chromium, type BrowserContext } from "@playwright/test";

interface ExtensionManifest {
  content_scripts?: Array<{
    matches?: string[];
  }>;
  web_accessible_resources?: Array<{
    matches?: string[];
  }>;
}

interface LaunchExtensionContextOptions {
  extensionDistDirPath: string;
  additionalMatchPatterns: string[];
  headless?: boolean;
}

interface LaunchExtensionContextResult {
  context: BrowserContext;
  close(): Promise<void>;
}

// 既存matchesへ追加パターンを重複なく統合する関数
const appendUniqueMatches = (matches: string[] | undefined, addition: string[]): string[] => {
  const current = matches ?? [];
  const merged = new Set([...current, ...addition]);
  return [...merged];
};

// manifestのcontent script/web accessible resources両方へ追加matchesを反映する関数
const patchManifestMatches = async (
  manifestFilePath: string,
  additionalMatchPatterns: string[],
): Promise<void> => {
  const source = await readFile(manifestFilePath, "utf8");
  const manifest = JSON.parse(source) as ExtensionManifest;

  for (const script of manifest.content_scripts ?? []) {
    script.matches = appendUniqueMatches(script.matches, additionalMatchPatterns);
  }
  for (const resource of manifest.web_accessible_resources ?? []) {
    resource.matches = appendUniqueMatches(resource.matches, additionalMatchPatterns);
  }

  await writeFile(manifestFilePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
};

// 拡張機能をロードしたPlaywright contextを起動し、終了処理を返す関数
const launchExtensionContext = async (
  options: LaunchExtensionContextOptions,
): Promise<LaunchExtensionContextResult> => {
  // テストごとに独立した拡張機能ディレクトリを作る
  const tempRootDirPath = await mkdtemp(join(tmpdir(), "niconico-pip-extension-"));
  const extensionDirPath = resolve(tempRootDirPath, "extension");

  // ビルド済み拡張を複製し、fixture URL向けのmatchesを埋め込む
  await cp(options.extensionDistDirPath, extensionDirPath, { recursive: true });
  await patchManifestMatches(
    resolve(extensionDirPath, "manifest.json"),
    options.additionalMatchPatterns,
  );

  // 拡張機能を有効化した persistent context で起動する
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: options.headless ?? true,
    args: [
      `--disable-extensions-except=${extensionDirPath}`,
      `--load-extension=${extensionDirPath}`,
    ],
  });

  return {
    context,
    // ブラウザと一時展開した拡張機能ディレクトリを片付ける関数
    close: async () => {
      // ブラウザを閉じた後に一時ディレクトリも削除する
      await context.close();
      await rm(tempRootDirPath, { recursive: true, force: true });
    },
  };
};

// エクスポート
export { launchExtensionContext };
export type { ExtensionManifest, LaunchExtensionContextOptions, LaunchExtensionContextResult };
