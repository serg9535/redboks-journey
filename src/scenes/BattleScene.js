import Phaser from 'phaser';
import { ALL_ENTRIES, BIOMES, randomChoices, randomEntries } from '../data/vocab.js';
import { bossKey, getLocation } from '../data/locations.js';
import { getShowTranslation } from '../data/settings.js';
import {
  addPotion,
  addStars,
  bumpDaily,
  getClears,
  getOwnedItems,
  getPotions,
  getWeapon,
  getWornHat,
  markBossDefeated,
  markItemOwned,
  markLearned,
  markMastery,
  submitRecord,
} from '../data/progress.js';
import { POTIONS, WEAPONS, weaponEffect, weaponSprite } from '../data/items.js';
import { BOSSES, BOSS_PHASES } from '../data/bosses.js';
import { drawHat, placeHat } from '../ui/hats.js';
import { COLORS, fitSprite, hex, outlinedTextStyle, textStyle } from '../ui/theme.js';
import { Button, drawPanel, drawPips, drawSpeakerIcon } from '../ui/widgets.js';
import { canSpeak, speak } from '../ui/speech.js';

const MONSTER_HP = 3;
const ELITE_HP = 4;
const PLAYER_HP = 3;
const BOSS_PLAYER_HP = 4;
const BUBBLE = { x: 480, y: 200, r: 78 };
const PLAYER_POS = { x: 250, y: 290 };
const MONSTER_POS = { x: 700, y: 270 };
const HAND = { x: MONSTER_POS.x - 130, y: MONSTER_POS.y + 20 };
const CARD = 130;
const TIMER = { x: 450, y: 80, w: 320, h: 14 };
// Уровень сложности (tier) — по числу побед над Боссом биома (progress.clears):
// 1 — 3 слова без таймера; 2 — 4 слова + таймер; 3 — «на слух»: монстр «кричит»
// слово своего биома, выбрать картинку из трёх (+ таймер). Для Босса режима «на слух» нет.
const TIER_RULES = {
  1: { options: 3, timer: 0 },
  2: { options: 4, timer: 9000 },
  3: { options: 3, timer: 10000, ear: true },
};
const ARSENAL_TIMER = 12000; // у Босса с арсеналом таймер всегда — это полёт снаряда
const TIME_BONUS = 4000;
const STREAK_FOR_SUPER = 3;
const STREAK_FOR_SUPER_WEAPON = 2;
// Цвета для фазы Босса «какого цвета?» — слова из биома colors.
const PAINTS = { red: 0xe8553e, blue: 0x3b7ddd, green: 0x5cbf3a, yellow: 0xffd23c, purple: 0x8a4fd0, orange: 0xff8a2a };
const COLOR_ENTRIES = BIOMES.colors.words.filter((e) => e.word in PAINTS);
const TITLES = {
  word: 'Кто это? Выбери слово!',
  ear: 'Монстр кричит слово — найди!',
  color: 'Какого цвета клякса?',
  odd: 'Что здесь лишнее?',
};

// Этап Production из брифа: слово не показывается заранее — ребёнок сам
// узнаёт монстра и выбирает слово. Кнопка 🔊 у варианта даёт его услышать
// (для тех, кто ещё не читает). Правильное слово раскрывается после ответа.
//
// Раунд — один «вопрос» (type): word (слово к картинке), ear (картинка к слову),
// color (цвет кляксы), odd (лишняя картинка: три из одного биома, одна чужая).
// План раундов (this.plan): обычный монстр — word/ear по tier; элитный (data.elite,
// при повторе биома) — смесь всех; Босс — BOSS_PHASES, каждая фаза снимает ему сердечко.
// Особый Босс (data/bosses.js) ещё и стреляет из арсенала: снаряд летит, пока идёт таймер.
// Башня (data.tower = этаж) — бесконечная череда монстров со всех биомов, рекорд этажа.
//
// Вызов для тех, кто всё прошёл: серия верных ответов (registry 'streak', живёт
// между боями) → суперудар на 2 урона, оружие и зелья (см. data/items.js).
export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  init(data) {
    this.locationKey = data.biomeKey;
    this.wordEntry = data.wordEntry;
    this.defeatedSprites = data.defeatedSprites ?? [];
    this.returnTile = data.returnTile;
    this.visitedTiles = data.visitedTiles;
    this.boss = data.boss ?? false;
    this.elite = data.elite ?? false;
    this.tower = data.tower ?? 0;
    this.bossEntries = data.bossEntries ?? [];
    this.special = this.boss ? BOSSES[this.locationKey] : null;
    this.round = 0;
    this.wordIndex = 0;
    this.locked = false;

    this.tier = this.tower ? Math.min(3, 1 + Math.floor((this.tower - 1) / 3)) : Math.min(3, 1 + getClears(this.locationKey));
    const rules = TIER_RULES[this.tier];
    if (this.boss) this.plan = BOSS_PHASES;
    else if (this.elite || this.tower >= 4) this.plan = ['word', 'ear', 'odd', 'color'].slice(0, ELITE_HP);
    else this.plan = Array(MONSTER_HP).fill(rules.ear ? 'ear' : 'word');
    this.optionCount = rules.options;
    this.monsterMaxHP = this.plan.length;
    this.weapon = getWeapon();
    this.effect = weaponEffect(this.weapon);
    this.playerMaxHP = (this.boss ? BOSS_PLAYER_HP : PLAYER_HP) + (this.effect === 'heart' ? 1 : 0);
    this.monsterHP = this.monsterMaxHP;
    this.playerHP = this.playerMaxHP;
    const baseTimer = this.special ? Math.max(ARSENAL_TIMER, rules.timer) : rules.timer;
    this.timerMax = baseTimer ? baseTimer + (this.effect === 'time' ? TIME_BONUS : 0) : 0;
    this.timerLeft = 0;
    this.timerFrozen = false;
    this.shieldReady = this.effect === 'shield';
    this.removeReady = this.effect === 'remove';
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    const location = getLocation(this.locationKey);
    // «На слух»: монстр «кричит» разные слова своего биома, первое — своё собственное.
    const others = Phaser.Utils.Array.Shuffle(location.words.filter((e) => e.word !== this.wordEntry.word));
    this.earTargets = [this.wordEntry, ...others];

    const bg = this.add.image(w / 2, h / 2, location.background);
    bg.setScale(Math.max(w / bg.width, h / bg.height));
    this.add.rectangle(0, 0, w, h, COLORS.night, 0.3).setOrigin(0, 0);

    this.add.ellipse(PLAYER_POS.x, PLAYER_POS.y + 95, 170, 40, 0x000000, 0.3);
    this.add.ellipse(MONSTER_POS.x, MONSTER_POS.y + 115, 220, 50, 0x000000, 0.3);
    this.player = fitSprite(this.add.image(PLAYER_POS.x, PLAYER_POS.y, 'redbok_00'), 200);
    if (this.weapon) this.weaponImg = fitSprite(this.add.image(PLAYER_POS.x + 80, PLAYER_POS.y + 30, weaponSprite(this.weapon)), 90).setAngle(15);
    const monsterSprite = this.special && this.textures.exists(this.special.sprite) ? this.special.sprite : this.wordEntry.sprite;
    this.monster = fitSprite(this.add.image(MONSTER_POS.x, MONSTER_POS.y, monsterSprite), this.boss ? 290 : 250);
    if (this.elite || this.tower) this.monster.preFX?.addGlow(COLORS.sun, 4, 0, false, 0.1, 12);
    const wornHat = getWornHat();
    if (wornHat) this.playerHat = drawHat(this.add.graphics(), wornHat, 96);
    if (this.boss) {
      // У особого Босса своя корона (из листьев) прямо на спрайте.
      if (monsterSprite !== this.special?.sprite) this.bossCrown = drawHat(this.add.graphics(), 'crown', 120);
      this.bubble = this.add.graphics();
      this.bubble.fillStyle(COLORS.ink, 1).fillCircle(BUBBLE.x, BUBBLE.y, BUBBLE.r + 4);
      this.bubble.fillStyle(COLORS.cream, 0.95).fillCircle(BUBBLE.x, BUBBLE.y, BUBBLE.r);
      this.bubble.fillStyle(COLORS.cream, 0.95).fillCircle(BUBBLE.x + 110, BUBBLE.y + 40, 14).fillCircle(BUBBLE.x + 145, BUBBLE.y + 62, 9);
      this.summon = this.add.image(BUBBLE.x, BUBBLE.y, this.bossEntries[0].sprite);
      this.paint = this.add.graphics();
      this.bubbleMark = this.add.text(BUBBLE.x, BUBBLE.y, '?', outlinedTextStyle(72, COLORS.berry)).setOrigin(0.5).setVisible(false);
    }
    if (this.special) {
      this.bossWeapon = this.add.image(HAND.x, HAND.y, 'item_sword').setDepth(5);
      this.projectile = this.add.image(HAND.x, HAND.y, 'item_sword').setDepth(6).setVisible(false);
      this.weaponLabel = this.add.text(MONSTER_POS.x, MONSTER_POS.y - 165, '', outlinedTextStyle(26, COLORS.sun)).setOrigin(0.5).setDepth(7);
    }
    this.tweens.add({ targets: this.monster, y: MONSTER_POS.y - 8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.hp = this.add.graphics();
    this.drawHp();

    drawPanel(this.add.graphics(), w / 2 - 260, 14, 520, 50, { radius: 16 });
    this.titleText = this.add.text(w / 2 - 40, 39, '', textStyle(24)).setOrigin(0.5);
    const badge = this.tower ? `Этаж ${this.tower}` : '★'.repeat(this.tier);
    this.add.text(w / 2 + 245, 39, badge, textStyle(22, COLORS.sunShade)).setOrigin(1, 0.5);

    this.timerGfx = this.add.graphics();

    const revealX = this.boss ? BUBBLE.x : MONSTER_POS.x;
    const revealY = this.boss ? BUBBLE.y + BUBBLE.r + 34 : 418;
    this.revealWord = this.add.text(revealX, revealY, '', outlinedTextStyle(44, COLORS.sun)).setOrigin(0.5).setAlpha(0).setDepth(8);
    this.revealRu = this.add.text(revealX, revealY + 38, '', outlinedTextStyle(20)).setOrigin(0.5).setAlpha(0).setDepth(8);

    this.streakText = this.add.text(PLAYER_POS.x, PLAYER_POS.y - 130, '', outlinedTextStyle(24, COLORS.sun)).setOrigin(0.5);
    this.refreshStreak();

    // Оба набора вариантов создаются сразу, раунд показывает нужный: слова или картинки.
    const wordW = canSpeak ? 150 : 210;
    this.wordChoices = Array.from({ length: 4 }, () => this.createChoice(wordW));
    this.cardChoices = Array.from({ length: 4 }, () => this.createCard());
    this.speakerBtn = new Button(this, {
      x: w / 2,
      y: 170,
      width: 110,
      height: 60,
      variant: 'info',
      icon: (g, cx, cy, color) => drawSpeakerIcon(g, cx, cy, color, 28),
      onClick: () => speak(this.question.entry.word),
    });

    this.createPotionBar();

    this.banner = this.add.text(w / 2, h / 2 - 20, '', outlinedTextStyle(56, COLORS.sun)).setOrigin(0.5).setDepth(20).setAlpha(0);

    this.newRound();
  }

  createChoice(wordW) {
    const choice = { key: '' };
    choice.button = new Button(this, {
      x: 0,
      y: this.scale.height - 64,
      width: wordW,
      height: 60,
      fontSize: 22,
      variant: 'secondary',
      onClick: () => this.handleChoice(choice),
    });
    if (canSpeak) {
      choice.speaker = new Button(this, {
        x: 0,
        y: this.scale.height - 64,
        width: 50,
        height: 60,
        variant: 'info',
        icon: (g, cx, cy, color) => drawSpeakerIcon(g, cx, cy, color),
        onClick: () => speak(choice.key),
      });
    }
    choice.place = (x) => {
      choice.button.setX(canSpeak ? x - 30 : x);
      choice.speaker?.setX(x + wordW / 2 + 6);
    };
    choice.show = (visible) => {
      choice.button.setVisible(visible);
      choice.speaker?.setVisible(visible);
    };
    choice.set = (key) => {
      choice.key = key;
      choice.button.setLabel(key).setVariant('secondary').setEnabled(true);
      choice.speaker?.setEnabled(true);
    };
    choice.mark = (variant) => choice.button.setVariant(variant);
    choice.disable = () => {
      choice.button.setEnabled(false);
      choice.speaker?.setEnabled(false);
    };
    choice.isEnabled = () => choice.button.enabled;
    return choice;
  }

  // Карточка-картинка (режимы «на слух» и «что лишнее»): контейнер, двигается целиком.
  createCard() {
    const box = this.add.container(0, this.scale.height - CARD / 2 - 24);
    const g = this.add.graphics();
    const img = this.add.image(0, 0, 'redbok_00');
    const zone = this.add.zone(0, 0, CARD, CARD).setInteractive({ useHandCursor: true });
    box.add([g, img, zone]);
    const choice = { key: '', enabled: true };
    const draw = (fill) => {
      g.clear();
      drawPanel(g, -CARD / 2, -CARD / 2, CARD, CARD, { fill, radius: 18 });
    };
    zone.on('pointerdown', () => {
      if (!choice.enabled || !box.visible) return;
      if (this.question?.type === 'odd' && !this.locked) speak(choice.key);
      this.handleChoice(choice);
    });
    choice.place = (x) => box.setX(x);
    choice.show = (visible) => box.setVisible(visible);
    choice.setEntry = (entry) => {
      choice.key = entry.word;
      img.setTexture(entry.sprite);
      fitSprite(img, CARD - 30);
      choice.enabled = true;
      g.setAlpha(1);
      img.setAlpha(1);
      draw(COLORS.creamShade);
    };
    choice.mark = (variant) => draw(variant === 'good' ? COLORS.leaf : COLORS.berry);
    choice.disable = () => {
      choice.enabled = false;
      g.setAlpha(0.4);
      img.setAlpha(0.4);
    };
    choice.isEnabled = () => choice.enabled;
    return choice;
  }

  // Зелья (если есть) и оружие-«убиратель» — колонкой слева. Кнопка = картинка + количество.
  createPotionBar() {
    let y = 150;
    const potions = getPotions();
    POTIONS.filter((p) => (potions[p.id] ?? 0) > 0).forEach((p) => {
      const btn = this.createIconButton(56, y, p.sprite, () => this.usePotion(p, btn));
      btn.count = potions[p.id];
      btn.countText.setText(`×${btn.count}`);
      y += 84;
    });
    if (this.removeReady) {
      this.removeButton = this.createIconButton(56, y, weaponSprite(this.weapon), () => {
        if (!this.removeReady || this.locked) return;
        if (this.removeWrongOption()) {
          this.removeReady = false;
          this.removeButton.setEnabled(false);
        }
      });
    }
  }

  createIconButton(x, y, sprite, onClick) {
    const btn = new Button(this, { x, y, width: 76, height: 70, variant: 'secondary', onClick });
    btn.add(fitSprite(this.add.image(0, -2, sprite), 54));
    btn.countText = this.add.text(30, 24, '', outlinedTextStyle(16)).setOrigin(1, 1);
    btn.add(btn.countText);
    return btn;
  }

  usePotion(potion, btn) {
    if (this.locked || btn.count <= 0) return;
    if (potion.id === 'red') {
      if (this.playerHP >= this.playerMaxHP) return this.flash('Сердечки полные!');
      this.playerHP += 1;
      this.drawHp();
    } else if (potion.id === 'blue') {
      if (!this.removeWrongOption()) return;
    } else if (potion.id === 'green') {
      if (!this.timerMax || this.timerFrozen) return this.flash(this.timerMax ? 'Время уже стоит' : 'Тут нет таймера');
      this.timerFrozen = true;
      this.drawTimer();
    }
    speak(potion.word);
    addPotion(potion.id, -1);
    btn.count -= 1;
    btn.countText.setText(`×${btn.count}`);
    if (btn.count <= 0) btn.setEnabled(false);
  }

  // Убрать один неверный вариант (синее зелье, «убирающее» оружие). false — убирать нечего.
  removeWrongOption() {
    const wrong = this.activeChoices.filter((c) => c.key !== this.question.entry.word && c.isEnabled());
    if (wrong.length <= 1) return false;
    Phaser.Utils.Array.GetRandom(wrong).disable();
    return true;
  }

  drawHp() {
    this.hp.clear();
    drawPips(this.hp, PLAYER_POS.x, PLAYER_POS.y + 135, this.playerHP, this.playerMaxHP, COLORS.berry);
    // У Босса над головой корона — его сердечки под ним, а не сверху.
    drawPips(this.hp, MONSTER_POS.x, this.boss ? MONSTER_POS.y + 150 : 92, this.monsterHP, this.monsterMaxHP, COLORS.sun);
  }

  get streak() {
    return this.registry.get('streak') ?? 0;
  }

  set streak(n) {
    this.registry.set('streak', n);
    this.refreshStreak();
  }

  get superAt() {
    return this.effect === 'super' ? STREAK_FOR_SUPER_WEAPON : STREAK_FOR_SUPER;
  }

  refreshStreak() {
    const n = this.streak;
    this.streakText?.setText(n >= 2 ? `Серия ×${n}` : '').setColor(hex(n + 1 >= this.superAt ? COLORS.berry : COLORS.sun));
  }

  drawTimer() {
    const g = this.timerGfx.clear();
    if (!this.timerMax) return;
    const { x, y, w, h } = TIMER;
    const k = Phaser.Math.Clamp(this.timerLeft / this.timerMax, 0, 1);
    g.fillStyle(COLORS.ink, 1).fillRoundedRect(x - w / 2 - 3, y - 3, w + 6, h + 6, 9);
    g.fillStyle(COLORS.grey, 1).fillRoundedRect(x - w / 2, y, w, h, 7);
    const color = this.timerFrozen ? COLORS.leaf : k > 0.35 ? COLORS.sun : COLORS.berry;
    if (k > 0) g.fillStyle(color, 1).fillRoundedRect(x - w / 2, y, Math.max(h, w * k), h, 7);
  }

  update(time, delta) {
    placeHat(this.playerHat, this.player);
    if (this.bossCrown) {
      this.bossCrown.setPosition(this.monster.x, this.monster.y - this.monster.displayHeight * 0.42).setAlpha(this.monster.alpha);
    }
    if (this.timerMax && !this.locked && !this.timerFrozen) {
      this.timerLeft -= delta;
      this.drawTimer();
      if (this.timerLeft <= 0) this.onTimeout();
    }
    if (this.projectile?.visible && !this.locked) this.moveProjectile(time);
  }

  // Снаряд Босса летит от его руки к Redbok'у ровно за время таймера.
  moveProjectile(time) {
    const k = 1 - Phaser.Math.Clamp(this.timerLeft / this.timerMax, 0, 1);
    const target = { x: PLAYER_POS.x + 60, y: PLAYER_POS.y };
    const x = Phaser.Math.Linear(HAND.x, target.x, k);
    let y = Phaser.Math.Linear(HAND.y, target.y, k) - Math.sin(k * Math.PI) * 60;
    if (this.arm.wobble) y += Math.sin(time / 120) * 14;
    this.projectile.setPosition(x, y);
    if (this.arm.spin) this.projectile.angle += 6;
  }

  // ——— Раунды ———

  get questionType() {
    return this.plan[Math.min(this.round, this.plan.length - 1)];
  }

  makeQuestion(type) {
    if (type === 'word') {
      const entry = this.boss ? this.bossEntries[this.wordIndex % this.bossEntries.length] : this.wordEntry;
      return { type, entry, keys: randomChoices(entry.word, this.optionCount) };
    }
    if (type === 'ear') {
      const entry = this.earTargets[this.round % this.earTargets.length];
      return { type, entry, entries: randomEntries(entry, 3) };
    }
    if (type === 'color') {
      const entry = Phaser.Utils.Array.GetRandom(COLOR_ENTRIES);
      const others = Phaser.Utils.Array.Shuffle(COLOR_ENTRIES.filter((c) => c !== entry)).slice(0, this.optionCount - 1);
      return { type, entry, paint: PAINTS[entry.word], keys: Phaser.Utils.Array.Shuffle([entry, ...others].map((c) => c.word)) };
    }
    // odd: три картинки одного биома и одна чужая
    const home = this.boss || !this.tower ? this.locationKey : Phaser.Utils.Array.GetRandom(Object.keys(BIOMES));
    const own = Phaser.Utils.Array.Shuffle(BIOMES[home].words.filter((e, i, arr) => arr.findIndex((x) => x.word === e.word) === i)).slice(0, 3);
    const homeWords = new Set(BIOMES[home].words.map((e) => e.word));
    const entry = Phaser.Utils.Array.GetRandom(ALL_ENTRIES.filter((e) => !homeWords.has(e.word)));
    return { type: 'odd', entry, entries: Phaser.Utils.Array.Shuffle([...own, entry]) };
  }

  newRound() {
    const w = this.scale.width;
    const q = (this.question = this.makeQuestion(this.questionType));
    this.titleText.setText(TITLES[q.type]);
    const cards = q.type === 'ear' || q.type === 'odd';
    this.speakerBtn.setVisible(q.type === 'ear');

    const n = cards ? q.entries.length : q.keys.length;
    const step = cards ? CARD + 30 : n === 4 ? 232 : 306;
    this.activeChoices = cards ? this.cardChoices.slice(0, n) : this.wordChoices.slice(0, n);
    this.wordChoices.forEach((c) => c.show(false));
    this.cardChoices.forEach((c) => c.show(false));
    this.activeChoices.forEach((c, i) => {
      c.place(w / 2 + (i - (n - 1) / 2) * step);
      c.show(true);
      if (cards) c.setEntry(q.entries[i]);
      else c.set(q.keys[i]);
    });

    if (this.boss) {
      this.summon.setVisible(q.type === 'word');
      this.bubbleMark.setVisible(q.type === 'odd');
      this.paint.clear();
      if (q.type === 'word') {
        this.summon.setTexture(q.entry.sprite);
        fitSprite(this.summon, 120);
        const scale = this.summon.scale;
        this.summon.setScale(0);
        this.tweens.add({ targets: this.summon, scale, duration: 300, ease: 'Back.easeOut' });
      } else if (q.type === 'color') {
        this.drawPaint(q.paint);
        speak('What colour?');
      }
    }
    if (q.type === 'ear') this.time.delayedCall(250, () => speak(q.entry.word));
    if (this.special) this.drawWeapon();

    this.tweens.add({ targets: [this.revealWord, this.revealRu], alpha: 0, duration: 200 });
    this.timerLeft = this.timerMax;
    this.timerFrozen = false;
    this.drawTimer();
    this.locked = false;
  }

  // Клякса краски в пузыре Босса: круг + капли, с тёмной обводкой.
  drawPaint(color) {
    const g = this.paint;
    const blobs = [
      [0, 0, 44],
      [-34, -24, 18],
      [36, 20, 20],
      [28, -34, 12],
      [-30, 34, 13],
    ];
    blobs.forEach(([dx, dy, r]) => g.fillStyle(COLORS.ink, 1).fillCircle(BUBBLE.x + dx, BUBBLE.y + dy, r + 4));
    blobs.forEach(([dx, dy, r]) => g.fillStyle(color, 1).fillCircle(BUBBLE.x + dx, BUBBLE.y + dy, r));
    g.fillStyle(0xffffff, 0.4).fillCircle(BUBBLE.x - 14, BUBBLE.y - 14, 10);
  }

  // Босс с арсеналом достаёт следующее оружие и заряжает снаряд.
  drawWeapon() {
    this.arm = this.special.weapons[this.round % this.special.weapons.length];
    const icon = `item_${this.arm.id}`;
    this.bossWeapon.setTexture(this.textures.exists(icon) ? icon : 'item_sword');
    fitSprite(this.bossWeapon, 110).setFlipX(true).setAlpha(1);
    this.tweens.add({ targets: this.bossWeapon, angle: { from: -25, to: 0 }, duration: 300, ease: 'Back.easeOut' });
    const fx = this.textures.exists(this.arm.fx) ? this.arm.fx : 'item_sword';
    this.projectile.setTexture(fx).setVisible(true).setAlpha(1).setAngle(0).setPosition(HAND.x, HAND.y);
    fitSprite(this.projectile, this.arm.big ? 110 : 70).setFlipX(true);
    this.weaponLabel.setText(this.arm.word.toUpperCase()).setAlpha(1);
    this.tweens.add({ targets: this.weaponLabel, alpha: 0, delay: 1400, duration: 400 });
  }

  // Ответ успел раньше снаряда — он рассыпается в воздухе.
  breakProjectile() {
    if (!this.projectile?.visible) return;
    this.tweens.add({ targets: this.projectile, scale: this.projectile.scale * 1.8, alpha: 0, duration: 250, onComplete: () => this.projectile.setVisible(false) });
    this.flash('Отбил!', COLORS.leaf);
  }

  hitWithProjectile() {
    if (!this.projectile?.visible) return;
    this.tweens.add({
      targets: this.projectile,
      x: PLAYER_POS.x,
      y: PLAYER_POS.y,
      duration: 180,
      onComplete: () => this.projectile.setVisible(false).setAlpha(0),
    });
    if (this.arm.big) this.cameras.main.shake(300, 0.02);
  }

  handleChoice(choice) {
    if (this.locked) return;
    this.locked = true;
    if (choice.key === this.question.entry.word) this.onCorrect(choice);
    else this.onWrong(choice);
  }

  // Показ правильного слова (+ перевод, если включён) и его произношение —
  // и после верного, и после неверного ответа: ребёнок всегда видит и слышит ответ.
  reveal() {
    const { entry } = this.question;
    this.revealWord.setText(entry.word.toUpperCase());
    this.revealRu.setText(getShowTranslation() ? entry.ru ?? '' : '');
    this.tweens.add({ targets: [this.revealWord, this.revealRu], alpha: 1, duration: 200 });
    speak(entry.word);
  }

  onCorrect(choice) {
    choice.mark('good');
    this.breakProjectile();
    if (this.question.type !== 'color') markMastery(this.question.entry.sprite);
    this.streak += 1;
    const superHit = this.streak >= this.superAt;
    const damage = superHit && !this.boss ? 2 : 1;
    this.monsterHP = Math.max(0, this.monsterHP - damage);
    this.drawHp();
    this.reveal();
    if (superHit) {
      this.flash(this.boss ? 'Серия!' : 'СУПЕРУДАР!', COLORS.berry);
      this.cameras.main.shake(200, 0.01);
    }

    this.tweens.add({ targets: this.player, x: PLAYER_POS.x + 90, duration: 130, yoyo: true, ease: 'Quad.easeOut' });
    if (this.weaponImg) this.tweens.add({ targets: this.weaponImg, angle: 75, duration: 130, yoyo: true });
    this.time.delayedCall(130, () => {
      this.monster.setTintFill(0xffffff);
      this.time.delayedCall(90, () => this.monster.clearTint());
    });

    if (this.monsterHP <= 0) {
      this.setPlayerFrame('redbok_10');
      this.bossWeapon?.setAlpha(0);
      this.tweens.add({ targets: this.monster, alpha: 0, scale: this.monster.scale * 0.6, delay: 500, duration: 500 });
      this.reward = this.boss ? 5 + 2 * (this.tier - 1) : this.tier + (this.elite || this.tower ? 2 : 0);
      this.trophy = this.boss ? this.pickTrophy() : null;
      const text = this.trophy
        ? `Трофей: ${this.trophy.word.toUpperCase()}!`
        : this.boss
        ? `Босс побеждён! +${this.reward} ★`
        : `Победа! +${this.reward} ★`;
      if (this.trophy) speak(this.trophy.word);
      this.showBanner(text, COLORS.leaf, () => this.finish(true));
    } else {
      this.time.delayedCall(1300, () => {
        if (this.questionType === 'word') this.wordIndex += 1;
        this.round += 1;
        this.newRound();
      });
    }
  }

  // Особый Босс отдаёт оружие из арсенала, которого у Redbok'а ещё нет.
  pickTrophy() {
    const owned = getOwnedItems();
    const left = WEAPONS.filter((wp) => wp.trophy === this.locationKey && !owned.has(wp.id));
    return left.length ? Phaser.Utils.Array.GetRandom(left) : null;
  }

  onTimeout() {
    this.locked = true;
    this.flash(this.special ? 'Попал!' : 'Монстр успел первым!', COLORS.berry);
    this.onWrong(null);
  }

  onWrong(choice) {
    this.locked = true;
    choice?.mark('bad');
    this.activeChoices.find((c) => c.key === this.question.entry.word)?.mark('good');
    this.hitWithProjectile();
    this.streak = 0;
    this.reveal();
    if (this.shieldReady) {
      this.shieldReady = false;
      this.flash('Щит спас!', COLORS.sky);
    } else {
      this.playerHP -= 1;
      this.drawHp();
      this.setPlayerFrame('redbok_08');
      this.cameras.main.shake(150, 0.008);
    }

    if (this.playerHP <= 0) {
      this.setPlayerFrame('redbok_09');
      this.showBanner('Попробуем ещё раз!', COLORS.sky, () => this.finish(false));
    } else {
      this.time.delayedCall(1600, () => {
        this.setPlayerFrame('redbok_00');
        // Ошибка не продвигает раунд: тот же тип вопроса, но новые варианты.
        this.newRound();
      });
    }
  }

  // Короткая надпись над полем боя (суперудар, щит, зелье).
  flash(text, color = COLORS.sun) {
    // У Босса сверху пузырь с вопросом — надпись ниже, над кнопками.
    const y = this.boss ? 430 : 150;
    const t = this.add.text(this.scale.width / 2, y, text, outlinedTextStyle(34, color)).setOrigin(0.5).setDepth(15);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, delay: 700, duration: 500, onComplete: () => t.destroy() });
  }

  setPlayerFrame(key) {
    this.player.setTexture(key);
    fitSprite(this.player, 200);
  }

  showBanner(text, color, onDone) {
    this.locked = true;
    this.activeChoices.forEach((c) => c.disable());
    this.banner.setText(text).setColor(hex(color)).setScale(0.6);
    this.tweens.add({ targets: this.banner, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.time.delayedCall(1700, onDone);
  }

  finish(won) {
    if (won) bumpDaily('wins');
    if (this.tower) return this.finishTower(won);
    const defeatedSprites = [...this.defeatedSprites];
    if (won && this.boss) {
      defeatedSprites.push(bossKey(this.locationKey));
      markBossDefeated(this.locationKey);
      addStars(this.reward);
      if (this.trophy) markItemOwned(this.trophy.id);
    } else if (won) {
      defeatedSprites.push(this.wordEntry.sprite);
      markLearned(this.wordEntry.sprite);
      addStars(this.reward);
    }
    this.scene.start('World', {
      biomeKey: this.locationKey,
      defeatedSprites,
      retreat: !won,
      // Победа — продолжаем с того же места; поражение — мягкий откат на
      // чекпоинт карты. Исследованный туман не теряется в обоих случаях.
      playerTile: won ? this.returnTile : undefined,
      visitedTiles: this.visitedTiles,
    });
  }

  // Башня: победа — следующий этаж (новый монстр, сложнее), поражение — домой на Арену с рекордом.
  finishTower(won) {
    if (won) {
      addStars(this.reward);
      submitRecord('tower', this.tower);
      this.scene.start('Battle', towerFloor(this.tower + 1));
      return;
    }
    const record = submitRecord('tower', this.tower - 1);
    this.scene.start('World', { biomeKey: 'arena', toast: `Башня: этаж ${this.tower}${record ? ' — новый рекорд!' : ''}` });
  }
}

// Данные боя для этажа Башни: случайный монстр любого биома (фон — его биом).
export function towerFloor(floor) {
  const biomeKey = Phaser.Utils.Array.GetRandom(Object.keys(BIOMES));
  return { biomeKey, wordEntry: Phaser.Utils.Array.GetRandom(BIOMES[biomeKey].words), tower: floor };
}
