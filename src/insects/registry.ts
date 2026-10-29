import type { InsectFactory, InsectId, InsectConfig } from "./types";
import { dragonflyConfig } from "./dragonfly/config";
import { createDragonflyRig } from "./dragonfly/model";
import { lunaMothConfig } from "./luna-moth/config";
import { createLunaMothRig } from "./luna-moth/model";
import { monarchConfig } from "./monarch/config";
import { createMonarchRig } from "./monarch/model";

const configs: Record<InsectId, InsectConfig | undefined> = {
  monarch: monarchConfig,
  dragonfly: dragonflyConfig,
  firefly: undefined,
  "luna-moth": lunaMothConfig,
  damselfly: undefined,
  bee: undefined,
  ladybird: undefined,
};

const factories: Record<InsectId, InsectFactory | undefined> = {
  monarch: createMonarchRig,
  dragonfly: createDragonflyRig,
  firefly: undefined,
  "luna-moth": createLunaMothRig,
  damselfly: undefined,
  bee: undefined,
  ladybird: undefined,
};

export function implementedInsectIds(): InsectId[] {
  return insectOrder.filter((id) => configs[id] != null);
}

export const insectOrder: InsectId[] = [
  "monarch",
  "dragonfly",
  "firefly",
  "luna-moth",
  "damselfly",
  "bee",
  "ladybird",
];

/** Wikipedia article titles that get a specific insect; anything else falls back to the Monarch. */
const ARTICLE_INSECTS: Record<string, InsectId> = {
  butterfly: "monarch",
  monarch_butterfly: "monarch",
  dragonfly: "dragonfly",
  common_green_darner: "dragonfly",
  anax_junius: "dragonfly",
  luna_moth: "luna-moth",
  actias_luna: "luna-moth",
};

const SESSION_KEY = "entomon-insect";

function implemented(id: string): id is InsectId {
  return configs[id as InsectId] != null;
}

function articleInsect(pathname: string): InsectId | undefined {
  const match = /^\/wiki\/([^?#]+)/.exec(pathname);
  if (!match) return undefined;
  const title = decodeURIComponent(match[1]).toLowerCase();
  const id = ARTICLE_INSECTS[title];
  return id && implemented(id) ? id : undefined;
}

function remember(id: InsectId): void {
  try {
    sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    /* private mode / blocked storage */
  }
}

function remembered(): InsectId | undefined {
  try {
    const id = sessionStorage.getItem(SESSION_KEY);
    return id && implemented(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * `?entomon=<id>` wins, then the article's mapped species. On other pages, keep the insect
 * chosen for this tab so following a Wikipedia link does not snap back to the Monarch.
 */
export function insectForLocation(loc: Location = window.location): InsectId {
  const requested = new URLSearchParams(loc.search).get("entomon");
  if (requested && implemented(requested)) {
    remember(requested);
    return requested;
  }
  const fromArticle = articleInsect(loc.pathname);
  if (fromArticle) {
    remember(fromArticle);
    return fromArticle;
  }
  return remembered() ?? "monarch";
}

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
