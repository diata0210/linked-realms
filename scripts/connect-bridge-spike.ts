// S0 only. Real createServer/LandRoom, with ephemeral tickets and chain/miner fixtures.
/* eslint-disable @typescript-eslint/no-explicit-any -- Measurement harness for dynamically loaded optional Playwright and pinned SDK internals. */
// Build the Go spike first, then: node scripts/connect-bridge-spike.ts <relay-executable>
// Optional real browser: S0_PLAYWRIGHT=<absolute playwright index.mjs>,
// S0_CHROMIUM=<existing chrome.exe>. No dependencies or SDK patches are installed here.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { request } from "node:http";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createServer } from "../packages/map-server/src/server.ts";

const require = createRequire(
  new URL("../packages/map-server/package.json", import.meta.url),
);
const {
  Client,
}: typeof import("../packages/map-server/node_modules/@colyseus/sdk/build/index.js") =
  await import(pathToFileURL(require.resolve("@colyseus/sdk")).href);
const {
  matchMaker,
}: typeof import("../packages/map-server/node_modules/@colyseus/core/build/index.js") =
  await import(pathToFileURL(require.resolve("@colyseus/core")).href);
const { WebSocket: NodeWS } = createRequire(
  require.resolve("@colyseus/ws-transport"),
)("ws");
const { generatePrivateKey, privateKeyToAccount } = await import(
  pathToFileURL(require.resolve("viem/accounts")).href
);
const {
  HUB_EIP712_DOMAIN,
  TravelTicketTypes,
  ticketToWire,
  parseLandMap,
  Messages,
} = await import(pathToFileURL(require.resolve("@linked-realms/shared")).href);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const secrets = new Set<string>();
const redact = (s: string) =>
  [...secrets]
    .reduce((v, secret) => v.replaceAll(secret, "<redacted>"), s)
    .replace(/(sessionId=|reconnectionToken=)[^&'"\s]+/g, "$1<redacted>");
// The SDK logs session IDs on retries. Keep diagnostics, redact those values.
const originalInfo = console.info;
console.info = (...args: unknown[]) =>
  originalInfo(...args.map((v) => (typeof v === "string" ? redact(v) : v)));
function check(name: string, ok: unknown, detail = "") {
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${redact(detail)}` : ""}`,
  );
  assert.ok(ok, name);
}
async function until(name: string, predicate: () => boolean, ms = 5000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > ms) throw new Error(`timeout: ${name}`);
    await sleep(20);
  }
}
async function bounded<T>(
  promise: Promise<T>,
  name: string,
  ms = 10000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout: ${name}`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
const hub = privateKeyToAccount(generatePrivateKey());
const owner = privateKeyToAccount(generatePrivateKey());
async function options() {
  const player = privateKeyToAccount(generatePrivateKey());
  const ticket = {
    player: player.address,
    landId: 7n,
    gate: 0,
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + 60),
    nonce: generatePrivateKey(),
  };
  const signature = await hub.signTypedData({
    domain: HUB_EIP712_DOMAIN(31337),
    types: TravelTicketTypes,
    primaryType: "TravelTicket",
    message: ticket,
  });
  return { ticket: ticketToWire(ticket), signature };
}
const mapText = readFileSync(
  new URL("../maps/empty-land.json", import.meta.url),
  "utf8",
);
const server = createServer({
  landId: 7,
  map: parseLandMap(mapText),
  mapText,
  land: { owner: owner.address, x: 1, y: 0 },
  hubSigner: hub.address,
  chainId: 31337,
  mining: {
    start() {
      throw new Error("mining disabled in S0");
    },
    async stop() {},
    status() {
      return {
        on: false,
        threads: 1,
        hashRate: 0,
        round: 0n,
        submitted: 0,
        won: 0,
      };
    },
  },
});
const events: any[] = [];
const upstream: {
  kind: string;
  url: string;
  headers: Record<string, unknown>;
}[] = [];
const rooms: any[] = [];
const handles = Array.from({ length: 12 }, () =>
  randomBytes(16).toString("hex"),
);
handles.forEach((h) => secrets.add(h));
let relay: ReturnType<typeof spawn> | undefined;
let browser: any;
let address = "";
let nextHandle = 0;
let started = false;
const base = () => `http://${address}/bridge/${handles[nextHandle++]}`;

function raw(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body = "",
) {
  return new Promise<{ status: number; headers: any; body: string }>(
    (resolve, reject) => {
      const req = request(
        {
          hostname: "127.0.0.1",
          port: Number(address.split(":")[1]),
          method,
          path,
          headers,
        },
        (res) => {
          let text = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => (text += chunk));
          res.on("end", () =>
            resolve({
              status: res.statusCode!,
              headers: res.headers,
              body: text,
            }),
          );
        },
      );
      req.setTimeout(5000, () => req.destroy(new Error("HTTP timeout")));
      req.on("error", reject);
      req.end(body);
    },
  );
}
function deniedWS(url: string, origin?: string) {
  return bounded(
    new Promise<number>((resolve, reject) => {
      const ws = new NodeWS(url, { origin });
      ws.on("unexpected-response", (_req: any, res: any) => {
        res.resume();
        ws.terminate();
        resolve(res.statusCode);
      });
      ws.on("open", () => {
        ws.close();
        reject(new Error("unexpected WS admission"));
      });
      ws.on("error", () => {});
    }),
    "WS rejection",
  );
}
async function enter(url: string, origin = false) {
  const index = upstream.length;
  const client = new Client(
    url.replace("http:", "ws:"),
    origin
      ? {
          headers: {
            Origin: `http://${address}`,
            Authorization: "must-not-forward",
            Cookie: "must-not-forward",
            "X-Forwarded-Host": "must-not-forward",
          },
        }
      : undefined,
  );
  const room = await bounded(
    client.joinOrCreate("land", await options()),
    "join",
  );
  rooms.push(room);
  secrets.add(room.sessionId);
  secrets.add(room.reconnectionToken);
  if (room.reconnectionToken) secrets.add(room.reconnectionToken.split(":")[1]);
  let map = "";
  room.onMessage(Messages.map, (value: any) => (map = value.tiled));
  room.onMessage(Messages.land, () => {});
  await until(
    "map and schema",
    () => map === mapText && !!room.state.players.get(room.sessionId),
  );
  check(
    "real SDK join, map and schema",
    room.state.landId === 7,
    `map=${Buffer.byteLength(map)} bytes`,
  );
  const requests = upstream.slice(index);
  check(
    "upstream fixed paths and stripped bridge prefix",
    requests.some(
      (r) => r.kind === "http" && r.url === "/matchmake/joinOrCreate/land",
    ) &&
      requests.some(
        (r) =>
          r.kind === "ws" &&
          r.url ===
            `/${matchMaker.processId}/${room.roomId}?sessionId=${room.sessionId}`,
      ),
  );
  check(
    "Origin/auth/cookie/forwarded headers stripped",
    requests.every(
      (r) =>
        !["origin", "authorization", "cookie", "x-forwarded-host"].some(
          (h) => r.headers[h],
        ),
    ),
  );
  const http = requests.find((r) => r.kind === "http")!;
  check(
    "HTTP forwarded header allowlist",
    Object.keys(http.headers).every((k) =>
      ["host", "content-length", "content-type", "accept"].includes(k),
    ) &&
      http.headers["content-type"] === "application/json" &&
      http.headers.accept === "application/json",
  );
  const x = room.state.players.get(room.sessionId).x;
  room.send(Messages.input, {
    up: false,
    down: false,
    left: false,
    right: true,
  });
  await until(
    "movement schema round trip",
    () => room.state.players.get(room.sessionId)?.x > x,
  );
  room.send(Messages.input, {
    up: false,
    down: false,
    left: false,
    right: false,
  });
  check(
    "movement round trip",
    true,
    `x ${x} -> ${room.state.players.get(room.sessionId).x}`,
  );
  return { client, room };
}

function dropSocket(room: { roomId: string; sessionId: string }) {
  const local = matchMaker.getLocalRoomById(room.roomId);
  assert.ok(local);
  const socket = local.clients.find((c) => c.sessionId === room.sessionId)?.ref;
  assert.ok(
    socket && "terminate" in socket && typeof socket.terminate === "function",
  );
  socket.terminate();
}

try {
  check(
    "Node 26 game runtime",
    process.versions.node.split(".")[0] === "26",
    process.version,
  );
  for (const [pkg, version] of [
    ["@colyseus/sdk", "0.18.8"],
    ["@colyseus/core", "0.18.23"],
    ["@colyseus/ws-transport", "0.18.4"],
  ]) {
    const file = new URL(
      `../packages/map-server/node_modules/${pkg}/package.json`,
      import.meta.url,
    );
    const installed = JSON.parse(readFileSync(file, "utf8"));
    const lock = readFileSync(
      new URL("../pnpm-lock.yaml", import.meta.url),
      "utf8",
    );
    const entry = lock.split(`  '${pkg}@${version}':`)[1]?.split("\n")[1];
    check(
      `pin ${pkg}`,
      installed.version === version && entry?.includes("integrity:"),
      `${installed.version}; ${entry?.trim()}`,
    );
  }
  assert.ok(process.argv[2], "relay executable argument required");
  await server.listen(2567, "127.0.0.1");
  started = true;
  const httpServer = server.transport.server;
  assert.ok(httpServer);
  for (const [event, kind] of [
    ["request", "http"],
    ["upgrade", "ws"],
  ])
    httpServer.prependListener(event, (req: any) => {
      upstream.push({ kind, url: req.url, headers: { ...req.headers } });
    });
  relay = spawn(process.argv[2], [], {
    env: { ...process.env, S0_HANDLES: handles.join(",") },
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true,
  });
  let pending = "";
  relay.stderr!.on("data", (chunk) => {
    pending += chunk;
    let end;
    while ((end = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, end);
      pending = pending.slice(end + 1);
      try {
        const event = JSON.parse(line);
        events.push(event);
        if (event.event === "listening") address = event.address;
      } catch {
        console.error(redact(line));
      }
    }
  });
  let spawnError: Error | undefined;
  relay.on("error", (e) => (spawnError = e));
  await until("relay listen", () => {
    if (spawnError) throw spawnError;
    return !!address;
  });
  console.log(
    `MEASURE relay=http://${address}; upstream=http://127.0.0.1:2567`,
  );

  // Normal path first: no monkey patch, urlBuilder, custom fetch or forced publicAddress.
  const firstURL = base();
  const first = await enter(firstURL);
  console.log(
    `MEASURE upstream requests=${JSON.stringify(upstream.map((r) => ({ kind: r.kind, url: redact(r.url), headers: Object.keys(r.headers) })))}`,
  );
  console.log(
    `MEASURE source reservation keys=${JSON.stringify(events.find((e) => e.event === "reservation").keys.sort())}`,
  );
  check(
    "Node native WebSocket sends no Origin",
    events.some((e) => e.event === "ws-open" && !e.origin),
  );
  first.room.reconnection.enabled = false;
  await bounded(first.room.leave(), "first leave");
  check(
    "old handle matchmaking rejected",
    (
      await raw(
        "POST",
        new URL(firstURL).pathname + "/matchmake/joinOrCreate/land",
        { "content-type": "application/json" },
        "{}",
      )
    ).status === 409,
  );
  const second = await enter(base(), true);
  check(
    "fresh Client and Room after leave",
    second.client !== first.client &&
      second.room !== first.room &&
      second.room.sessionId !== first.room.sessionId,
  );
  check(
    "browser-like HTTP Origin accepted",
    events.some((e) => e.event === "reservation" && e.origin),
  );
  second.room.reconnection.enabled = false;
  let drop = 0,
    leave = 0;
  second.room.onDrop((c: number) => (drop = c));
  second.room.onLeave((c: number) => (leave = c));
  const before = events.filter((e) => e.event === "ws-rejected").length;
  dropSocket(second.room);
  await until("disabled reconnect leave", () => !!leave);
  await sleep(500);
  check(
    "public reconnection.enabled=false on abrupt drop",
    drop === 1006 &&
      leave === 1006 &&
      second.room.reconnection.retryCount === 0 &&
      events.filter((e) => e.event === "ws-rejected").length === before,
    `drop=${drop}, leave=${leave}, retries=${second.room.reconnection.retryCount}`,
  );

  const automatic = await enter(base());
  check(
    "automatic reconnect default enabled",
    automatic.room.reconnection.enabled === true &&
      automatic.room.reconnection.minUptime === 5000,
  );
  await sleep(5100);
  let automaticDrop = 0;
  automatic.room.onDrop((c: number) => (automaticDrop = c));
  automatic.room.onError(() => {});
  dropSocket(automatic.room);
  await until("automatic reconnect rejected", () =>
    events.some((e) => e.event === "ws-rejected" && e.reconnect),
  );
  check(
    "default reconnect attempts old WS with token and is refused",
    automaticDrop === 1006 && automatic.room.reconnection.retryCount >= 1,
    `retries=${automatic.room.reconnection.retryCount}`,
  );
  await bounded(automatic.room.leave(), "cancel reconnect");
  let reconnectRefused = false;
  try {
    await bounded(
      automatic.client.reconnect(automatic.room.reconnectionToken),
      "explicit reconnect",
    );
  } catch {
    reconnectRefused = true;
  }
  check("explicit SDK reconnect API refused", reconnectRefused);

  let deniedCode: number | undefined;
  try {
    await bounded(
      new Client(base().replace("http:", "ws:")).joinOrCreate("land", {}),
      "server rejection",
    );
  } catch (error: any) {
    deniedCode = error.code;
  }
  check(
    "real LandRoom rejection forwarded",
    deniedCode === 4401,
    `code=${deniedCode}`,
  );

  const seatURL = base();
  const route = new URL(seatURL).pathname;
  const reservation = await raw(
    "POST",
    route + "/matchmake/joinOrCreate/land",
    {
      "content-type": "application/json",
      accept: "application/json",
      origin: `http://${address}`,
    },
    JSON.stringify(await options()),
  );
  const seat = JSON.parse(reservation.body);
  secrets.add(seat.sessionId);
  check(
    "reservation projection",
    reservation.status === 200 &&
      seat.protocol === "ws" &&
      seat.devMode === false &&
      !seat.publicAddress &&
      !seat.room &&
      !seat.reconnectionToken,
  );
  check(
    "response CORS stripped",
    !reservation.headers["access-control-allow-origin"] &&
      !reservation.headers["set-cookie"] &&
      !reservation.headers.location,
  );
  console.log(
    `MEASURE reservation=${JSON.stringify({ ...seat, sessionId: "<redacted>" })}`,
  );
  const wsURL = `${seatURL.replace("http:", "ws:")}/${seat.processId}/${seat.roomId}?sessionId=${seat.sessionId}`;
  check(
    "bad sessionId rejected",
    (await deniedWS(wsURL.replace(seat.sessionId, "bad-session"))) === 403,
  );
  check(
    "wrong processId rejected",
    (await deniedWS(
      wsURL.replace(`/${seat.processId}/`, "/wrong-process/"),
    )) === 403,
  );
  check(
    "wrong roomId rejected",
    (await deniedWS(wsURL.replace(`/${seat.roomId}?`, "/wrong-room?"))) === 403,
  );
  check(
    "seat bound to handle",
    (await deniedWS(
      wsURL.replace(new URL(seatURL).pathname, new URL(firstURL).pathname),
    )) === 403,
  );
  check(
    "extra WS query rejected",
    (await deniedWS(wsURL + "&skipHandshake=1")) === 403,
  );
  check(
    "duplicate sessionId rejected",
    (await deniedWS(wsURL + `&sessionId=${seat.sessionId}`)) === 403,
  );
  check(
    "browser-like WS foreign Origin rejected",
    (await deniedWS(wsURL, "http://foreign.invalid")) === 403,
  );
  // Raw ws client supplies the browser Origin; the real browser below uses its native WebSocket.
  await bounded(
    new Promise<void>((resolve, reject) => {
      const ws = new NodeWS(wsURL, { origin: `http://${address}` });
      ws.on("error", reject);
      ws.once("message", (data: Buffer, binary: boolean) => {
        try {
          check(
            "browser-like WS same Origin handshake",
            binary && data[0] === 10,
          );
          ws.close();
          resolve();
        } catch (e) {
          ws.terminate();
          reject(e);
        }
      });
    }),
    "Origin WS",
  );
  check("consumed seat replay rejected", (await deniedWS(wsURL)) === 403);
  const expiryURL = base();
  const expired = await raw(
    "POST",
    new URL(expiryURL).pathname + "/matchmake/joinOrCreate/land",
    { "content-type": "application/json" },
    JSON.stringify(await options()),
  );
  const expirySeat = JSON.parse(expired.body);
  secrets.add(expirySeat.sessionId);
  await sleep(15500);
  check(
    "expired reservation rejected",
    (await deniedWS(
      `${expiryURL.replace("http:", "ws:")}/${expirySeat.processId}/${expirySeat.roomId}?sessionId=${expirySeat.sessionId}`,
    )) === 403,
  );

  const boundary = base();
  const p = new URL(boundary).pathname;
  const upstreamBefore = upstream.length;
  for (const path of [
    "/admin",
    "/matchmake/reconnect/land",
    "/matchmake/create/land",
    "/matchmake/joinById/land",
    "/../admin",
    "/%2e%2e/admin",
    "/%2fadmin",
    "/x\\admin",
    "//evil.invalid",
    "/matchmake/joinOrCreate/land?target=http://evil.invalid",
  ]) {
    const response = await raw(
      "POST",
      p + path,
      { "content-type": "application/json" },
      "{}",
    );
    check(`path refused ${path}`, response.status >= 400);
  }
  check(
    "preflight refused",
    (
      await raw("OPTIONS", p + "/matchmake/joinOrCreate/land", {
        origin: `http://${address}`,
        "access-control-request-method": "POST",
      })
    ).status === 404,
  );
  check(
    "foreign Origin refused",
    (
      await raw("POST", p + "/matchmake/joinOrCreate/land", {
        origin: "http://foreign.invalid",
      })
    ).status === 403,
  );
  check(
    "null Origin refused",
    (await raw("POST", p + "/matchmake/joinOrCreate/land", { origin: "null" }))
      .status === 403,
  );
  check(
    "wrong Host refused",
    (
      await raw("POST", p + "/matchmake/joinOrCreate/land", {
        host: "localhost:" + address.split(":")[1],
      })
    ).status === 403,
  );
  check(
    "rejected HTTP probes never reach map-server",
    upstream.length === upstreamBefore,
  );
  check(
    "HTTP body cap",
    (
      await raw(
        "POST",
        p + "/matchmake/joinOrCreate/land",
        { "content-type": "application/json" },
        "x".repeat(65537),
      )
    ).status === 413,
  );

  if (process.env.S0_PLAYWRIGHT && process.env.S0_CHROMIUM) {
    const { chromium } = await import(
      pathToFileURL(process.env.S0_PLAYWRIGHT).href
    );
    browser = await chromium.launch({
      executablePath: process.env.S0_CHROMIUM,
      headless: true,
    });
    const page = await browser.newPage();
    page.on("response", (res: any) => {
      if (res.url().includes("/matchmake/"))
        console.log(
          `MEASURE browser HTTP status=${res.status()} url=${redact(res.url())}`,
        );
    });
    page.on("console", (msg: any) => {
      if (msg.type() === "error")
        console.log(`MEASURE browser error=${redact(msg.text())}`);
    });
    const sdkDir = fileURLToPath(
      new URL(
        "../packages/map-server/node_modules/@colyseus/sdk",
        import.meta.url,
      ),
    );
    // Use a REAL loopback response to establish Chromium's local address space.
    // Playwright route.fulfill() produces a synthetic document that can trigger LNA.
    // A 404 document suffices as the test UI; no browser security flags or CORS bypass.
    await page.goto(`http://${address}/`);
    await page.addScriptTag({
      content: readFileSync(join(sdkDir, "dist/colyseus.js"), "utf8"),
    });
    const browserBase = base();
    const browserEvents = events.length;
    const result = await page.evaluate(
      async ({ url, opts }: any) => {
        const sdk = (globalThis as any).Colyseus;
        const client = new sdk.Client(url.replace("http:", "ws:"));
        let room;
        try {
          room = await client.joinOrCreate("land", opts);
        } catch (e: any) {
          throw new Error(`browser join code=${e.code} message=${e.message}`, {
            cause: e,
          });
        }
        room.reconnection.enabled = false;
        let map = "";
        room.onMessage("map", (v: any) => (map = v.tiled));
        room.onMessage("land", () => {});
        const until = async (fn: () => boolean) => {
          const end = Date.now() + 5000;
          while (!fn()) {
            if (Date.now() > end) throw new Error("browser timeout");
            await new Promise((r) => setTimeout(r, 20));
          }
        };
        await until(() => !!map && !!room.state.players.get(room.sessionId));
        const x = room.state.players.get(room.sessionId).x;
        room.send("input", {
          up: false,
          down: false,
          left: false,
          right: true,
        });
        await until(() => room.state.players.get(room.sessionId).x > x);
        const result = {
          mapBytes: new TextEncoder().encode(map).length,
          moved: true,
          landId: room.state.landId,
        };
        await room.leave();
        return result;
      },
      { url: browserBase, opts: await options() },
    );
    check(
      "real Chromium unpatched SDK join/map/schema/movement",
      result.moved &&
        result.landId === 7 &&
        result.mapBytes === Buffer.byteLength(mapText),
      JSON.stringify(result),
    );
    check(
      "real browser WS supplied Origin",
      events
        .slice(browserEvents)
        .some((e) => e.event === "ws-open" && e.origin),
    );
    console.log(`MEASURE Chromium ${browser.version()}`);
    await browser.close();
    browser = undefined;
  } else
    console.log(
      "NOT VERIFIED real browser (set S0_PLAYWRIGHT and S0_CHROMIUM to existing installation)",
    );
  await sleep(100);
  const frames = events.filter((e) => e.event === "frame");
  check(
    "binary schema/full state/patch and game messages",
    frames.some((e) => e.direction === "down" && e.opcode === 14) &&
      frames.some((e) => e.direction === "down" && e.opcode === 15) &&
      frames.some((e) => e.direction === "down" && e.opcode === 13) &&
      frames.some((e) => e.direction === "up" && e.opcode === 13),
  );
  console.log(
    `MEASURE frame counts ${JSON.stringify(
      frames.reduce((counts, e) => {
        const k = `${e.direction}:${e.opcode}`;
        counts[k] = (counts[k] ?? 0) + 1;
        return counts;
      }, {}),
    )}`,
  );
  check("unpatched SDK + loopback routing GO", true, "SDK ships unpatched");
} catch (error) {
  console.error(
    `FAIL scenario: ${redact(error instanceof Error ? (error.stack ?? error.message) : String(error))}`,
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const room of rooms) {
    room.reconnection.enabled = false;
    await bounded(room.leave(), "cleanup leave", 2000).catch(() => {});
  }
  if (relay && relay.exitCode === null) {
    const stopped = new Promise<void>((resolve) =>
      relay!.once("exit", () => resolve()),
    );
    relay.kill();
    await bounded(stopped, "relay shutdown");
  }
  if (started)
    await bounded(server.gracefullyShutdown(false), "map-server shutdown");
  console.info = originalInfo;
}
