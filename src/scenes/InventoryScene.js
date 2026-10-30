import Phaser from 'phaser';
import { getKeys, getOwnedItems, getPotions, getWeapon, hasTorch, setWeapon } from '../data/progress.js';
import { POTIONS, WEAPONS, weaponSprite } from '../data/items.js';
import { COLORS, fitSprite, outlinedTextStyle, textStyle } from '../ui/theme.js';
import { Button, drawPanel } from '../ui/widgets.js';
import { speak } from '../ui/speech.js';

const CELL = 124;
const GAP = 22;

// Рюкзак: оружие (надеть одно; трофеи Боссов тоже здесь), зелья, ключи, факел.
// Ещё не добытое — тёмный силуэт. Тап по предмету — слово вслух.
export class InventoryScene extends Phaser.Scene {
  constructor() {
    super('Inventory');
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(0, 0, w, h, COLORS.night, 0.85).setOrigin(0, 0).setInteractive();
    drawPanel(this.add.graphics(), 12, 10, w - 24, 52, { radius: 16 });
    this.add.text(32, 36, 'Рюкзак', textStyle(26, COLORS.berryShade)).setOrigin(0, 0.5);
    new Button(this, { x: w - 92, y: 36, width: 140, height: 40, label: 'Закрыть', fontSize: 18, variant: 'bad', onClick: () => this.close() });
    this.message = this.add.text(w / 2, h - 24, 'Оружие покупай у Пузыря, а трофеи добывай у Боссов', outlinedTextStyle(19)).setOrigin(0.5);

    this.add.text(36, 84, 'Оружие (надень одно)', outlinedTextStyle(21)).setOrigin(0, 0.5);
    const owned = getOwnedItems();
    const x0 = w / 2 - 1.5 * (CELL + GAP);
    this.weaponCards = WEAPONS.map((wp, i) => this.createWeapon(wp, x0 + (i % 4) * (CELL + GAP), 168 + Math.floor(i / 4) * 150, owned.has(wp.id)));

    this.add.text(36, 412, 'Сумка', outlinedTextStyle(21)).setOrigin(0, 0.5);
    const potions = getPotions();
    const bag = [
      ...POTIONS.map((p) => ({ ...p, count: potions[p.id] ?? 0 })),
      { sprite: 'item_key', word: 'key', ru: 'ключ', info: 'Открывает дверь', count: getKeys() },
      { sprite: 'item_torch', word: 'torch', ru: 'факел', info: 'Светит в пещере', count: hasTorch() ? 1 : 0 },
    ];
    const bx0 = w / 2 - 2 * (CELL + 8);
    bag.forEach((it, i) => this.createBagItem(it, bx0 + i * (CELL + 8), 490));
    this.refresh();
  }

  createWeapon(wp, x, y, owned) {
    drawPanel(this.add.graphics(), x - CELL / 2, y - 62, CELL, 128, { radius: 16, fill: wp.trophy ? 0xf3e2b8 : COLORS.cream });
    const img = fitSprite(this.add.image(x, y - 22, weaponSprite(wp.id)), 66);
    if (!owned) img.setTintFill(COLORS.greyShade);
    this.add.text(x, y + 22, owned ? wp.word.toUpperCase() : '?', textStyle(wp.word.length > 8 ? 14 : 17, COLORS.berryShade)).setOrigin(0.5);
    this.add.zone(x, y - 22, CELL, 80).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (!owned) return this.message.setText(wp.trophy ? 'Это трофей — победи Лесного Короля!' : 'Этого пока нет — загляни к Пузырю!');
      speak(wp.word);
      this.message.setText(`${wp.word.toUpperCase()} — ${wp.ru}: ${wp.info}`);
    });
    const button = owned
      ? new Button(this, {
          x,
          y: y + 46,
          width: CELL - 18,
          height: 30,
          fontSize: 15,
          onClick: () => {
            setWeapon(getWeapon() === wp.id ? null : wp.id);
            if (getWeapon()) speak(wp.word);
            this.refresh();
          },
        })
      : null;
    return { wp, button };
  }

  createBagItem(it, x, y) {
    drawPanel(this.add.graphics(), x - CELL / 2, y - CELL / 2, CELL, CELL, { radius: 16 });
    const img = fitSprite(this.add.image(x, y - 12, it.sprite), 66);
    if (!it.count) img.setAlpha(0.35);
    this.add.text(x + CELL / 2 - 10, y - CELL / 2 + 8, `×${it.count}`, textStyle(18)).setOrigin(1, 0);
    this.add.text(x, y + 40, it.info, textStyle(13, COLORS.greyShade)).setOrigin(0.5);
    this.add.zone(x, y, CELL, CELL).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      speak(it.word);
      this.message.setText(`${it.word.toUpperCase()} — ${it.ru}: ${it.info}`);
    });
  }

  refresh() {
    const worn = getWeapon();
    this.weaponCards.forEach(({ wp, button }) => {
      button?.setLabel(worn === wp.id ? 'Снять' : 'Надеть').setVariant(worn === wp.id ? 'muted' : 'good');
    });
  }

  close() {
    this.scene.stop();
    this.scene.resume('World');
  }
}
