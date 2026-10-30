// Долгий прогресс игрока в localStorage, отдельно от состояния текущего
// захода (defeatedSprites в WorldScene/BattleScene сбрасывается перезагрузкой):
// - introduced — биомы, где уже был этап знакомства со словами (Presentation);
// - learned — спрайты монстров, побеждённых хотя бы раз (Словарик-коллекция);
// - stars — «валюта» за победы/тренировки/сундуки, тратится на шапки;
// - chests — открытые сундуки (`<биом>:<индекс>`), сундук открывается один раз;
// - bosses — биомы, где побеждён Босс (после этого житель биома переезжает в деревню);
// - hats / hat — купленные шапки и надетая сейчас;
// - quests — статус заданий NPC ({id: 'active' | 'done'});
// - garden — грядки огорода ({индекс: {crop, stage}}), harvested — собранные культуры;
// - clears — сколько раз побеждён Босс биома ({биом: n}) → уровень сложности боя;
// - items — купленное снаряжение (оружие), weapon — надетое; potions — {id: количество};
// - records — рекорды мини-игр Арены ({игра: число});
// - mastery — верные ответы по спрайту ({sprite: n}) → звёзды мастерства в Словарике;
// - pets / pet — купленные питомцы и тот, что ходит за Redbok'ом;
// - keys — ключи (расходник), torch — куплен ли факел, doors — открытые двери;
// - daily — ежедневное задание {date, id, count, done};
// - bag — собранное для поручений ({flower_red: n, ...}).
const KEYS = {
  mastery: 'redbok_mastery',
  pets: 'redbok_owned_pets',
  pet: 'redbok_pet',
  keys: 'redbok_keys',
  torch: 'redbok_torch',
  doors: 'redbok_doors',
  daily: 'redbok_daily',
  bag: 'redbok_bag',
  clears: 'redbok_biome_clears',
  items: 'redbok_owned_items',
  weapon: 'redbok_weapon',
  potions: 'redbok_potions',
  records: 'redbok_records',
  introduced: 'redbok_introduced_biomes',
  learned: 'redbok_learned_sprites',
  stars: 'redbok_stars',
  chests: 'redbok_opened_chests',
  bosses: 'redbok_defeated_bosses',
  hats: 'redbok_owned_hats',
  hat: 'redbok_worn_hat',
  quests: 'redbok_quests',
  garden: 'redbok_garden',
  harvested: 'redbok_harvested',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — прогресс просто не сохранится
  }
}

const readSet = (key) => new Set(read(key, []));

function addToSet(key, value) {
  const set = readSet(key);
  if (set.has(value)) return;
  set.add(value);
  write(key, [...set]);
}

export const isIntroduced = (biomeKey) => readSet(KEYS.introduced).has(biomeKey);
export const markIntroduced = (biomeKey) => addToSet(KEYS.introduced, biomeKey);

export const getLearnedSprites = () => readSet(KEYS.learned);
export const markLearned = (sprite) => addToSet(KEYS.learned, sprite);

export const getStars = () => read(KEYS.stars, 0);
export const addStars = (n) => write(KEYS.stars, Math.max(0, getStars() + n));

export const isChestOpened = (biomeKey, i) => readSet(KEYS.chests).has(`${biomeKey}:${i}`);
export const markChestOpened = (biomeKey, i) => addToSet(KEYS.chests, `${biomeKey}:${i}`);
export const countOpenedChests = (biomeKey) => [...readSet(KEYS.chests)].filter((k) => k.startsWith(`${biomeKey}:`)).length;

export const getDefeatedBosses = () => readSet(KEYS.bosses);
export function markBossDefeated(biomeKey) {
  addToSet(KEYS.bosses, biomeKey);
  const clears = read(KEYS.clears, {});
  write(KEYS.clears, { ...clears, [biomeKey]: (clears[biomeKey] ?? 0) + 1 });
}
// Боссы, побеждённые до появления счётчика, считаются за одну зачистку.
export function getClears(biomeKey) {
  const n = read(KEYS.clears, {})[biomeKey] ?? 0;
  return Math.max(n, getDefeatedBosses().has(biomeKey) ? 1 : 0);
}

export const getOwnedItems = () => readSet(KEYS.items);
export const markItemOwned = (id) => addToSet(KEYS.items, id);
export const getWeapon = () => read(KEYS.weapon, null);
export const setWeapon = (id) => write(KEYS.weapon, id);
export const getPotions = () => read(KEYS.potions, {});
export function addPotion(id, n = 1) {
  const potions = getPotions();
  write(KEYS.potions, { ...potions, [id]: Math.max(0, (potions[id] ?? 0) + n) });
}

export const getRecord = (game) => read(KEYS.records, {})[game] ?? 0;
// true — новый рекорд.
export function submitRecord(game, value) {
  if (value <= getRecord(game)) return false;
  write(KEYS.records, { ...read(KEYS.records, {}), [game]: value });
  return true;
}

export const getOwnedHats = () => readSet(KEYS.hats);
export const markHatOwned = (id) => addToSet(KEYS.hats, id);
export const getWornHat = () => read(KEYS.hat, null);
export const setWornHat = (id) => write(KEYS.hat, id);

export const getQuestStates = () => read(KEYS.quests, {});
export function setQuestState(id, state) {
  write(KEYS.quests, { ...getQuestStates(), [id]: state });
}

export const getPlot = (i) => read(KEYS.garden, {})[i] ?? null;
export function setPlot(i, plot) {
  const garden = read(KEYS.garden, {});
  if (plot) garden[i] = plot;
  else delete garden[i];
  write(KEYS.garden, garden);
}
export const getHarvested = () => readSet(KEYS.harvested);
export const markHarvested = (cropId) => addToSet(KEYS.harvested, cropId);

export const getMastery = (sprite) => read(KEYS.mastery, {})[sprite] ?? 0;
export function markMastery(sprite) {
  if (!sprite) return;
  const m = read(KEYS.mastery, {});
  write(KEYS.mastery, { ...m, [sprite]: (m[sprite] ?? 0) + 1 });
  bumpDaily('answers');
}

export const getOwnedPets = () => readSet(KEYS.pets);
export const markPetOwned = (id) => addToSet(KEYS.pets, id);
export const getPet = () => read(KEYS.pet, null);
export const setPet = (id) => write(KEYS.pet, id);

export const getKeys = () => read(KEYS.keys, 0);
export const addKeys = (n) => write(KEYS.keys, Math.max(0, getKeys() + n));
export const hasTorch = () => read(KEYS.torch, false);
export const setTorch = () => write(KEYS.torch, true);
export const isDoorOpen = (id) => readSet(KEYS.doors).has(id);
export const markDoorOpen = (id) => addToSet(KEYS.doors, id);

// Ежедневное задание: одно в день (по дате), из DAILY_TASKS в data/daily.js.
// Счётчики событий копятся сами (bumpDaily) — сцене достаточно вызвать нужный тип.
export const getDaily = () => read(KEYS.daily, null);
export const setDaily = (daily) => write(KEYS.daily, daily);
export function bumpDaily(type, n = 1) {
  const d = getDaily();
  if (!d || d.done || d.type !== type || d.date !== new Date().toDateString()) return;
  write(KEYS.daily, { ...d, count: d.count + n });
}

export const getBag = () => read(KEYS.bag, {});
export function addToBag(item, n = 1) {
  const bag = getBag();
  write(KEYS.bag, { ...bag, [item]: Math.max(0, (bag[item] ?? 0) + n) });
}

// Для dev-панели: начать игру с чистого листа.
export function resetProgress() {
  Object.values(KEYS).forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ничего страшного
    }
  });
}
