import { defineRoom, defineServer } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { LAND_ROOM } from "@linked-realms/shared";
import { LandRoom, type LandRoomOptions } from "./LandRoom.ts";
export function createServer(options: LandRoomOptions) {
  // Colyseus merges client create options. Keep all authority in this closure.
  class ConfiguredLandRoom extends LandRoom {
    override onCreate(): void {
      super.onCreate(options);
    }
  }
  return defineServer({
    devMode: false,
    transport: new WebSocketTransport({
      maxPayload: 4096,
      perMessageDeflate: false,
    }),
    rooms: { [LAND_ROOM]: defineRoom(ConfiguredLandRoom) },
  });
}
