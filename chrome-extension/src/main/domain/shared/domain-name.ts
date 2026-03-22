/**
 * ドメイン名定義
 */

// NOTE: このリストがドメイン名の正本であり、
// start時は listener-first order、stop時はその逆順の正本として扱う。
const domainNameOrderList = [
  "pip",
  "status",
  "elements",
  "time",
  "controller",
  "media-session",
  "ad",
  "page",
] as const;

type DomainName = typeof domainNameOrderList[number];

const domainOrderRecord = domainNameOrderList.reduce<Record<DomainName, number>>(
  (record, domainName, index) => {
    record[domainName] = index;
    return record;
  },
  {} as Record<DomainName, number>,
);

const resolveDomainOrder = (domainName: DomainName): number => domainOrderRecord[domainName];

// エクスポート
export { domainNameOrderList, resolveDomainOrder };
export type { DomainName };
