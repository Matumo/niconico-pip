/**
 * globalThisプロパティ操作ヘルパー
 */

// globalThisのプロパティ記述子マップ型
type GlobalDescriptorMap<TPropertyName extends string> = Record<TPropertyName, PropertyDescriptor | undefined>;

// 指定したglobalThisプロパティの記述子を退避する関数
const captureGlobalDescriptors = <TPropertyName extends Extract<keyof typeof globalThis, string>>(
  propertyNames: readonly TPropertyName[],
): GlobalDescriptorMap<TPropertyName> => {
  const descriptors = {} as GlobalDescriptorMap<TPropertyName>;

  for (const propertyName of propertyNames) {
    descriptors[propertyName] = Object.getOwnPropertyDescriptor(globalThis, propertyName);
  }

  return descriptors;
};

// 退避した記述子をglobalThisへ復元する関数
const restoreGlobalDescriptors = <TPropertyName extends string>(
  descriptors: GlobalDescriptorMap<TPropertyName>,
): void => {
  for (const [propertyName, descriptor] of Object.entries(descriptors) as Array<[
    TPropertyName,
    PropertyDescriptor | undefined
  ]>) {
    if (descriptor) {
      Object.defineProperty(globalThis, propertyName, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, propertyName);
    }
  }
};

// globalThisへテスト用値を設定する関数
const setGlobalProperty = <TPropertyName extends string>(propertyName: TPropertyName, value: unknown): void => {
  Object.defineProperty(globalThis, propertyName, {
    configurable: true,
    writable: true,
    value,
  });
};

// エクスポート
export { captureGlobalDescriptors, restoreGlobalDescriptors, setGlobalProperty };
export type { GlobalDescriptorMap };
