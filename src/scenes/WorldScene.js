import Phaser from 'phaser';
import { TILE_SIZE, isWalkable, mapPixelSize } from '../data/maps.js';
import { ALL_LOCATION_KEYS, BATTLE_KEYS, bossKey, getLocation } from '../data/locations.js';
import { getShowTranslation, setShowTranslation } from '../data/settings.js';
import {
  addKeys,
  addStars,
  addToBag,
  getBag,
  getClears,
  getDefeatedBosses,
  getKeys,
  getPet,
  getPlot,
  getStars,
  getWornHat,
  hasTorch,
  isChestOpened,
  isDoorOpen,
  isIntroduced,
  markDoorOpen,
  resetProgress,
} from '../data/progress.js';
import { PETS } from '../data/items.js';
import { BOSSES } from '../data/bosses.js';
import { dailyReady, talkDaily } from '../data/daily.js';
import { RIPE_STAGE, cropSprite } from '../data/garden.js';
import { questMarker, talkQuest } from '../data/quests.js';
import { rescuedNpcs } from '../data/npcs.js';
import { drawHat, placeHat } from '../ui/hats.js';
import { COLORS, fitSprite, hex, outlinedTextStyle, textStyle } from '../ui/theme.js';
import { Button, drawPanel } from '../ui/widgets.js';
import { DialogueBox } from '../ui/DialogueBox.js';
import { towerFloor } from './BattleScene.js';
import { speak } from '../ui/speech.js';
import { FogOfWar } from '../world/FogOfWar.js';
import { TouchControls } from '../world/TouchControls.js';
import { findPath } from '../world/pathfinding.js';
import { addShadow, drawBackground, drawWalls } from '../world/renderMap.js';

const MOVE_DURATION = 160;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.2;
const TAP_MAX_DISTANCE = 14; // px сдвига пальца, чтобы всё ещё считать тапом, а не свайпом
const HUD_H = 64;
const DPAD_RESERVE = 200;
const CHARACTER_SIZE = 58;
const BOSS_SIZE = 78;
const PLAYER_SIZE = 62;
const WALK_FRAMES = ['redbok_00', 'redbok_01', 'redbok_02', 'redbok_03'];
// Вида «в профиль» нет — только анфас и вид со спины (при движении вверх, чтобы герой
// не шёл лицом к камере, удаляясь от неё): кадр стоя + цикл ходьбы.
const BACK_FRAME = 'redbok_back_00';
const BACK_WALK_FRAMES = ['redbok_back_walk_00', 'redbok_back_walk_01', 'redbok_back_walk_02', 'redbok_back_walk_03'];

const SHOW_DEV = import.meta.env.DEV || new URLSearchParams(window.location.search).has('dev');

export class WorldScene extends Phaser.Scene {
  constructor() {
    super('World');
  }

  init(data) {
    this.locationKey = data.biomeKey ?? 'forest';
    this.defeatedSprites = data.defeatedSprites ?? [];
    this.retreat = data.retreat ?? false;
    this.incomingPlayerTile = data.playerTile ?? null;
    this.incomingVisitedTiles = data.visitedTiles ?? [];
    this.incomingToast = data.toast ?? null;
    // Phaser переиспользует инстанс сцены между scene.start() — всё состояние
    // сбрасываем здесь, иначе оно «протекает» из прошлого захода.
    this.modalOpen = false;
    this.modalObjects = [];
    this.facingBack = false;
    this.isMoving = false;
    this.pendingPath = [];
    this.pinchStartDist = null;
    this.tapPointerStart = null;
  }

  create() {
    this.location = getLocation(this.locationKey);
    const { map, palette } = this.location;
    // Копия раскладки: открытые двери превращаются в пол только в этой сцене.
    this.doors = (map.doors ?? []).filter((d) => !isDoorOpen(d.id));
    this.layout = map.layout.map((row, r) =>
      [...row].map((ch, c) => ((map.doors ?? []).some((d) => d.col === c && d.row === r && isDoorOpen(d.id)) ? '.' : ch)).join('')
    );
    const { width: mapW, height: mapH } = mapPixelSize(this.layout);

    // Мир и UI — на разных камерах: зум/панорама карты не трогают HUD и D-pad.
    this.worldLayer = this.add.layer();
    this.uiLayer = this.add.layer();

    drawBackground(this, this.worldLayer, this.location.background, mapW, mapH);
    this.walls = drawWalls(this, this.worldLayer, this.layout, palette);

    // При повторе пройденного биома каждый третий монстр — элитный (светится, сильнее).
    const replay = !this.location.peaceful && getClears(this.locationKey) > 0;
    this.monsters = this.location.words
      .map((entry, i) => ({ entry, tile: map.monsterTiles[i % map.monsterTiles.length], elite: replay && i % 3 === 1 }))
      .filter(({ entry }) => !this.defeatedSprites.includes(entry.sprite))
      .map(({ entry, tile, elite }) => {
        const placed = this.placeCharacter(entry.sprite, tile);
        if (elite) placed.image.preFX?.addGlow(COLORS.sun, 3, 0, false, 0.1, 10);
        return { ...placed, entry, elite };
      });

    this.npcs = (map.npcTiles ?? []).map((tile, i) => ({ ...this.placeCharacter(map.npcs[i % map.npcs.length].sprite, tile), npc: map.npcs[i % map.npcs.length] }));
    // Спасённые жители биомов (после победы над Боссом) — на отдельных клетках деревни.
    const rescued = map.rescueTiles ? rescuedNpcs(getDefeatedBosses()).slice(0, map.rescueTiles.length) : [];
    rescued.forEach((npc, i) => this.npcs.push({ ...this.placeCharacter(npc.sprite, map.rescueTiles[i]), npc }));
    this.questMarkers = this.npcs.map((n) => this.createQuestMarker(n));
    this.refreshQuestMarkers();

    this.chests = (map.chestTiles ?? [])
      .map((tile, index) => ({ tile, index }))
      .filter(({ index }) => !isChestOpened(this.locationKey, index))
      .map((chest) => ({ ...chest, gfx: this.drawChest(chest.tile) }));
    this.boss = null;

    this.plots = (map.plotTiles ?? []).map((tile, index) => this.createPlot(tile, index));
    this.doorGfx = this.doors.map((door) => this.drawDoor(door));
    this.pickables = (map.pickTiles ?? []).map((t) => ({ tile: t, item: t.item, gfx: this.drawFlower(t) }));
    this.treasures = (map.treasureTiles ?? []).filter((t) => !isDoorOpen(t.id)).map((t) => ({ ...t, tile: t, gfx: this.drawChest(t) }));
    this.stations = (map.stationTiles ?? []).map((station) => this.createStation(station));

    this.portals = map.portals ?? [];
    this.portals.forEach((portal) => this.drawPortal(portal));

    const startTile = this.incomingPlayerTile ?? map.playerStart;
    this.playerTile = { col: startTile.col, row: startTile.row };
    const { x: px, y: py } = this.tileCenter(this.playerTile);
    this.playerShadow = addShadow(this, this.worldLayer, px, py + 20, 38);
    this.player = fitSprite(this.add.image(px, py, 'redbok_00'), PLAYER_SIZE).setDepth(3);
    this.worldLayer.add(this.player);
    this.refreshHat();
    this.createPet();

    // В мирных локациях тумана нет: там нечего «исследовать», только поговорить.
    if (!this.location.peaceful) {
      const radius = this.location.dark ? (hasTorch() ? 3 : 1) : undefined;
      this.fog = new FogOfWar(this, this.worldLayer, this.layout, this.incomingVisitedTiles, radius);
      if (this.location.dark && !hasTorch()) this.time.delayedCall(600, () => this.showToast('Темно! TORCH (факел) есть у Пузыря'));
      this.fog.reveal(this.playerTile.col, this.playerTile.row, true);
    }

    this.setupCameras(mapW, mapH);
    this.createHud();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.touch = new TouchControls(this, this.uiLayer, {
      x: 96,
      y: this.scale.height - 120,
      onPress: (dCol, dRow) => {
        this.pendingPath = [];
        if (!this.isMoving) this.attemptMove(dCol, dRow);
      },
    });
    this.setupPointerControls();

    if (this.retreat) this.showToast('Redbok отдохнул и снова готов!');
    if (this.incomingToast) this.showToast(this.incomingToast);
    if (this.locationKey === 'village' && dailyReady()) this.time.delayedCall(800, () => this.showToast('Задание дня готово — загляни к Старейшине!'));

    // Оверлеи (сундук, магазин, тренировка, словарик) меняют звёзды/шапку/задания.
    // Сцена переиспользуется между scene.start() — подписку снимаем на shutdown, иначе копится.
    const onResume = () => {
      this.updateProgress();
      this.refreshHat();
      this.refreshQuestMarkers();
      this.plots.forEach((plot) => this.refreshPlot(plot));
      this.chests = this.chests.filter((chest) => {
        if (!isChestOpened(this.locationKey, chest.index)) return true;
        chest.gfx.destroy();
        return false;
      });
    };
    this.events.on('resume', onResume);
    this.events.once('shutdown', () => this.events.off('resume', onResume));

    const words = this.location.words;
    const allDefeated = words.length > 0 && words.every((w) => this.defeatedSprites.includes(w.sprite));
    if (allDefeated && this.defeatedSprites.includes(bossKey(this.locationKey))) {
      this.showLocationComplete();
    } else if (allDefeated) {
      this.spawnBoss();
    } else if (!this.location.peaceful && !isIntroduced(this.locationKey)) {
      // Первый заход в биом — сначала знакомство со словами и тренировка, потом бои.
      this.openOverlay('Presentation', { biomeKey: this.locationKey });
    }
  }

  tileCenter({ col, row }) {
    return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
  }

  placeCharacter(textureKey, tile) {
    const { x, y } = this.tileCenter(tile);
    addShadow(this, this.worldLayer, x, y + 19);
    const image = fitSprite(this.add.image(x, y, textureKey), CHARACTER_SIZE).setDepth(2);
    this.worldLayer.add(image);
    // Лёгкое «дыхание» с разной фазой, чтобы персонажи не стояли статуэтками.
    this.tweens.add({
      targets: image,
      y: y - 4,
      duration: 650 + Math.random() * 300,
      delay: Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return { image, tile };
  }

  // Сундук — графикой (крышка, оковка, замок), как и шапки: отдельный спрайт не нужен.
  drawChest(tile) {
    const { x, y } = this.tileCenter(tile);
    const g = this.add.graphics({ x, y }).setDepth(2);
    const ink = COLORS.ink;
    g.fillStyle(0x000000, 0.28).fillEllipse(0, 17, 36, 10);
    g.fillStyle(ink, 1).fillRoundedRect(-17, -14, 34, 30, 5);
    g.fillStyle(0x9a5b2c, 1).fillRoundedRect(-15, -12, 30, 26, 4);
    g.fillStyle(0xc27a3d, 1).fillRoundedRect(-15, -12, 30, 10, { tl: 4, tr: 4, bl: 0, br: 0 });
    g.fillStyle(ink, 1).fillRect(-15, -2, 30, 2);
    g.fillStyle(COLORS.sun, 1).fillRect(-11, -12, 4, 26).fillRect(7, -12, 4, 26);
    g.fillStyle(ink, 1).fillRect(-4, -5, 8, 9);
    g.fillStyle(COLORS.sun, 1).fillRect(-2, -3, 4, 5);
    this.tweens.add({ targets: g, scale: 1.07, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.worldLayer.add(g);
    return g;
  }

  // Грядка огорода — графикой (рыхлая земля с бороздами), растение на ней — спрайт по стадии.
  createPlot(tile, index) {
    const { x, y } = this.tileCenter(tile);
    const g = this.add.graphics({ x, y }).setDepth(1.5);
    const s = TILE_SIZE / 2 - 3;
    g.fillStyle(COLORS.ink, 1).fillRoundedRect(-s - 2, -s - 2, 2 * s + 4, 2 * s + 4, 9);
    g.fillStyle(0x6b4423, 1).fillRoundedRect(-s, -s, 2 * s, 2 * s, 8);
    g.fillStyle(0x553319, 1);
    for (let i = -1; i <= 1; i++) g.fillRoundedRect(-s + 6, i * (s / 2) - 2, 2 * s - 12, 5, 2);
    const plant = this.add.image(x, y - 6, 'garden_seedling').setDepth(2).setVisible(false);
    const sparkle = this.add.text(x + s - 4, y - s - 2, '★', outlinedTextStyle(20, COLORS.sun)).setOrigin(0.5).setDepth(4).setVisible(false);
    this.tweens.add({ targets: sparkle, scale: 1.3, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.worldLayer.add([g, plant, sparkle]);
    const plot = { tile, index, plant, sparkle };
    this.refreshPlot(plot);
    return plot;
  }

  // Станция мини-игры на Арене: подставка с иконкой и подписью.
  createStation(station) {
    const { x, y } = this.tileCenter(station);
    const g = this.add.graphics({ x, y }).setDepth(1.5);
    const s = TILE_SIZE / 2 - 2;
    g.fillStyle(COLORS.ink, 1).fillRoundedRect(-s - 2, -s - 2, 2 * s + 4, 2 * s + 4, 10);
    g.fillStyle(COLORS.sun, 1).fillRoundedRect(-s, -s, 2 * s, 2 * s, 9);
    g.fillStyle(0xffffff, 0.35).fillRoundedRect(-s + 4, -s + 3, 2 * s - 8, 6, 3);
    const icon = fitSprite(this.add.image(x, y - 2, station.icon), TILE_SIZE - 10).setDepth(2);
    const label = this.add.text(x, y - TILE_SIZE / 2 - 4, station.label, outlinedTextStyle(13)).setOrigin(0.5, 1).setDepth(4);
    this.tweens.add({ targets: icon, scale: icon.scale * 1.1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.worldLayer.add([g, icon, label]);
    return { tile: station, scene: station.scene };
  }

  // Дверь кладовой: деревянная створка с замком поверх стены.
  drawDoor(door) {
    const { x, y } = this.tileCenter(door);
    const g = this.add.graphics({ x, y }).setDepth(1.6);
    g.fillStyle(COLORS.ink, 1).fillRoundedRect(-18, -22, 36, 44, { tl: 14, tr: 14, bl: 2, br: 2 });
    g.fillStyle(0x9a5b2c, 1).fillRoundedRect(-15, -19, 30, 39, { tl: 12, tr: 12, bl: 1, br: 1 });
    g.fillStyle(0x7a4520, 1).fillRect(-1, -17, 2, 36);
    g.fillStyle(COLORS.sun, 1).fillRoundedRect(4, -2, 8, 10, 2);
    g.fillStyle(COLORS.ink, 1).fillRect(7, 1, 2, 4);
    this.worldLayer.add(g);
    return g;
  }

  tryDoor(door) {
    if (getKeys() <= 0) {
      this.showToast('Заперто! Нужен KEY (ключ) — он есть у Пузыря');
      return;
    }
    addKeys(-1);
    markDoorOpen(door.id);
    const i = this.doors.indexOf(door);
    this.doors.splice(i, 1);
    const [g] = this.doorGfx.splice(i, 1);
    this.tweens.add({ targets: g, scaleX: 0.1, alpha: 0, duration: 400, onComplete: () => g.destroy() });
    this.layout = this.layout.map((row, r) => (r === door.row ? row.slice(0, door.col) + '.' + row.slice(door.col + 1) : row));
    this.walls?.destroy();
    this.walls = drawWalls(this, this.worldLayer, this.layout, this.location.palette);
    speak('key');
    this.showToast('Дверь открыта ключом! Что там внутри?');
  }

  takeTreasure(treasure) {
    markDoorOpen(treasure.id);
    addStars(treasure.stars);
    this.treasures = this.treasures.filter((t) => t !== treasure);
    treasure.gfx.destroy();
    this.updateProgress();
    this.showToast(`Клад! +${treasure.stars} ★`);
  }

  // Цветок для поручения: стебель + лепестки цвета из item (flower_red/blue/yellow).
  drawFlower(tile) {
    const { x, y } = this.tileCenter(tile);
    const color = { flower_red: COLORS.berry, flower_blue: COLORS.sky, flower_yellow: COLORS.sun }[tile.item] ?? COLORS.sun;
    const g = this.add.graphics({ x, y }).setDepth(1.8);
    g.fillStyle(COLORS.ink, 1).fillRect(-3, -2, 6, 18);
    g.fillStyle(COLORS.leaf, 1).fillRect(-1.5, -1, 3, 16);
    [[0, -12], [-9, -5], [9, -5], [-5, 4], [5, 4]].forEach(([dx, dy]) => g.fillStyle(COLORS.ink, 1).fillCircle(dx, dy - 4, 8));
    [[0, -12], [-9, -5], [9, -5], [-5, 4], [5, 4]].forEach(([dx, dy]) => g.fillStyle(color, 1).fillCircle(dx, dy - 4, 6));
    g.fillStyle(COLORS.cream, 1).fillCircle(0, -6, 4);
    this.tweens.add({ targets: g, angle: { from: -6, to: 6 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.worldLayer.add(g);
    return g;
  }

  // Сорвать цветок: он пропадает до следующего захода, Redbok при этом шагает на клетку.
  pickUp(pick) {
    addToBag(pick.item);
    this.pickables = this.pickables.filter((p) => p !== pick);
    this.tweens.add({ targets: pick.gfx, y: pick.gfx.y - 30, alpha: 0, duration: 300, onComplete: () => pick.gfx.destroy() });
    const word = pick.item.replace('flower_', '') + ' flower';
    speak(word);
    this.showToast(`${word.toUpperCase()}! Всего: ${getBag()[pick.item]}`);
    this.refreshQuestMarkers();
  }

  // Питомец идёт на клетку, где только что стоял Redbok.
  createPet() {
    const pet = PETS.find((p) => p.id === getPet());
    if (!pet || !this.textures.exists(pet.sprite)) return;
    const { x, y } = this.tileCenter(this.playerTile);
    this.pet = fitSprite(this.add.image(x - 20, y + 8, pet.sprite), 40).setDepth(2.9);
    this.worldLayer.add(this.pet);
  }

  movePet(tile) {
    if (!this.pet) return;
    const { x, y } = this.tileCenter(tile);
    this.pet.setFlipX(x > this.pet.x);
    this.tweens.add({ targets: this.pet, x, y: y + 8, duration: MOVE_DURATION + 60 });
  }

  refreshPlot(plot) {
    const state = getPlot(plot.index);
    plot.plant.setVisible(!!state);
    plot.sparkle.setVisible(state?.stage === RIPE_STAGE);
    if (!state) return;
    plot.plant.setTexture(cropSprite(state.crop, state.stage));
    fitSprite(plot.plant, state.stage === 0 ? 30 : 46);
  }

  // Все монстры биома побеждены — появляется Босс (крупнее, в короне) на месте последнего.
  spawnBoss() {
    const tiles = this.location.map.monsterTiles;
    const tile = tiles[(this.location.words.length - 1) % tiles.length];
    const special = BOSSES[this.locationKey];
    const sprite = special && this.textures.exists(special.sprite) ? special.sprite : this.location.bossEntry.sprite;
    const { image } = this.placeCharacter(sprite, tile);
    fitSprite(image, BOSS_SIZE);
    // У особого Босса корона нарисована на самом спрайте.
    const crown = sprite === special?.sprite ? null : drawHat(this.add.graphics(), 'crown', 34).setDepth(2.5);
    if (crown) this.worldLayer.add(crown);
    this.boss = { tile, image, crown };
    this.showToast(special ? `Появился ${special.name}! Найди его ★` : 'Появился Босс! Найди его ★');
  }

  createQuestMarker({ image }) {
    const text = this.add.text(image.x, image.y - 36, '', outlinedTextStyle(24, COLORS.sun)).setOrigin(0.5, 1).setDepth(4);
    this.worldLayer.add(text);
    this.tweens.add({ targets: text, y: text.y - 6, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return text;
  }

  refreshQuestMarkers() {
    this.npcs.forEach(({ npc }, i) => {
      const mark = questMarker(npc.id);
      this.questMarkers[i].setText(mark ?? '').setColor(hex(mark === '✓' ? COLORS.leaf : COLORS.sun));
    });
  }

  refreshHat() {
    this.hat?.destroy();
    this.hat = null;
    const id = getWornHat();
    if (!id) return;
    this.hat = drawHat(this.add.graphics(), id, 30).setDepth(3.1);
    this.worldLayer.add(this.hat);
    placeHat(this.hat, this.player);
  }

  drawPortal(portal) {
    const { x, y } = this.tileCenter(portal);
    const g = this.add.graphics({ x, y }).setDepth(1.6);
    g.fillStyle(COLORS.sun, 0.35).fillCircle(0, 0, 22);
    g.lineStyle(4, COLORS.sun, 1).strokeCircle(0, 0, 18);
    g.lineStyle(3, COLORS.cream, 0.9).strokeCircle(0, 0, 10);
    this.tweens.add({ targets: g, scale: 1.15, alpha: 0.7, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const label = this.add.text(x, y - 30, getLocation(portal.to).label, outlinedTextStyle(13)).setOrigin(0.5, 1).setDepth(4);
    this.worldLayer.add([g, label]);
  }

  setupCameras(mapW, mapH) {
    const cam = this.cameras.main;
    cam.setBackgroundColor(this.location.palette.edge);
    cam.ignore(this.uiLayer);

    const viewH = this.scale.height - HUD_H;
    if (mapW <= this.scale.width && mapH <= this.scale.height) {
      // Маленькая карта (деревня/поляна) целиком влезает — показываем её
      // всю, без слежения за игроком: под HUD и правее D-pad'а, чтобы он
      // не закрывал клетки (портал деревни стоит как раз в левом нижнем углу).
      const viewW = this.scale.width - DPAD_RESERVE;
      const zoom = Math.min(viewW / mapW, viewH / mapH, MAX_ZOOM);
      cam.setZoom(zoom);
      cam.centerOn(mapW / 2 - DPAD_RESERVE / 2 / zoom, mapH / 2 - HUD_H / 2 / zoom);
      this.fixedCamera = true;
    } else {
      cam.setBounds(0, -HUD_H, mapW, mapH + HUD_H);
      cam.startFollow(this.player, true, 0.15, 0.15);
      this.fixedCamera = false;
    }

    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.ignore(this.worldLayer);
  }

  createHud() {
    const w = this.scale.width;
    const panelW = 400;
    this.uiLayer.add(drawPanel(this.add.graphics().setDepth(10), 12, 10, panelW, 46, { radius: 14 }));
    this.uiLayer.add(this.add.text(28, 33, this.location.label, textStyle(20)).setOrigin(0, 0.5).setDepth(11));
    this.progressText = this.add.text(310, 33, '', textStyle(18, COLORS.leafShade)).setOrigin(1, 0.5).setDepth(11);
    this.starsText = this.add.text(12 + panelW - 14, 33, '', textStyle(20, COLORS.sunShade)).setOrigin(1, 0.5).setDepth(11);
    this.uiLayer.add([this.progressText, this.starsText]);
    this.updateProgress();

    this.translationEnabled = getShowTranslation();
    const ruBtn = new Button(this, {
      x: w - 214,
      y: 33,
      width: 84,
      height: 42,
      label: 'RU',
      fontSize: 18,
      variant: this.translationEnabled ? 'good' : 'muted',
      onClick: () => {
        this.translationEnabled = !this.translationEnabled;
        setShowTranslation(this.translationEnabled);
        ruBtn.setVariant(this.translationEnabled ? 'good' : 'muted');
        this.showToast(this.translationEnabled ? 'Перевод в бою: показывать' : 'Перевод в бою: скрыть');
      },
    }).setDepth(11);

    const homeLabel = this.locationKey === 'village' ? 'В лес' : this.location.peaceful ? 'В деревню' : 'Деревня';
    const homeBtn = new Button(this, {
      x: w - 82,
      y: 33,
      width: 150,
      height: 42,
      label: homeLabel,
      fontSize: 18,
      variant: 'primary',
      onClick: () => {
        // деревня → лес; другая мирная локация → деревня; бой → деревня
        const target = this.locationKey === 'village' ? 'forest' : 'village';
        this.scene.start('World', { biomeKey: target, defeatedSprites: [...this.defeatedSprites] });
      },
    }).setDepth(11);
    const bookBtn = new Button(this, {
      x: w - 330,
      y: 33,
      width: 130,
      height: 42,
      label: 'Словарик',
      fontSize: 18,
      variant: 'info',
      onClick: () => this.openOverlay('Collection'),
    }).setDepth(11);
    const bagBtn = new Button(this, {
      x: w - 82,
      y: 84,
      width: 150,
      height: 42,
      label: 'Рюкзак',
      fontSize: 18,
      variant: 'secondary',
      onClick: () => this.openOverlay('Inventory'),
    }).setDepth(11);
    this.uiLayer.add([ruBtn, homeBtn, bookBtn, bagBtn]);

    // В боевом биоме знакомство со словами можно повторить в любой момент.
    if (!this.location.peaceful) {
      const learnBtn = new Button(this, {
        x: w - 470,
        y: 33,
        width: 130,
        height: 42,
        label: 'Учить',
        fontSize: 18,
        variant: 'good',
        onClick: () => this.openOverlay('Presentation', { biomeKey: this.locationKey }),
      }).setDepth(11);
      this.uiLayer.add(learnBtn);
    }

    if (SHOW_DEV) {
      const devBtn = new Button(this, { x: 62, y: 84, width: 100, height: 34, label: 'Dev', fontSize: 15, variant: 'muted', onClick: () => this.openDevPanel() }).setDepth(11);
      const starBtn = new Button(this, {
        x: 172,
        y: 84,
        width: 100,
        height: 34,
        label: '+20 ★',
        fontSize: 15,
        variant: 'muted',
        onClick: () => {
          addStars(20);
          this.updateProgress();
        },
      }).setDepth(11);
      const resetBtn = new Button(this, {
        x: 282,
        y: 84,
        width: 100,
        height: 34,
        label: 'Сброс',
        fontSize: 15,
        variant: 'muted',
        onClick: () => {
          resetProgress();
          this.scene.start('World', { biomeKey: 'village' });
        },
      }).setDepth(11);
      this.uiLayer.add([devBtn, starBtn, resetBtn]);
    }

    const hint = this.stations.length
      ? 'Выбери игру — подойди к жёлтой подставке!'
      : this.plots.length
      ? 'Подойди к грядке и коснись её — посадим овощи!'
      : this.location.peaceful
      ? 'Подойди к жителю и коснись его, чтобы поговорить'
      : 'Тапни по клетке — Redbok пойдёт туда';
    const hintText = this.add.text(w / 2 + 60, this.scale.height - 16, hint, outlinedTextStyle(16)).setOrigin(0.5, 1).setDepth(11);
    this.uiLayer.add(hintText);
    this.tweens.add({ targets: hintText, alpha: 0, delay: 6000, duration: 800 });
  }

  updateProgress() {
    this.starsText.setText(`★ ${getStars()}`);
    const words = this.location.words;
    if (words.length === 0) {
      this.progressText.setText('');
      return;
    }
    const learned = words.filter((w) => this.defeatedSprites.includes(w.sprite)).length;
    this.progressText.setText(`${learned}/${words.length}`);
  }

  update() {
    this.updatePinchZoom();
    placeHat(this.hat, this.player);
    if (this.boss?.crown) placeHat(this.boss.crown, this.boss.image);
    if (this.isMoving || this.modalOpen) return;

    const just = Phaser.Input.Keyboard.JustDown;
    let dir = null;
    if (just(this.cursors.left) || just(this.wasd.A)) dir = [-1, 0];
    else if (just(this.cursors.right) || just(this.wasd.D)) dir = [1, 0];
    else if (just(this.cursors.up) || just(this.wasd.W)) dir = [0, -1];
    else if (just(this.cursors.down) || just(this.wasd.S)) dir = [0, 1];
    else if (this.touch.direction) dir = [this.touch.direction.dCol, this.touch.direction.dRow];

    if (dir) {
      this.pendingPath = []; // ручное управление отменяет тап-путь
      this.attemptMove(dir[0], dir[1]);
    } else if (this.pendingPath.length > 0) {
      const next = this.pendingPath.shift();
      this.attemptMove(next.col - this.playerTile.col, next.row - this.playerTile.row);
    }
  }

  attemptMove(dCol, dRow) {
    if (this.modalOpen) return;
    const target = { col: this.playerTile.col + dCol, row: this.playerTile.row + dRow };
    const at = (t) => t.tile.col === target.col && t.tile.row === target.row;

    const monster = this.monsters.find(at);
    if (monster) return this.startBattle(monster);

    const door = this.doors.find((d) => d.col === target.col && d.row === target.row);
    if (door) return this.tryDoor(door);

    const treasure = this.treasures.find(at);
    if (treasure) return this.takeTreasure(treasure);

    const pick = this.pickables.find(at);
    if (pick) this.pickUp(pick);

    const npc = this.npcs.find(at);
    if (npc) return this.openDialogue(npc.npc);

    const chest = this.chests.find(at);
    if (chest) return this.openOverlay('Chest', { biomeKey: this.locationKey, index: chest.index });

    const plot = this.plots.find(at);
    if (plot) return this.openOverlay('Garden', { index: plot.index });

    const station = this.stations.find(at);
    if (station) {
      // Башня — не оверлей, а череда боёв (BattleScene с data.tower).
      if (station.scene === 'Tower') return this.scene.start('Battle', towerFloor(1));
      return this.openOverlay(station.scene);
    }

    if (this.boss && at(this.boss)) return this.startBattle({ entry: this.location.bossEntry }, true);

    const portal = this.portals.find((p) => p.col === target.col && p.row === target.row);
    if (portal) {
      this.scene.start('World', { biomeKey: portal.to, playerTile: portal.spawnAt, defeatedSprites: [...this.defeatedSprites] });
      return;
    }

    if (!isWalkable(this.layout, target.col, target.row)) return;

    this.isMoving = true;
    // исходные кадры redbok_* смотрят ВЛЕВО (лицо слева, красный бок справа) —
    // отражаем при движении вправо, иначе он идёт «красным боком вперёд»
    if (dCol !== 0) this.player.setFlipX(dCol > 0);
    if (dRow < 0) this.facingBack = true;
    else if (dRow > 0 || dCol !== 0) this.facingBack = false;
    this.playWalkAnimation();

    this.movePet(this.playerTile);
    this.playerTile = target;
    const { x, y } = this.tileCenter(target);
    this.tweens.add({ targets: this.playerShadow, x, y: y + 20, duration: MOVE_DURATION });
    this.tweens.add({
      targets: this.player,
      x,
      y,
      duration: MOVE_DURATION,
      onComplete: () => {
        this.setPlayerFrame(this.facingBack ? BACK_FRAME : 'redbok_00');
        this.isMoving = false;
      },
    });
    this.fog?.reveal(target.col, target.row);
  }

  // Кадры разного исходного размера — после смены текстуры масштаб пересчитываем.
  setPlayerFrame(key) {
    this.player.setTexture(key);
    fitSprite(this.player, PLAYER_SIZE);
  }

  playWalkAnimation() {
    this.walkTimer?.remove();
    const frames = this.facingBack ? BACK_WALK_FRAMES : WALK_FRAMES;
    let frame = 0;
    this.setPlayerFrame(frames[0]);
    this.walkTimer = this.time.addEvent({
      delay: MOVE_DURATION / frames.length,
      repeat: frames.length - 1,
      callback: () => {
        frame = (frame + 1) % frames.length;
        this.setPlayerFrame(frames[frame]);
      },
    });
  }

  handleTapMove(pointer) {
    if (this.modalOpen) return;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const to = { col: Math.floor(world.x / TILE_SIZE), row: Math.floor(world.y / TILE_SIZE) };
    // Монстры/NPC стоят на проходимых клетках — путь доводится до них, и
    // последний шаг в update() «врезается» в них, открывая бой/диалог.
    const path = findPath(this.layout, this.playerTile, to);
    if (path) this.pendingPath = path;
  }

  updatePinchZoom() {
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    if (!this.fixedCamera && p1?.isDown && p2?.isDown) {
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      if (this.pinchStartDist === null) {
        this.pinchStartDist = dist;
        this.pinchStartZoom = this.cameras.main.zoom;
      } else if (this.pinchStartDist > 0) {
        this.cameras.main.setZoom(Phaser.Math.Clamp((this.pinchStartZoom * dist) / this.pinchStartDist, MIN_ZOOM, MAX_ZOOM));
      }
    } else {
      this.pinchStartDist = null;
    }
  }

  setupPointerControls() {
    this.input.on('pointerdown', (pointer) => {
      if (this.modalOpen || this.input.hitTestPointer(pointer).length > 0) return; // тап по UI/окну
      this.tapPointerStart = { x: pointer.x, y: pointer.y };
    });
    this.input.on('pointerup', (pointer, currentlyOver) => {
      const start = this.tapPointerStart;
      this.tapPointerStart = null;
      if (!start || this.pinchStartDist !== null || currentlyOver.length > 0) return;
      if (Phaser.Math.Distance.Between(start.x, start.y, pointer.x, pointer.y) > TAP_MAX_DISTANCE) return;
      if (this.input.pointer2?.isDown) return;
      this.handleTapMove(pointer);
    });
  }

  startBattle(monster, boss = false) {
    this.pendingPath = [];
    this.scene.start('Battle', {
      biomeKey: this.locationKey,
      wordEntry: monster.entry,
      boss,
      elite: monster.elite ?? false,
      bossEntries: boss ? Phaser.Utils.Array.Shuffle([...this.location.words]).slice(0, 5) : undefined,
      defeatedSprites: [...this.defeatedSprites],
      returnTile: { ...this.playerTile },
      visitedTiles: this.fog?.visitedTiles() ?? [],
    });
  }

  // Presentation/Matching/Collection рисуются поверх мира, а сам мир стоит на
  // паузе — так состояние захода (позиция, туман, побеждённые) не теряется.
  // Оверлей сам возвращает управление через scene.resume('World').
  openOverlay(key, data = {}) {
    this.pendingPath = [];
    this.touch.reset();
    this.scene.launch(key, data);
    this.scene.pause();
  }

  openDialogue(npc) {
    this.pendingPath = [];
    this.touch.reset();
    this.modalOpen = true;
    // Задание NPC дописывается последней репликой (выдать/напомнить/сдать с наградой).
    const quest = talkQuest(npc.id);
    if (quest.reward) addStars(quest.reward);
    const extra = npc.id === 'elder' ? talkDaily() : [];
    new DialogueBox(this, this.uiLayer, { ...npc, lines: [...npc.lines, ...quest.lines, ...extra] }, () => {
      // Тап, закрывший диалог, ещё обрабатывается сценой — снимаем «модальность» на
      // следующем кадре, иначе он же становится тапом по карте и Redbok идёт к другому NPC.
      this.time.delayedCall(0, () => {
        this.modalOpen = false;
      });
      this.updateProgress();
      this.refreshQuestMarkers();
      if (npc.shop) this.openOverlay('Shop');
      else if (npc.talk) this.openOverlay('Talk', { npc });
    });
  }

  // Полноэкранное окно со списком локаций — общий каркас для «биом пройден» и dev-панели.
  openLocationPicker({ title, subtitle, keys, closable }) {
    this.modalOpen = true;
    this.touch.reset();
    const w = this.scale.width;
    const h = this.scale.height;
    const add = (obj) => {
      this.modalObjects.push(obj);
      this.uiLayer.add(obj);
      return obj;
    };

    add(this.add.rectangle(0, 0, w, h, COLORS.night, 0.75).setOrigin(0, 0).setDepth(50).setInteractive());
    const cols = keys.length > 5 ? 2 : 1;
    const rows = Math.ceil(keys.length / cols);
    const panelW = cols === 2 ? 620 : 380;
    const panelH = 120 + rows * 62 + (closable ? 64 : 0);
    const panelY = (h - panelH) / 2;
    add(drawPanel(this.add.graphics().setDepth(51), (w - panelW) / 2, panelY, panelW, panelH));
    add(this.add.text(w / 2, panelY + 34, title, textStyle(26, COLORS.berryShade, { align: 'center' })).setOrigin(0.5).setDepth(52));
    add(this.add.text(w / 2, panelY + 70, subtitle, textStyle(18)).setOrigin(0.5).setDepth(52));

    keys.forEach((key, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const isCurrent = key === this.locationKey;
      const loc = getLocation(key);
      add(
        new Button(this, {
          x: w / 2 + (cols === 2 ? (col === 0 ? -150 : 150) : 0),
          y: panelY + 120 + row * 62,
          width: 280,
          height: 46,
          label: loc.label,
          variant: isCurrent ? 'muted' : loc.peaceful ? 'info' : 'primary',
          onClick: () => this.scene.start('World', { biomeKey: key, defeatedSprites: [...this.defeatedSprites] }),
        }).setDepth(52)
      );
    });

    if (closable) {
      add(
        new Button(this, {
          x: w / 2,
          y: panelY + panelH - 42,
          width: 160,
          height: 42,
          label: 'Закрыть',
          variant: 'bad',
          onClick: () => this.closeModal(),
        }).setDepth(52)
      );
    }
  }

  closeModal() {
    this.modalObjects.forEach((o) => o.destroy());
    this.modalObjects = [];
    this.modalOpen = false;
  }

  showLocationComplete() {
    this.openLocationPicker({
      title: `«${this.location.label}» пройдена!`,
      subtitle: 'Все слова выучены. Куда дальше?',
      keys: [...BATTLE_KEYS.filter((k) => k !== this.locationKey), 'village'],
      closable: false,
    });
  }

  openDevPanel() {
    this.openLocationPicker({ title: 'Dev: переход', subtitle: 'Любая локация без зачистки', keys: ALL_LOCATION_KEYS, closable: true });
  }

  showToast(text) {
    const toast = this.add.text(this.scale.width / 2, 92, text, outlinedTextStyle(20, COLORS.sun)).setOrigin(0.5).setDepth(20);
    this.uiLayer.add(toast);
    this.tweens.add({ targets: toast, alpha: 0, delay: 1400, duration: 500, onComplete: () => toast.destroy() });
  }
}
