import type { AgentKey } from "@linked-realms/shared";
export function shortKey(key: AgentKey): string {
  return `${key.slice(0, 6)}\u2026${key.slice(-4)}`;
}
