import Phaser from 'phaser';
import { TILE_SIZE, isWalkable, mapPixelSize } from '../data/maps.js';
import { ALL_LOCATION_KEYS, BATTLE_KEYS, getLocation } from '../data/locations.js';
import { getShowTranslation, setShowTranslation } from '../data/settings.js';
import { COLORS, fitSprite, outlinedTextStyle, textStyle } from '../ui/theme.js';
import { Button, drawPanel } from '../ui/widgets.js';
import { DialogueBox } from '../ui/DialogueBox.js';
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
const PLAYER_SIZE = 62;
const WALK_FRAMES = ['redbok_00', 'redbok_01', 'redbok_02', 'redbok_03'];
// Вида «в профиль» нет — только анфас и один кадр со спины (при движении вверх,
// чтобы герой не шёл лицом к камере, удаляясь от неё).
const BACK_FRAME = 'redbok_back_00';

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
    this.layout = map.layout;
    const { width: mapW, height: mapH } = mapPixelSize(this.layout);

    // Мир и UI — на разных камерах: зум/панорама карты не трогают HUD и D-pad.
    this.worldLayer = this.add.layer();
    this.uiLayer = this.add.layer();

    drawBackground(this, this.worldLayer, this.location.background, mapW, mapH);
    drawWalls(this, this.worldLayer, this.layout, palette);

    this.monsters = this.location.words
      .map((entry, i) => ({ entry, tile: map.monsterTiles[i % map.monsterTiles.length] }))
      .filter(({ entry }) => !this.defeatedSprites.includes(entry.sprite))
      .map(({ entry, tile }) => ({ ...this.placeCharacter(entry.sprite, tile), entry }));

    this.npcs = (map.npcTiles ?? []).map((tile, i) => ({ ...this.placeCharacter(map.npcs[i % map.npcs.length].sprite, tile), npc: map.npcs[i % map.npcs.length] }));

    this.portals = map.portals ?? [];
    this.portals.forEach((portal) => this.drawPortal(portal));

    const startTile = this.incomingPlayerTile ?? map.playerStart;
    this.playerTile = { col: startTile.col, row: startTile.row };
    const { x: px, y: py } = this.tileCenter(this.playerTile);
    this.playerShadow = addShadow(this, this.worldLayer, px, py + 20, 38);
    this.player = fitSprite(this.add.image(px, py, 'redbok_00'), PLAYER_SIZE).setDepth(3);
    this.worldLayer.add(this.player);

    // В мирных локациях тумана нет: там нечего «исследовать», только поговорить.
    if (!this.location.peaceful) {
      this.fog = new FogOfWar(this, this.worldLayer, this.layout, this.incomingVisitedTiles);
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

    const words = this.location.words;
    if (words.length > 0 && words.every((w) => this.defeatedSprites.includes(w.sprite))) {
      this.showLocationComplete();
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
    const panelW = 340;
    this.uiLayer.add(drawPanel(this.add.graphics().setDepth(10), 12, 10, panelW, 46, { radius: 14 }));
    this.uiLayer.add(this.add.text(28, 33, this.location.label, textStyle(20)).setOrigin(0, 0.5).setDepth(11));
    this.progressText = this.add.text(12 + panelW - 16, 33, '', textStyle(18, COLORS.berryShade)).setOrigin(1, 0.5).setDepth(11);
    this.uiLayer.add(this.progressText);
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
    this.uiLayer.add([ruBtn, homeBtn]);

    if (SHOW_DEV) {
      const devBtn = new Button(this, { x: 62, y: 84, width: 100, height: 34, label: 'Dev', fontSize: 15, variant: 'muted', onClick: () => this.openDevPanel() }).setDepth(11);
      this.uiLayer.add(devBtn);
    }

    const hint = this.location.peaceful
      ? 'Подойди к жителю и коснись его, чтобы поговорить'
      : 'Тапни по клетке — Redbok пойдёт туда';
    const hintText = this.add.text(w / 2 + 60, this.scale.height - 16, hint, outlinedTextStyle(16)).setOrigin(0.5, 1).setDepth(11);
    this.uiLayer.add(hintText);
    this.tweens.add({ targets: hintText, alpha: 0, delay: 6000, duration: 800 });
  }

  updateProgress() {
    const words = this.location.words;
    if (words.length === 0) {
      this.progressText.setText('');
      return;
    }
    const learned = words.filter((w) => this.defeatedSprites.includes(w.sprite)).length;
    this.progressText.setText(`★ ${learned}/${words.length}`);
  }

  update() {
    this.updatePinchZoom();
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

    const npc = this.npcs.find(at);
    if (npc) return this.openDialogue(npc.npc);

    const portal = this.portals.find((p) => p.col === target.col && p.row === target.row);
    if (portal) {
      this.scene.start('World', { biomeKey: portal.to, playerTile: portal.spawnAt, defeatedSprites: [...this.defeatedSprites] });
      return;
    }

    if (!isWalkable(this.layout, target.col, target.row)) return;

    this.isMoving = true;
    if (dCol !== 0) this.player.setFlipX(dCol < 0);
    if (dRow < 0) this.facingBack = true;
    else if (dRow > 0 || dCol !== 0) this.facingBack = false;
    this.playWalkAnimation();

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
    const frames = this.facingBack ? [BACK_FRAME] : WALK_FRAMES;
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
      if (this.input.hitTestPointer(pointer).length > 0) return; // тап по UI
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

  startBattle(monster) {
    this.pendingPath = [];
    this.scene.start('Battle', {
      biomeKey: this.locationKey,
      wordEntry: monster.entry,
      defeatedSprites: [...this.defeatedSprites],
      returnTile: { ...this.playerTile },
      visitedTiles: this.fog?.visitedTiles() ?? [],
    });
  }

  openDialogue(npc) {
    this.pendingPath = [];
    this.touch.reset();
    this.modalOpen = true;
    new DialogueBox(this, this.uiLayer, npc, () => {
      this.modalOpen = false;
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
