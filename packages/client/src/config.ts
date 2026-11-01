import {
  isAgentKey,
  TEST_PLAYER_KEY,
  type AgentKey,
} from "@linked-realms/shared";
export interface Config {
  serverUrl: string;
  playerKey: AgentKey;
}
export function parseConfig(env: Record<string, unknown>): Config {
  const serverUrl = String(env.VITE_TEST_SERVER_URL || "http://127.0.0.1:2567");
  const url = new URL(serverUrl);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("The test adapter requires a loopback HTTP server URL");
  const playerKey = env.VITE_TEST_PLAYER_KEY || TEST_PLAYER_KEY;
  if (!isAgentKey(playerKey)) throw new Error("Invalid VITE_TEST_PLAYER_KEY");
  return { serverUrl: url.origin, playerKey };
}
