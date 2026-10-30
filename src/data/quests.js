// Задания жителей (по мотивам Animal Crossing): у NPC цепочка заданий, берётся
// по одному. Над NPC — «!» (есть новое задание) или «✓» (можно сдать).
// Тексты — как реплики в npcs.js: английские слова ЗАГЛАВНЫМИ, они озвучиваются.
//
// goal.type:
// - learn   — победить монстра со спрайтом goal.sprite (хотя бы раз, см. progress.learned);
// - boss    — победить Босса биома goal.biome;
// - chest   — открыть сундук в биоме goal.biome;
// - collect — собрать в Словарик goal.count слов;
// - biome   — собрать в Словарик все слова биома goal.biome;
// - fetch   — принести goal.count предметов goal.item (сорвать на карте, progress.bag); при сдаче забираются.
import { BIOMES } from './vocab.js';
import { addToBag, countOpenedChests, getBag, getDefeatedBosses, getLearnedSprites, getQuestStates, setQuestState } from './progress.js';

export const QUESTS = {
  elder: [
    { id: 'elder_bee', goal: { type: 'learn', sprite: 'forest_05' }, reward: 3, ask: 'В лесу шалит BEE (пчела). Найди её и победи!', done: 'Спасибо! Теперь BEE (пчела) не шалит.' },
    { id: 'elder_desert', goal: { type: 'boss', biome: 'desert' }, reward: 5, ask: 'В пустыне живёт Босс. Победи его — и SUN (солнце) станет добрее!', done: 'Ты победил Босса пустыни! Настоящий герой!' },
    { id: 'elder_robots', goal: { type: 'boss', biome: 'robots' }, reward: 5, ask: 'Последняя просьба: победи Босса техно-планеты, там главный ROBOT (робот).', done: 'Невероятно! Даже ROBOT (робот) теперь наш друг.' },
  ],
  teacher: [
    { id: 'teacher_chest', goal: { type: 'chest', biome: 'cave' }, reward: 3, ask: 'В пещере спрятан сундук. Найди его рядом с CRYSTAL (кристалл)!', done: 'Нашёл сундук? Умница!' },
    { id: 'teacher_10', goal: { type: 'collect', count: 10 }, reward: 5, ask: 'Собери в Словарик 10 слов — открывай его кнопкой «Словарик».', done: 'Целых 10 слов! Ты отлично учишься.' },
    { id: 'teacher_20', goal: { type: 'collect', count: 20 }, reward: 8, ask: 'А теперь — 20 слов в Словарике. Справишься?', done: '20 слов! Скоро будешь говорить по-английски!' },
    { id: 'teacher_home', goal: { type: 'biome', biome: 'home' }, reward: 5, ask: 'Дома тоже много слов! Узнай их все: BALL (мяч), CUP (чашка), BED (кровать)...', done: 'Отлично! Теперь ты можешь назвать всё у себя дома.' },
  ],
  bee: [
    { id: 'bee_forest', goal: { type: 'boss', biome: 'forest' }, reward: 5, ask: 'Жжж! В лесу появился Босс — он пугает каждый FLOWER (цветок). Победи его!', done: 'Жжж! Цветы снова спокойны. Спасибо!' },
    { id: 'bee_food', goal: { type: 'biome', biome: 'food' }, reward: 5, ask: 'Я люблю сладкое! Узнай всю еду на кухне: APPLE (яблоко), CAKE (торт) и других.', done: 'Ммм, как вкусно звучит! Спасибо!' },
    { id: 'bee_flowers', goal: { type: 'fetch', item: 'flower_red', count: 3 }, reward: 4, ask: 'Принеси мне THREE RED FLOWERS (три красных цветка) — они растут тут, на поляне!', done: 'THREE RED FLOWERS! Какие красивые, спасибо!' },
  ],
  butterfly: [
    { id: 'butterfly_colors', goal: { type: 'biome', biome: 'colors' }, reward: 5, ask: 'Мои крылья разноцветные! Выучи все цвета в Радуге: RED (красный), BLUE (синий)...', done: 'Теперь ты знаешь все цвета моих крыльев!' },
    { id: 'butterfly_ocean', goal: { type: 'biome', biome: 'ocean' }, reward: 5, ask: 'Я никогда не была в океане. Узнай всех: FISH (рыба), CRAB (краб) и других!', done: 'Ты знаешь всех жителей океана! Расскажешь мне?' },
    { id: 'butterfly_flowers', goal: { type: 'fetch', item: 'flower_blue', count: 2 }, reward: 3, ask: 'Найди TWO BLUE FLOWERS (два синих цветка) на поляне!', done: 'TWO BLUE FLOWERS — как мои крылышки!' },
  ],
  rabbit: [
    { id: 'rabbit_farm', goal: { type: 'boss', biome: 'farm' }, reward: 5, ask: 'На ферме шумит Босс — даже COW (корова) и PIG (свинья) не спят! Победи его.', done: 'На ферме снова тихо. Спасибо, друг!' },
    { id: 'rabbit_winter', goal: { type: 'boss', biome: 'winter' }, reward: 5, ask: 'Зимой холодно! Победи Босса зимы — там живёт SNOWMAN (снеговик).', done: 'Ура, теперь зимой можно играть в снежки!' },
    { id: 'rabbit_crab', goal: { type: 'learn', sprite: 'ocean_01' }, reward: 3, ask: 'CRAB (краб) ущипнул меня за ухо! Победи его, пожалуйста.', done: 'Ура! Теперь CRAB (краб) будет вежливым.' },
    { id: 'rabbit_flowers', goal: { type: 'fetch', item: 'flower_yellow', count: 4 }, reward: 5, ask: 'Собери FOUR YELLOW FLOWERS (четыре жёлтых цветка) — сделаю венок!', done: 'FOUR YELLOW FLOWERS! Венок готов!' },
  ],
};

export function isGoalMet(goal) {
  const learned = getLearnedSprites();
  switch (goal.type) {
    case 'learn':
      return learned.has(goal.sprite);
    case 'boss':
      return getDefeatedBosses().has(goal.biome);
    case 'chest':
      return countOpenedChests(goal.biome) > 0;
    case 'collect':
      return learned.size >= goal.count;
    case 'biome':
      return BIOMES[goal.biome]?.words.every((w) => learned.has(w.sprite)) ?? false;
    case 'fetch':
      return (getBag()[goal.item] ?? 0) >= goal.count;
    default:
      return false;
  }
}

// Текущее задание NPC: первое не сданное в его цепочке (или null — всё сделано).
export function currentQuest(npcId) {
  const states = getQuestStates();
  const quest = (QUESTS[npcId] ?? []).find((q) => states[q.id] !== 'done');
  if (!quest) return null;
  const state = states[quest.id] ?? 'new';
  return { quest, state, ready: state === 'active' && isGoalMet(quest.goal) };
}

// Маркер над NPC: '!' — есть новое задание, '✓' — можно сдать, null — ничего.
export function questMarker(npcId) {
  const cur = currentQuest(npcId);
  if (!cur) return null;
  if (cur.state === 'new') return '!';
  return cur.ready ? '✓' : null;
}

// Разговор с NPC продвигает задание: выдаёт новое, сдаёт выполненное или
// напоминает. Возвращает {lines, reward} — что дописать к репликам и сколько звёзд дать.
export function talkQuest(npcId) {
  const cur = currentQuest(npcId);
  if (!cur) return { lines: [], reward: 0 };
  const { quest, state, ready } = cur;
  if (state === 'new') {
    setQuestState(quest.id, 'active');
    return { lines: [`Задание: ${quest.ask} Награда: ★${quest.reward}`], reward: 0 };
  }
  if (ready) {
    setQuestState(quest.id, 'done');
    if (quest.goal.type === 'fetch') addToBag(quest.goal.item, -quest.goal.count);
    return { lines: [`${quest.done} Держи награду: ★${quest.reward}!`], reward: quest.reward };
  }
  return { lines: [`Помнишь задание? ${quest.ask}`], reward: 0 };
}
