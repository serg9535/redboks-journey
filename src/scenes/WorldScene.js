import Phaser from 'phaser';
import { BIOMES } from '../data/vocab.js';
import { MAPS, TILE_SIZE, isWalkable, mapPixelSize, PEACEFUL_LOCATIONS } from '../data/maps.js';
import { getShowTranslation, setShowTranslation } from '../data/settings.js';

const MOVE_DURATION = 160;
const VISIBLE_RADIUS = 2; // клеток вокруг игрока — полностью видно
const REMEMBERED_ALPHA = 0.55; // мягкий туман на уже посещённых, но не видимых сейчас клетках
const UNSEEN_ALPHA = 0.92;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.2;
const TAP_MAX_DISTANCE = 14; // px сдвига пальца, чтобы всё ещё считать тапом, а не свайпом
const WALK_FRAMES = ['redbok_00', 'redbok_01', 'redbok_02', 'redbok_03'];
// Единственный вид сзади (нет анимационного цикла, в отличие от WALK_FRAMES) —
// используется только при движении вверх, чтобы герой не "шёл лицом к камере"
// удаляясь от игрока (см. attemptMove/playWalkAnimation).
const BACK_FRAMES = ['redbok_back_00'];

export class WorldScene extends Phaser.Scene {
  constructor() {
    super('World');
  }

  init(data) {
    this.biomeKey = data.biomeKey ?? 'forest';
    this.defeatedSprites = data.defeatedSprites ?? [];
    this.retreat = data.retreat ?? false;
    this.incomingPlayerTile = data.playerTile ?? null;
    this.incomingVisitedTiles = data.visitedTiles ?? null;
    // Phaser reuses the same Scene instance across scene.start() calls — any
    // flag not reset here would leak from whatever state the previous run
    // left it in (e.g. a dialogue/dev-panel left open when navigating away).
    this.dialogueActive = false;
    this.devPanelOpen = false;
    this.devPanelObjects = [];
    this.facingBack = false;
  }

  create() {
    const peacefulInfo = PEACEFUL_LOCATIONS[this.biomeKey];
    const isVillage = !!peacefulInfo; // "мирная локация" (деревня/поляна/...), имя не меняем — используется по всему файлу
    const biome = isVillage ? { ...peacefulInfo, words: [] } : BIOMES[this.biomeKey];
    const map = MAPS[this.biomeKey];
    this.map = map;
    this.layout = map.layout;
    const { width: mapW, height: mapH } = mapPixelSize(this.layout);
    this.mapW = mapW;
    this.mapH = mapH;

    // Мир и UI рендерятся разными камерами (см. настройку камер ниже), чтобы
    // зум/панорамирование карты не влияли на HUD/D-pad/оверлеи.
    this.worldLayer = this.add.layer();
    this.uiLayer = this.add.layer();

    // Фон биома под картой — накрывает всю область тайлов
    const bg = this.add.image(0, 0, biome.background).setOrigin(0, 0).setDepth(0);
    bg.setDisplaySize(mapW, mapH);
    this.worldLayer.add(bg);

    // Стены — плашки поверх фона
    for (let row = 0; row < this.layout.length; row++) {
      for (let col = 0; col < this.layout[row].length; col++) {
        if (this.layout[row][col] === '#') {
          const wall = this.add.rectangle(
            col * TILE_SIZE + TILE_SIZE / 2,
            row * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE,
            TILE_SIZE,
            0x241a3d,
            0.88
          );
          wall.setStrokeStyle(2, 0x3a2c5c, 0.9);
          wall.setDepth(1);
          this.worldLayer.add(wall);
        }
      }
    }

    // Монстры
    this.monsterSprites = [];
    biome.words.forEach((entry, i) => {
      if (this.defeatedSprites.includes(entry.sprite)) return;
      const tile = map.monsterTiles[i % map.monsterTiles.length];
      const img = this.add.image(
        tile.col * TILE_SIZE + TILE_SIZE / 2,
        tile.row * TILE_SIZE + TILE_SIZE / 2,
        entry.sprite
      );
      img.setScale(0.17).setDepth(2);
      img.wordEntry = entry;
      img.tile = tile;
      this.monsterSprites.push(img);
      this.worldLayer.add(img);

      // Лёгкое "дыхание", чтобы монстры не выглядели совсем статично —
      // без новых артов, просто покачивание с разной фазой/скоростью.
      this.tweens.add({
        targets: img,
        y: img.y - 5,
        duration: 650 + Math.random() * 300,
        delay: Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    // Жители деревни — не бойцы, при встрече открывают диалог (см. attemptMove)
    this.npcSprites = [];
    if (map.npcTiles) {
      map.npcTiles.forEach((tile, i) => {
        const npcData = map.npcs[i % map.npcs.length];
        const img = this.add.image(
          tile.col * TILE_SIZE + TILE_SIZE / 2,
          tile.row * TILE_SIZE + TILE_SIZE / 2,
          npcData.sprite
        );
        img.setScale(0.17).setDepth(2);
        img.npcData = npcData;
        img.tile = tile;
        this.npcSprites.push(img);
        this.worldLayer.add(img);

        this.tweens.add({
          targets: img,
          y: img.y - 5,
          duration: 650 + Math.random() * 300,
          delay: Math.random() * 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      });
    }

    // Портал в другую мирную локацию — просто заметный тайл, логика перехода
    // в attemptMove() (срабатывает по bump, как и NPC/монстры).
    if (map.portals) {
      map.portals.forEach((portal) => {
        const marker = this.add
          .text(portal.col * TILE_SIZE + TILE_SIZE / 2, portal.row * TILE_SIZE + TILE_SIZE / 2, '🌸', {
            fontSize: '28px',
          })
          .setOrigin(0.5)
          .setDepth(2);
        this.worldLayer.add(marker);
      });
    }

    // Игрок — с чекпоинта карты только если пришли впервые или после отката
    // (проигрыш боя); после победы возвращаемся туда, где стояли.
    const startTile = this.incomingPlayerTile ?? map.playerStart;
    this.playerTile = { col: startTile.col, row: startTile.row };
    this.player = this.add.image(
      this.playerTile.col * TILE_SIZE + TILE_SIZE / 2,
      this.playerTile.row * TILE_SIZE + TILE_SIZE / 2,
      'redbok_00'
    );
    this.player.setScale(0.26).setDepth(3);
    this.worldLayer.add(this.player);
    this.isMoving = false;
    this.pendingPath = [];

    // Туман войны
    this.fogTiles = [];
    for (let row = 0; row < this.layout.length; row++) {
      const rowArr = [];
      for (let col = 0; col < this.layout[row].length; col++) {
        const fog = this.add.rectangle(
          col * TILE_SIZE + TILE_SIZE / 2,
          row * TILE_SIZE + TILE_SIZE / 2,
          TILE_SIZE + 1,
          TILE_SIZE + 1,
          0x0a0e27,
          UNSEEN_ALPHA
        );
        fog.setDepth(5);
        fog.visited = false;
        rowArr.push(fog);
        this.worldLayer.add(fog);
      }
      this.fogTiles.push(rowArr);
    }
    if (this.incomingVisitedTiles) {
      for (const [c, r] of this.incomingVisitedTiles) {
        const fog = this.fogTiles[r] && this.fogTiles[r][c];
        if (fog) {
          fog.visited = true;
          fog.setAlpha(REMEMBERED_ALPHA);
        }
      }
    }
    this.revealAround(this.playerTile.col, this.playerTile.row, true);

    // Камеры: основная показывает и масштабирует мир, следует за игроком;
    // вторая — неподвижный слой UI поверх, всегда zoom=1.
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.setZoom(1);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.ignore(this.uiLayer);

    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.ignore(this.worldLayer);

    // HUD
    this.hudBg = this.add.rectangle(0, 0, this.scale.width, 34, 0x0a0e27, 0.75).setOrigin(0, 0).setDepth(10);
    this.hpText = this.add.text(10, 7, '', this.hudStyle()).setDepth(11);
    this.wordsText = this.add.text(this.scale.width - 10, 7, '', this.hudStyle()).setOrigin(1, 0).setDepth(11);
    this.updateHud(biome);
    this.uiLayer.add([this.hudBg, this.hpText, this.wordsText]);

    // Переключатель русского перевода слов (виден в бою), настройка сохраняется
    this.translationEnabled = getShowTranslation();
    const toggleX = this.scale.width / 2;
    const toggleBg = this.add
      .rectangle(toggleX, 17, 96, 24, 0x1b2454, 0.85)
      .setStrokeStyle(1, 0xffffff, 0.5)
      .setDepth(11)
      .setInteractive({ useHandCursor: true });
    this.translationToggleText = this.add.text(toggleX, 17, '', this.hudStyle(13)).setOrigin(0.5).setDepth(12);
    this.updateTranslationToggleLabel();
    toggleBg.on('pointerover', () => toggleBg.setFillStyle(0x2c3a86, 0.85));
    toggleBg.on('pointerout', () => toggleBg.setFillStyle(0x1b2454, 0.85));
    toggleBg.on('pointerdown', () => {
      this.translationEnabled = !this.translationEnabled;
      setShowTranslation(this.translationEnabled);
      this.updateTranslationToggleLabel();
    });
    this.uiLayer.add([toggleBg, this.translationToggleText]);

    // Кнопка входа в деревню / возврата из неё — доступна из любой локации
    const villageBtnLabel = isVillage ? '🌲 Обратно' : '🏘 Деревня';
    const villageBtnBg = this.add
      .rectangle(this.scale.width - 62, 46, 108, 24, 0x1b2454, 0.85)
      .setStrokeStyle(1, 0xffffff, 0.5)
      .setDepth(11)
      .setInteractive({ useHandCursor: true });
    const villageBtnText = this.add.text(this.scale.width - 62, 46, villageBtnLabel, this.hudStyle(12)).setOrigin(0.5).setDepth(12);
    villageBtnBg.on('pointerover', () => villageBtnBg.setFillStyle(0x2c3a86, 0.85));
    villageBtnBg.on('pointerout', () => villageBtnBg.setFillStyle(0x1b2454, 0.85));
    villageBtnBg.on('pointerdown', () => {
      // из деревни — в лес (дефолтный биом), из любой другой мирной локации
      // (поляна и т.п.) — обратно в деревню, из боевого биома — в деревню
      const backTarget = this.biomeKey === 'village' ? 'forest' : 'village';
      this.scene.start('World', {
        biomeKey: isVillage ? backTarget : 'village',
        defeatedSprites: [...this.defeatedSprites],
      });
    });
    this.uiLayer.add([villageBtnBg, villageBtnText]);

    // Dev-режим: быстрый переход в любую локацию без зачистки текущей —
    // для тестирования, не для игроков (devPanelOpen/devPanelObjects сброшены в init()).
    const devBtnBg = this.add
      .rectangle(56, 46, 88, 24, 0x1b2454, 0.85)
      .setStrokeStyle(1, 0xffffff, 0.5)
      .setDepth(11)
      .setInteractive({ useHandCursor: true });
    const devBtnText = this.add.text(56, 46, '🛠 Dev', this.hudStyle(12)).setOrigin(0.5).setDepth(12);
    devBtnBg.on('pointerover', () => devBtnBg.setFillStyle(0x2c3a86, 0.85));
    devBtnBg.on('pointerout', () => devBtnBg.setFillStyle(0x1b2454, 0.85));
    devBtnBg.on('pointerdown', () => this.toggleDevPanel());
    this.uiLayer.add([devBtnBg, devBtnText]);

    const hint = isVillage
      ? 'Подойди к жителю и коснись его (или врежься), чтобы поговорить.'
      : 'Тапни по клетке — Redbok пойдёт туда. Два пальца — зум. Кнопки/стрелки тоже работают.';
    this.hintText = this.add
      .text(this.scale.width / 2, this.scale.height - 12, hint, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        stroke: '#0a0e27',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(11);
    this.uiLayer.add(this.hintText);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');

    // Always on (not gated behind touch-capability detection): device.input.touch
    // is unreliable across mobile browsers/webviews, and the buttons are a
    // harmless small corner overlay that also works fine with a mouse.
    this.touchDirection = null;
    this.createTouchControls();

    this.pinchStartDist = null;
    this.tapPointerStart = null;
    this.setupPointerControls();

    if (this.retreat) {
      this.showToast('Redbok отдохнул и снова готов!');
    }

    const allDefeated = biome.words.length > 0 && biome.words.every((w) => this.defeatedSprites.includes(w.sprite));
    if (allDefeated) {
      this.showBiomeComplete(biome);
    }
  }

  hudStyle(size = 16) {
    return {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${size}px`,
      color: '#ffffff',
    };
  }

  updateHud(biome) {
    this.hpText.setText(`${biome.label}`);
    if (biome.words.length === 0) {
      this.wordsText.setText('Поговори с жителями');
    } else {
      const learned = biome.words.filter((w) => this.defeatedSprites.includes(w.sprite)).length;
      this.wordsText.setText(`Выучено слов: ${learned}/${biome.words.length}`);
    }
  }

  updateTranslationToggleLabel() {
    this.translationToggleText.setText(this.translationEnabled ? 'RU: вкл' : 'RU: выкл');
  }

  revealAround(col, row, instant = false) {
    for (let r = 0; r < this.fogTiles.length; r++) {
      for (let c = 0; c < this.fogTiles[r].length; c++) {
        const fog = this.fogTiles[r][c];
        const dist = Math.max(Math.abs(c - col), Math.abs(r - row));
        let targetAlpha;
        if (dist <= VISIBLE_RADIUS) {
          targetAlpha = 0;
          fog.visited = true;
        } else if (fog.visited) {
          targetAlpha = REMEMBERED_ALPHA;
        } else {
          continue;
        }
        if (instant) {
          fog.setAlpha(targetAlpha);
        } else {
          this.tweens.add({ targets: fog, alpha: targetAlpha, duration: 220, ease: 'Quad.easeOut' });
        }
      }
    }
  }

  update() {
    this.updatePinchZoom();

    if (this.isMoving || this.dialogueActive) return;

    let dCol = 0;
    let dRow = 0;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.wasd.A)) dCol = -1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.wasd.D)) dCol = 1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.W)) dRow = -1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.S)) dRow = 1;

    if (dCol !== 0 || dRow !== 0) {
      this.pendingPath = []; // ручное управление отменяет тап-путь
      this.attemptMove(dCol, dRow);
      return;
    }

    if (this.touchDirection) {
      this.pendingPath = [];
      this.attemptMove(this.touchDirection.dCol, this.touchDirection.dRow);
      return;
    }

    if (this.pendingPath.length > 0) {
      const next = this.pendingPath[0];
      const stepCol = next.col - this.playerTile.col;
      const stepRow = next.row - this.playerTile.row;
      this.pendingPath.shift();
      this.attemptMove(stepCol, stepRow);
    }
  }

  attemptMove(dCol, dRow) {
    if (this.dialogueActive) return;

    const targetCol = this.playerTile.col + dCol;
    const targetRow = this.playerTile.row + dRow;

    const monster = this.monsterSprites.find((m) => m.tile.col === targetCol && m.tile.row === targetRow);
    if (monster) {
      this.pendingPath = [];
      this.startBattle(monster);
      return;
    }

    const npc = this.npcSprites.find((n) => n.tile.col === targetCol && n.tile.row === targetRow);
    if (npc) {
      this.pendingPath = [];
      this.showDialogue(npc.npcData);
      return;
    }

    const portal = this.map.portals && this.map.portals.find((p) => p.col === targetCol && p.row === targetRow);
    if (portal) {
      this.pendingPath = [];
      this.scene.start('World', { biomeKey: portal.to, playerTile: portal.spawnAt });
      return;
    }

    if (!isWalkable(this.layout, targetCol, targetRow)) return;

    this.isMoving = true;
    if (dCol !== 0) this.player.setFlipX(dCol < 0);
    // Спрайта "в профиль" у нас нет — только анфас (WALK_FRAMES) и со спины
    // (BACK_FRAMES, один кадр). Вверх — со спины, любое другое направление —
    // анфас, иначе герой будет всё время смотреть в камеру, уходя от неё.
    if (dRow < 0) this.facingBack = true;
    else if (dRow > 0 || dCol !== 0) this.facingBack = false;
    this.playWalkAnimation();

    this.playerTile = { col: targetCol, row: targetRow };
    this.tweens.add({
      targets: this.player,
      x: targetCol * TILE_SIZE + TILE_SIZE / 2,
      y: targetRow * TILE_SIZE + TILE_SIZE / 2,
      duration: MOVE_DURATION,
      ease: 'Linear',
      onComplete: () => {
        this.player.setTexture(this.facingBack ? BACK_FRAMES[0] : 'redbok_00');
        this.isMoving = false;
      },
    });
    this.revealAround(targetCol, targetRow);
  }

  playWalkAnimation() {
    if (this.walkTimer) this.walkTimer.remove();
    const frames = this.facingBack ? BACK_FRAMES : WALK_FRAMES;
    let frame = 0;
    this.player.setTexture(frames[0]);
    this.walkTimer = this.time.addEvent({
      delay: MOVE_DURATION / frames.length,
      repeat: frames.length - 1,
      callback: () => {
        frame = (frame + 1) % frames.length;
        this.player.setTexture(frames[frame]);
      },
    });
  }

  // Поиск кратчайшего пути по клеткам (BFS) — используется тапом по карте.
  findPath(fromCol, fromRow, toCol, toRow) {
    if (!isWalkable(this.layout, toCol, toRow)) return null;
    if (fromCol === toCol && fromRow === toRow) return [];

    const key = (c, r) => `${c},${r}`;
    const startKey = key(fromCol, fromRow);
    const visited = new Set([startKey]);
    const prev = new Map();
    const queue = [[fromCol, fromRow]];
    let qi = 0;

    while (qi < queue.length) {
      const [c, r] = queue[qi++];
      if (c === toCol && r === toRow) {
        const path = [];
        let curKey = key(c, r);
        while (curKey !== startKey) {
          const [pc, pr] = curKey.split(',').map(Number);
          path.unshift({ col: pc, row: pr });
          curKey = prev.get(curKey);
        }
        return path;
      }
      const neighbors = [
        [c + 1, r],
        [c - 1, r],
        [c, r + 1],
        [c, r - 1],
      ];
      for (const [nc, nr] of neighbors) {
        const nk = key(nc, nr);
        if (!visited.has(nk) && isWalkable(this.layout, nc, nr)) {
          visited.add(nk);
          prev.set(nk, key(c, r));
          queue.push([nc, nr]);
        }
      }
    }
    return null; // недостижимо
  }

  handleTapMove(pointer) {
    if (this.dialogueActive) return;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const col = Math.floor(world.x / TILE_SIZE);
    const row = Math.floor(world.y / TILE_SIZE);

    // Монстры стоят на проходимых клетках, так что findPath доводит путь и
    // до них; последний шаг в update() наткнётся на монстра и уйдёт в бой.
    const path = this.findPath(this.playerTile.col, this.playerTile.row, col, row);
    if (path) {
      this.pendingPath = path;
    }
    // Путь не найден (стена/недостижимо) — тап просто игнорируется.
  }

  updatePinchZoom() {
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    if (p1 && p2 && p1.isDown && p2.isDown) {
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      if (this.pinchStartDist === null) {
        this.pinchStartDist = dist;
        this.pinchStartZoom = this.cameras.main.zoom;
      } else if (this.pinchStartDist > 0) {
        const factor = dist / this.pinchStartDist;
        const zoom = Phaser.Math.Clamp(this.pinchStartZoom * factor, MIN_ZOOM, MAX_ZOOM);
        this.cameras.main.setZoom(zoom);
      }
    } else {
      this.pinchStartDist = null;
    }
  }

  setupPointerControls() {
    this.input.on('pointerdown', (pointer) => {
      const overOne = this.input.hitTestPointer(pointer);
      if (overOne.length > 0) return; // тап по кнопке/UI — не наш случай
      this.tapPointerStart = { x: pointer.x, y: pointer.y };
    });

    this.input.on('pointerup', (pointer, currentlyOver) => {
      const wasPinching = this.pinchStartDist !== null;
      if (wasPinching || currentlyOver.length > 0 || !this.tapPointerStart) {
        this.tapPointerStart = null;
        return;
      }
      const dist = Phaser.Math.Distance.Between(
        this.tapPointerStart.x,
        this.tapPointerStart.y,
        pointer.x,
        pointer.y
      );
      this.tapPointerStart = null;
      if (dist > TAP_MAX_DISTANCE) return; // это свайп/пинч, не тап
      if (this.input.pointer2 && this.input.pointer2.isDown) return; // второй палец ещё держится
      this.handleTapMove(pointer);
    });
  }

  createTouchControls() {
    const cx = 92;
    const cy = this.scale.height - 150;
    const gap = 62;
    const size = 56;
    const dirs = [
      { dx: 0, dy: -gap, dCol: 0, dRow: -1, label: '▲' },
      { dx: 0, dy: gap, dCol: 0, dRow: 1, label: '▼' },
      { dx: -gap, dy: 0, dCol: -1, dRow: 0, label: '◀' },
      { dx: gap, dy: 0, dCol: 1, dRow: 0, label: '▶' },
    ];

    dirs.forEach(({ dx, dy, dCol, dRow, label }) => {
      const bx = cx + dx;
      const by = cy + dy;
      const btn = this.add.rectangle(bx, by, size, size, 0x1b2454, 0.55).setDepth(25);
      btn.setStrokeStyle(2, 0xffffff, 0.5);
      btn.setInteractive({ useHandCursor: true });
      const label_ = this.add.text(bx, by, label, { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5).setDepth(26);
      this.uiLayer.add([btn, label_]);

      const press = () => {
        this.pendingPath = [];
        this.touchDirection = { dCol, dRow };
        btn.setFillStyle(0x3a4a9a, 0.75);
        if (!this.isMoving) this.attemptMove(dCol, dRow);
      };
      const release = () => {
        if (this.touchDirection && this.touchDirection.dCol === dCol && this.touchDirection.dRow === dRow) {
          this.touchDirection = null;
        }
        btn.setFillStyle(0x1b2454, 0.55);
      };

      btn.on('pointerdown', press);
      btn.on('pointerup', release);
      btn.on('pointerout', release);
    });
  }

  getVisitedTiles() {
    const visited = [];
    this.fogTiles.forEach((row, r) => {
      row.forEach((fog, c) => {
        if (fog.visited) visited.push([c, r]);
      });
    });
    return visited;
  }

  startBattle(monster) {
    this.scene.start('Battle', {
      biomeKey: this.biomeKey,
      wordEntry: monster.wordEntry,
      defeatedSprites: [...this.defeatedSprites],
      returnTile: { ...this.playerTile },
      visitedTiles: this.getVisitedTiles(),
    });
  }

  showBiomeComplete(biome) {
    const w = this.scale.width;
    const h = this.scale.height;

    const overlay = this.add.rectangle(0, 0, w, h, 0x0a0e27, 0.88).setOrigin(0, 0).setDepth(30);
    const title = this.add
      .text(w / 2, 120, `Биом «${biome.label}» пройден!\nВсе слова выучены`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#ffe37b',
        align: 'center',
        stroke: '#0a0e27',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(31);
    this.uiLayer.add([overlay, title]);

    const otherKeys = Object.keys(BIOMES).filter((key) => key !== this.biomeKey);
    const subtitle = this.add.text(w / 2, 195, 'Выбери следующий биом:', this.hudStyle(18)).setOrigin(0.5).setDepth(31);
    this.uiLayer.add(subtitle);

    otherKeys.forEach((key, i) => {
      const y = 240 + i * 58;
      const btn = this.add
        .rectangle(w / 2, y, 320, 48, 0x1b2454, 0.95)
        .setStrokeStyle(2, 0xffffff)
        .setDepth(31)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(w / 2, y, BIOMES[key].label, this.hudStyle(20)).setOrigin(0.5).setDepth(32);
      this.uiLayer.add([btn, label]);

      btn.on('pointerover', () => btn.setFillStyle(0x2c3a86, 0.95));
      btn.on('pointerout', () => btn.setFillStyle(0x1b2454, 0.95));
      btn.on('pointerdown', () => {
        this.scene.start('World', { biomeKey: key, defeatedSprites: [...this.defeatedSprites] });
      });
    });
  }

  toggleDevPanel() {
    if (this.devPanelOpen) {
      this.closeDevPanel();
    } else {
      this.openDevPanel();
    }
  }

  openDevPanel() {
    this.devPanelOpen = true;
    this.dialogueActive = true; // переиспользуем блокировку движения диалога

    const w = this.scale.width;
    const h = this.scale.height;
    const keys = [...Object.keys(BIOMES), ...Object.keys(PEACEFUL_LOCATIONS)];

    const overlay = this.add.rectangle(0, 0, w, h, 0x0a0e27, 0.92).setOrigin(0, 0).setDepth(50).setInteractive();
    const title = this.add.text(w / 2, 46, '🛠 Dev: переход в локацию', this.hudStyle(20)).setOrigin(0.5).setDepth(51);
    this.devPanelObjects = [overlay, title];

    keys.forEach((key, i) => {
      const y = 96 + i * 50;
      const label = PEACEFUL_LOCATIONS[key] ? PEACEFUL_LOCATIONS[key].label : BIOMES[key].label;
      const isCurrent = key === this.biomeKey;
      const baseColor = isCurrent ? 0x3a4a9a : 0x1b2454;
      const btn = this.add
        .rectangle(w / 2, y, 280, 40, baseColor, 0.95)
        .setStrokeStyle(2, 0xffffff)
        .setDepth(51)
        .setInteractive({ useHandCursor: true });
      const text = this.add
        .text(w / 2, y, label + (isCurrent ? ' (тут)' : ''), this.hudStyle(16))
        .setOrigin(0.5)
        .setDepth(52);
      btn.on('pointerover', () => btn.setFillStyle(0x2c3a86, 0.95));
      btn.on('pointerout', () => btn.setFillStyle(baseColor, 0.95));
      btn.on('pointerdown', () => {
        this.scene.start('World', { biomeKey: key, defeatedSprites: [...this.defeatedSprites] });
      });
      this.devPanelObjects.push(btn, text);
    });

    const closeY = 96 + keys.length * 50 + 20;
    const closeBtn = this.add
      .rectangle(w / 2, closeY, 140, 36, 0x5a1a1a, 0.95)
      .setStrokeStyle(2, 0xffffff)
      .setDepth(51)
      .setInteractive({ useHandCursor: true });
    const closeText = this.add.text(w / 2, closeY, 'Закрыть', this.hudStyle(16)).setOrigin(0.5).setDepth(52);
    closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x7a2a2a, 0.95));
    closeBtn.on('pointerout', () => closeBtn.setFillStyle(0x5a1a1a, 0.95));
    closeBtn.on('pointerdown', () => this.closeDevPanel());
    this.devPanelObjects.push(closeBtn, closeText);

    this.uiLayer.add(this.devPanelObjects);
  }

  closeDevPanel() {
    this.devPanelObjects.forEach((o) => o.destroy());
    this.devPanelObjects = [];
    this.devPanelOpen = false;
    this.dialogueActive = false;
  }

  showDialogue(npc) {
    this.dialogueActive = true;
    this.touchDirection = null;

    const w = this.scale.width;
    const h = this.scale.height;
    const boxH = 150;
    let lineIndex = 0;

    const overlay = this.add.rectangle(0, h - boxH, w, boxH, 0x0a0e27, 0.93).setOrigin(0, 0).setDepth(40);
    overlay.setStrokeStyle(2, 0x3a2c5c, 1);
    const nameText = this.add
      .text(20, h - boxH + 14, npc.name, { fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ffe37b' })
      .setDepth(41);
    const lineText = this.add
      .text(20, h - boxH + 44, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
        wordWrap: { width: w - 40 },
      })
      .setDepth(41);
    const hintText = this.add
      .text(w - 16, h - 14, 'Тапни, чтобы продолжить ▶', { fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#9aa0c8' })
      .setOrigin(1, 1)
      .setDepth(41);
    const closeZone = this.add.rectangle(0, h - boxH, w, boxH, 0x000000, 0.001).setOrigin(0, 0).setDepth(42).setInteractive();
    this.uiLayer.add([overlay, nameText, lineText, hintText, closeZone]);

    const showLine = () => lineText.setText(npc.lines[lineIndex]);
    showLine();

    const advance = () => {
      lineIndex++;
      if (lineIndex >= npc.lines.length) {
        overlay.destroy();
        nameText.destroy();
        lineText.destroy();
        hintText.destroy();
        closeZone.destroy();
        this.dialogueActive = false;
      } else {
        showLine();
      }
    };
    closeZone.on('pointerdown', advance);
  }

  showToast(text) {
    const toast = this.add
      .text(this.scale.width / 2, 60, text, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ffe37b',
        stroke: '#0a0e27',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.uiLayer.add(toast);
    this.tweens.add({ targets: toast, alpha: 0, delay: 1200, duration: 500, onComplete: () => toast.destroy() });
  }
}
