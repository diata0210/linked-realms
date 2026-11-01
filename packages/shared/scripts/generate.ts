import { writeFileSync } from "node:fs";
import { outputs, renderEmptyLand } from "../src/codegen/index.ts";
writeFileSync(outputs.emptyLand, renderEmptyLand());
console.log(`wrote ${outputs.emptyLand.pathname}`);
