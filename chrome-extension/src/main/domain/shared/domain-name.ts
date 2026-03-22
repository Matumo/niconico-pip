/**
 * ドメイン名定義
 */

// NOTE: このリストがドメイン名の正本であり、既定の起動順も兼ねる。
const domainNameOrderList = [
  "elements",
  "status",
  "time",
  "controller",
  "media-session",
  "pip",
  "ad",
  "page",
] as const;

type DomainName = typeof domainNameOrderList[number];

// エクスポート
export { domainNameOrderList };
export type { DomainName };
