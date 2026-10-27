import type { InsectFactory, InsectId, InsectConfig } from "./types";
import { monarchConfig } from "./monarch/config";
import { createMonarchRig } from "./monarch/model";

const configs: Record<InsectId, InsectConfig | undefined> = {
  monarch: monarchConfig,
  dragonfly: undefined,
  firefly: undefined,
  "luna-moth": undefined,
  damselfly: undefined,
  bee: undefined,
  ladybird: undefined,
};

const factories: Record<InsectId, InsectFactory | undefined> = {
  monarch: createMonarchRig,
  dragonfly: undefined,
  firefly: undefined,
  "luna-moth": undefined,
  damselfly: undefined,
  bee: undefined,
  ladybird: undefined,
};

export const insectOrder: InsectId[] = [
  "monarch",
  "dragonfly",
  "firefly",
  "luna-moth",
  "damselfly",
  "bee",
  "ladybird",
];

export function getInsectConfig(id: InsectId): InsectConfig {
  const cfg = configs[id];
  if (!cfg) throw new Error(`Insect "${id}" is not implemented yet.`);
  return cfg;
}

export function createInsectRig(id: InsectId) {
  const factory = factories[id];
  if (!factory) throw new Error(`Insect "${id}" is not implemented yet.`);
  return factory();
}
