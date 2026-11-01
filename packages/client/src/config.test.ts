import { expect, it } from "vitest";
import { TEST_PLAYER_KEY } from "@linked-realms/shared";
import { parseConfig } from "./config.ts";
it("starts without RPC, wallet or Hub configuration", () => {
  expect(parseConfig({})).toEqual({
    serverUrl: "http://127.0.0.1:2567",
    playerKey: TEST_PLAYER_KEY,
  });
  expect(
    parseConfig({ VITE_TEST_SERVER_URL: "http://127.0.0.1:2569" }).serverUrl,
  ).toBe("http://127.0.0.1:2569");
});
it.each([
  "https://example.com",
  "ws://127.0.0.1:2567",
  "http://127.0.0.1:2567/path",
  "http://user@127.0.0.1:2567",
  "http://127.0.0.1:2567/?x=1",
])("refuses a nonlocal test endpoint %s", (url) => {
  expect(() => parseConfig({ VITE_TEST_SERVER_URL: url })).toThrow();
});
it("rejects wallet-shaped and malformed Player keys", () => {
  for (const key of ["0x1234", "A".repeat(64), "a".repeat(63)])
    expect(() => parseConfig({ VITE_TEST_PLAYER_KEY: key })).toThrow();
});
