import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const defaultMainEntryPath = resolve(projectRoot, "chrome-extension/src/main/main.ts");
const browserHeadlessTestMainEntryPath = resolve(
  projectRoot,
  "chrome-extension/src/test/browser-headless/main.headless-entry.ts",
);
const defaultDistDirPath = resolve(projectRoot, "dist/chrome-extension");
const browserHeadlessTestDistDirPath = resolve(projectRoot, "dist-test/chrome-extension");

const createDefaultBuildConfig = () => ({
  outDir: defaultDistDirPath,
  emptyOutDir: true,
  minify: true,
  sourcemap: true,
  rollupOptions: {
    input: {
      main: defaultMainEntryPath,
    },
    output: {
      entryFileNames: "src/main/[name].js",
    },
  },
});

export default defineConfig(({ mode }) => {
  const buildConfig = createDefaultBuildConfig();

  if (mode === "browser-headless-test") {
    buildConfig.outDir = browserHeadlessTestDistDirPath;
    buildConfig.rollupOptions.input = {
      main: browserHeadlessTestMainEntryPath,
    };
  }

  return {
    root: resolve(projectRoot, "chrome-extension"),
    publicDir: "public",
    resolve: {
      alias: {
        "@main": resolve(projectRoot, "chrome-extension/src/main"),
        "@test": resolve(projectRoot, "chrome-extension/src/test"),
      },
    },
    build: buildConfig,
  };
});
