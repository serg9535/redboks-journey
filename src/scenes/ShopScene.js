import Phaser from 'phaser';
import {
  addKeys,
  addPotion,
  addStars,
  getKeys,
  getOwnedHats,
  getOwnedItems,
  getOwnedPets,
  getPet,
  getPotions,
  getStars,
  getWeapon,
  getWornHat,
  hasTorch,
  markHatOwned,
  markItemOwned,
  markPetOwned,
  setPet,
  setTorch,
  setWeapon,
  setWornHat,
} from '../data/progress.js';
import { PETS, POTIONS, SHOP_WEAPONS, weaponSprite } from '../data/items.js';
import { COLORS, fitSprite, outlinedTextStyle, textStyle } from '../ui/theme.js';
import { Button, drawPanel } from '../ui/widgets.js';
import { HATS, drawHat, placeHat } from '../ui/hats.js';
import { speak } from '../ui/speech.js';

const CARD_W = 160;
const CARD_H = 290;
const THINGS = [
  { id: 'key', sprite: 'item_key', word: 'key', ru: 'ключ', price: 8, info: 'Открывает запертую дверь в деревне' },
  { id: 'torch', sprite: 'item_torch', word: 'torch', ru: 'факел', price: 6, info: 'Светит в тёмной пещере' },
];
// Вкладки лавки. wear — купить один раз и надеть одно (шапка/оружие/питомец);
// count — расходник, покупается сколько угодно (зелья, ключи); once — купить навсегда (факел).
const TABS = [
  { id: 'hats', label: 'Шапки', goods: HATS, wear: [getWornHat, setWornHat, getOwnedHats, markHatOwned] },
  { id: 'weapons', label: 'Оружие', goods: SHOP_WEAPONS, sprite: (it) => weaponSprite(it.id), wear: [getWeapon, setWeapon, getOwnedItems, markItemOwned] },
  { id: 'potions', label: 'Зелья', goods: POTIONS },
  { id: 'things', label: 'Вещи', goods: THINGS },
  { id: 'pets', label: 'Питомцы', goods: PETS, wear: [getPet, setPet, getOwnedPets, markPetOwned] },
];

// Лавка Торговца Пузыря: тратим звёзды ★ на шапки, оружие, зелья, вещи, питомцев.
// Каждый товар — английское слово (озвучивается по тапу на витрину).
// Оверлей поверх WorldScene, мир на resume перерисует шапку на герое.
export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(0, 0, w, h, COLORS.night, 0.85).setOrigin(0, 0).setInteractive();
    drawPanel(this.add.graphics(), 12, 10, w - 24, 52, { radius: 16 });
    this.add.text(32, 36, 'Лавка Пузыря', textStyle(26, COLORS.berryShade)).setOrigin(0, 0.5);
    this.starsText = this.add.text(w / 2 + 120, 36, '', textStyle(22)).setOrigin(0.5);
    new Button(this, { x: w - 92, y: 36, width: 140, height: 40, label: 'Закрыть', fontSize: 18, variant: 'bad', onClick: () => this.close() });
    this.message = this.add.text(w / 2, h - 30, 'Коснись товара, чтобы услышать слово', outlinedTextStyle(20)).setOrigin(0.5);

    this.tabButtons = TABS.map(
      (tab, i) =>
        new Button(this, { x: w / 2 + (i - (TABS.length - 1) / 2) * 162, y: 104, width: 150, height: 44, label: tab.label, fontSize: 19, onClick: () => this.showTab(tab) })
    );
    this.shelf = this.add.container(0, 0);
    this.showTab(TABS[0]);
  }

  showTab(tab) {
    this.tab = tab;
    this.tabButtons.forEach((b, i) => b.setVariant(TABS[i] === tab ? 'primary' : 'secondary'));
    this.shelf.removeAll(true);
    const gap = 16;
    const total = tab.goods.length * CARD_W + (tab.goods.length - 1) * gap;
    this.cards = tab.goods.map((item, i) => this.createCard(item, (this.scale.width - total) / 2 + CARD_W / 2 + i * (CARD_W + gap), 340));
    this.refresh();
  }

  createCard(item, x, y) {
    const add = (obj) => {
      this.shelf.add(obj);
      return obj;
    };
    add(drawPanel(this.add.graphics(), x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, { radius: 18 }));
    if (this.tab.id === 'hats') {
      const redbok = add(fitSprite(this.add.image(x, y - 30, 'redbok_00'), 100));
      const hatGfx = add(drawHat(this.add.graphics(), item.id, 52));
      placeHat(hatGfx, redbok);
    } else {
      add(fitSprite(this.add.image(x, y - 34, this.tab.sprite ? this.tab.sprite(item) : item.sprite), 96));
    }
    add(this.add.text(x, y + 30, item.word.toUpperCase(), textStyle(item.word.length > 8 ? 17 : 22, COLORS.berryShade)).setOrigin(0.5));
    add(this.add.text(x, y + 52, item.info ?? item.ru, textStyle(14, COLORS.greyShade, { align: 'center', wordWrap: { width: CARD_W - 16 } })).setOrigin(0.5, 0));
    const zone = add(this.add.zone(x, y - 30, CARD_W, 120).setInteractive({ useHandCursor: true }));
    zone.on('pointerdown', () => {
      speak(item.word);
      this.message.setText(`${item.word.toUpperCase()} — ${item.ru}${item.info ? `: ${item.info}` : ''}`);
    });
    const button = add(new Button(this, { x, y: y + CARD_H / 2 - 30, width: CARD_W - 24, height: 44, fontSize: 18, onClick: () => this.act(item) }));
    return { item, button };
  }

  // Сколько расходника уже есть (зелья, ключи); null — не расходник.
  countOf(item) {
    if (this.tab.id === 'potions') return getPotions()[item.id] ?? 0;
    if (item.id === 'key') return getKeys();
    return null;
  }

  refresh() {
    const stars = getStars();
    this.starsText.setText(`У тебя ★ ${stars}`);
    this.cards.forEach(({ item, button }) => {
      const buy = (label = `Купить ★${item.price}`) => button.setLabel(label).setVariant('primary').setEnabled(stars >= item.price);
      const count = this.countOf(item);
      if (count !== null) return buy(`★${item.price}  (есть ${count})`);
      if (item.id === 'torch') return hasTorch() ? button.setLabel('Уже есть').setVariant('muted').setEnabled(false) : buy();
      const [getWorn, , getOwned] = this.tab.wear;
      if (item.id === getWorn()) button.setLabel('Снять').setVariant('muted').setEnabled(true);
      else if (getOwned().has(item.id)) button.setLabel('Надеть').setVariant('good').setEnabled(true);
      else buy();
    });
  }

  act(item) {
    const pay = () => {
      if (getStars() < item.price) return false;
      addStars(-item.price);
      speak(item.word);
      return true;
    };
    if (this.tab.id === 'potions' || item.id === 'key') {
      if (!pay()) return;
      if (item.id === 'key') addKeys(1);
      else addPotion(item.id, 1);
      this.message.setText(`${item.word.toUpperCase()} — в рюкзаке!`);
      return this.refresh();
    }
    if (item.id === 'torch') {
      if (hasTorch() || !pay()) return;
      setTorch();
      this.message.setText('TORCH — теперь в пещере светло!');
      return this.refresh();
    }
    const [getWorn, setWorn, getOwned, markOwned] = this.tab.wear;
    if (getWorn() === item.id) {
      setWorn(null);
    } else if (getOwned().has(item.id)) {
      setWorn(item.id);
    } else {
      if (!pay()) return;
      markOwned(item.id);
      setWorn(item.id);
      this.message.setText(`Новое: ${item.word.toUpperCase()} — ${item.ru}!`);
    }
    this.refresh();
  }

  close() {
    this.scene.stop();
    this.scene.resume('World');
  }
}
