// Generate validated local map data; topology uses the shared adjacency schema.
import { MINE_TILES, TILE_SIZE_PX } from "../map/index.ts";
import * as rules from "../rules/index.ts";
export const outputs = {
  emptyLand: new URL("../../../../maps/empty-land.json", import.meta.url),
};

/** The flat, empty stage 1 Land (Tiled JSON): grass everywhere, the Mine in the middle. */
export function renderEmptyLand(): string {
  const size = rules.LAND_SIZE_TILES;
  const map = {
    type: "map",
    version: "1.10",
    tiledversion: "1.11.2",
    orientation: "orthogonal",
    renderorder: "right-down",
    infinite: false,
    width: size,
    height: size,
    tilewidth: TILE_SIZE_PX,
    tileheight: TILE_SIZE_PX,
    nextlayerid: 3,
    nextobjectid: 6,
    tilesets: [{ firstgid: 1, name: "terrain" }],
    layers: [
      {
        id: 1,
        name: "ground",
        type: "tilelayer",
        x: 0,
        y: 0,
        width: size,
        height: size,
        opacity: 1,
        visible: true,
        data: Array<number>(size * size).fill(1),
      },
      {
        id: 2,
        name: "objects",
        type: "objectgroup",
        x: 0,
        y: 0,
        opacity: 1,
        visible: true,
        draworder: "topdown",
        objects: [
          {
            id: 1,
            name: "mine",
            type: "mine",
            x: MINE_TILES.x * TILE_SIZE_PX,
            y: MINE_TILES.y * TILE_SIZE_PX,
            width: MINE_TILES.width * TILE_SIZE_PX,
            height: MINE_TILES.height * TILE_SIZE_PX,
            rotation: 0,
            visible: true,
          },
          ...rules.DIRECTIONS.map((direction, i) => {
            const g = rules.gateRect(direction);
            return {
              id: i + 2,
              name: `gate-${direction}`,
              type: "gate",
              x: g.tileX * TILE_SIZE_PX,
              y: g.tileY * TILE_SIZE_PX,
              width: g.width * TILE_SIZE_PX,
              height: g.height * TILE_SIZE_PX,
              rotation: 0,
              visible: true,
              properties: [
                { name: "direction", type: "string", value: direction },
              ],
            };
          }),
        ],
      },
    ],
  };
  return `${JSON.stringify(map)}\n`;
}
