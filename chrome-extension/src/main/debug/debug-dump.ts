/**
 * debug dump
 */

export { createDebugDumpRegistry } from "./debug-dump-registry";
export { createDebugDumpRequestEventName, installDebugDumpTrigger } from "./debug-dump-trigger";
export type {
  DebugDumpPrimitive,
  DebugDumpValue,
  DebugDumpObject,
  DebugDumpSource,
  PageDomainDebugDumpInput,
  ElementsDomainDebugDumpInput,
  StatusDomainDebugDumpInput,
  PipDomainDebugDumpInput,
  RegisterPageDomainDebugDumpOptions,
  RegisterElementsDomainDebugDumpOptions,
  RegisterStatusDomainDebugDumpOptions,
  RegisterPipDomainDebugDumpOptions,
  DebugDumpRegistry,
} from "./debug-dump-types";
