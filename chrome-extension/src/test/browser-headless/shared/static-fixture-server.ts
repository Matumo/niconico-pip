/**
 * fixture用の簡易HTTPサーバー
 * 指定ディレクトリ配下のファイルをHTTPで配信する
 */
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

interface StaticFixtureServerOptions {
  rootDirPath: string;
  defaultDocumentPath?: string;
  host?: string;
}

interface StaticFixtureServer {
  baseUrl: string;
  close(): Promise<void>;
}

// 拡張子からContent-Typeを決める最小マップ
const contentTypeMap: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

// 拡張子からレスポンスのContent-Typeを解決する関数
const resolveContentType = (absoluteFilePath: string): string => {
  const extension = extname(absoluteFilePath).toLowerCase();
  return contentTypeMap[extension] ?? "application/octet-stream";
};

// fixtureディレクトリを配信するHTTPサーバーを起動する関数
const startStaticFixtureServer = async (
  options: StaticFixtureServerOptions,
): Promise<StaticFixtureServer> => {
  // 既定はlocalhost固定で起動する
  const host = options.host ?? "127.0.0.1";
  const rootDirPath = resolve(options.rootDirPath);
  // "/" アクセス時に返す既定ドキュメント
  const defaultDocumentPath = options.defaultDocumentPath ?? "/watch-page.html";

  let server: Server | null = null;

  // 受信したパスに対応するfixtureファイルを返すHTTPハンドラー
  server = createServer(async (request, response) => {
    try {
      const requestUrl = request.url ?? "/";
      const pathname = new URL(requestUrl, `http://${host}`).pathname;
      const documentPath = pathname === "/" ? defaultDocumentPath : pathname;
      const targetFilePath = resolve(rootDirPath, `.${documentPath}`);

      // ルート外アクセス（パストラバーサル）を拒否する
      if (!targetFilePath.startsWith(rootDirPath)) {
        response.statusCode = 403;
        response.end("Forbidden");
        return;
      }

      // 対象ファイルを返却する
      const body = await readFile(targetFilePath);
      response.statusCode = 200;
      response.setHeader("content-type", resolveContentType(targetFilePath));
      response.end(body);
    } catch {
      // ファイル不存在などは404へ統一する
      response.statusCode = 404;
      response.end("Not Found");
    }
  });

  // ポート0で空きポートを自動採番して起動する
  await new Promise<void>((resolveReady, reject) => {
    if (!server) {
      reject(new Error("Server initialization failed"));
      return;
    }
    server.once("error", reject);
    server.listen(0, host, () => {
      server?.off("error", reject);
      resolveReady();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve fixture server address");
  }
  const port = address.port;
  // テストが利用するbaseUrl
  const baseUrl = `http://${host}:${port}`;

  return {
    baseUrl,
    // HTTPサーバーを停止してテストの後処理を完了する関数
    close: async () =>
      new Promise<void>((resolveClosed, reject) => {
        server?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolveClosed();
        });
      }),
  };
};

// エクスポート
export { startStaticFixtureServer };
export type { StaticFixtureServer, StaticFixtureServerOptions };
