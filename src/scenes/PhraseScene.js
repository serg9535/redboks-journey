import Phaser from 'phaser';
import { ALL_ENTRIES } from '../data/vocab.js';
import { addStars, getRecord, submitRecord } from '../data/progress.js';
import { COLORS, fitSprite, outlinedTextStyle } from '../ui/theme.js';
import { Button, drawSpeakerIcon } from '../ui/widgets.js';
import { canSpeak, speak } from '../ui/speech.js';
import { againButton, arenaPlayed, buildOverlay } from '../ui/overlay.js';

const ROUNDS = 10;
const NUMBERS = ['one', 'two', 'three', 'four', 'five'];
// Слова, у которых понятное множественное число (для «two cats»).
const PLURALS = {
  cat: 'cats', dog: 'dogs', cow: 'cows', pig: 'pigs', duck: 'ducks', horse: 'horses', apple: 'apples', banana: 'bananas',
  egg: 'eggs', cake: 'cakes', carrot: 'carrots', ball: 'balls', cup: 'cups', lamp: 'lamps', book: 'books', chair: 'chairs',
  bee: 'bees', tree: 'trees', mushroom: 'mushrooms', crab: 'crabs', robot: 'robots', penguin: 'penguins', bear: 'bears',
  spider: 'spiders', rocket: 'rockets', cactus: 'cacti', shark: 'sharks', fox: 'foxes', leaf: 'leaves', snowman: 'snowmen',
};
const COUNTABLE = ALL_ENTRIES.filter((e, i, arr) => PLURALS[e.word] && arr.findIndex((x) => x.word === e.word) === i);
const PLACES = ['on', 'under', 'in', 'next to'];
const VERBS = ['jumping', 'running', 'sleeping', 'dancing'];
const TYPES = ['count', 'size', 'place', 'verb', 'what'];
const SCENE_Y = 250;

const phrase = (n, e) => `${NUMBERS[n - 1]} ${n === 1 ? e.word : PLURALS[e.word]}`;

// Следующий уровень английского — фразы вместо отдельных слов. Раунды:
// count — «two cats» (сколько картинок); size — «a big / a small bear»;
// place — предлоги on / under / in / next to (кот и коробка);
// verb — «What is Redbok doing?» (анимация jumping / running / sleeping / dancing);
// what — «What is it?» → «It's a dog.». Варианты — фразы с кнопкой 🔊.
export class PhraseScene extends Phaser.Scene {
  constructor() {
    super('Phrase');
  }

  create() {
    Object.assign(this, buildOverlay(this, 'Английский+'));
    this.question = this.add.text(this.w / 2, 100, '', outlinedTextStyle(28, COLORS.sun)).setOrigin(0.5);
    this.stage = this.add.container(0, 0);
    const wordW = canSpeak ? 240 : 290;
    this.options = [0, 1, 2].map((i) => {
      const x = this.w / 2 + (i - 1) * 306;
      const opt = { text: '' };
      opt.button = new Button(this, { x: canSpeak ? x - 28 : x, y: 470, width: wordW, height: 62, fontSize: 21, variant: 'secondary', onClick: () => this.answer(opt) });
      if (canSpeak) {
        opt.speaker = new Button(this, {
          x: x + wordW / 2 + 4,
          y: 470,
          width: 50,
          height: 62,
          variant: 'info',
          icon: (g, cx, cy, color) => drawSpeakerIcon(g, cx, cy, color),
          onClick: () => speak(opt.text),
        });
      }
      return opt;
    });
    this.again = againButton(this, () => this.start());
    this.start();
  }

  start() {
    this.again.setVisible(false);
    this.round = 0;
    this.points = 0;
    this.next();
  }

  next() {
    if (this.closed) return;
    if (this.round >= ROUNDS) return this.finish();
    this.round += 1;
    this.tweens.killAll();
    this.runEvent?.remove();
    this.stage.removeAll(true);
    this.score.setText(`Раунд ${this.round}/${ROUNDS}   Верно ${this.points}   Рекорд ${getRecord('phrase')}`);
    this.message.setText('');
    const type = TYPES[(this.round - 1) % TYPES.length];
    const { question, answer, others } = this[type]();
    this.question.setText(question);
    this.answerText = answer;
    const texts = Phaser.Utils.Array.Shuffle([answer, ...others.slice(0, 2)]);
    this.options.forEach((opt, i) => {
      opt.text = texts[i];
      opt.button.setLabel(texts[i]).setVariant('secondary').setEnabled(true);
    });
    this.locked = false;
  }

  sprite(key, x, y, size) {
    const img = fitSprite(this.add.image(x, y, key), size);
    this.stage.add(img);
    return img;
  }

  count() {
    const e = Phaser.Utils.Array.GetRandom(COUNTABLE);
    const n = Phaser.Math.Between(1, 5);
    for (let i = 0; i < n; i++) this.sprite(e.sprite, this.w / 2 + (i - (n - 1) / 2) * 120, SCENE_Y, 110);
    const wrong = Phaser.Utils.Array.Shuffle([1, 2, 3, 4, 5].filter((k) => k !== n));
    speak('How many?');
    return { question: 'How many? Сколько?', answer: phrase(n, e), others: wrong.map((k) => phrase(k, e)) };
  }

  size() {
    const e = Phaser.Utils.Array.GetRandom(COUNTABLE);
    const big = Math.random() < 0.5;
    this.sprite('redbok_00', this.w / 2 - 170, SCENE_Y + 40, 120);
    this.sprite(e.sprite, this.w / 2 + 90, big ? SCENE_Y - 10 : SCENE_Y + 70, big ? 260 : 70);
    const other = Phaser.Utils.Array.GetRandom(COUNTABLE.filter((x) => x.word !== e.word));
    return {
      question: 'Big or small? Большой или маленький?',
      answer: `a ${big ? 'big' : 'small'} ${e.word}`,
      others: [`a ${big ? 'small' : 'big'} ${e.word}`, `a ${big ? 'big' : 'small'} ${other.word}`],
    };
  }

  place() {
    const cat = ALL_ENTRIES.find((e) => e.word === 'cat') ?? COUNTABLE[0];
    const where = Phaser.Utils.Array.GetRandom(PLACES);
    const cx = this.w / 2;
    const box = this.textures.exists('item_box') ? 'item_box' : 'item_backpack';
    // Порядок добавления = порядок отрисовки: «in» — кот за передней стенкой коробки.
    if (where === 'in') {
      this.sprite(cat.sprite, cx, SCENE_Y - 30, 100);
      this.sprite(box, cx, SCENE_Y + 40, 170);
    } else if (where === 'on') {
      this.sprite(box, cx, SCENE_Y + 60, 150);
      this.sprite(cat.sprite, cx, SCENE_Y - 50, 110);
    } else if (where === 'under') {
      this.sprite(box, cx, SCENE_Y - 50, 150);
      this.sprite(cat.sprite, cx, SCENE_Y + 85, 90);
    } else {
      this.sprite(box, cx - 80, SCENE_Y + 30, 150);
      this.sprite(cat.sprite, cx + 100, SCENE_Y + 30, 110);
    }
    speak('Where is the cat?');
    const others = PLACES.filter((p) => p !== where).map((p) => `${p} the box`);
    return { question: 'Where is the cat? Где кот?', answer: `${where} the box`, others: Phaser.Utils.Array.Shuffle(others) };
  }

  verb() {
    const verb = Phaser.Utils.Array.GetRandom(VERBS);
    const cx = this.w / 2;
    const r = this.sprite('redbok_00', cx, SCENE_Y, 170);
    if (verb === 'jumping') {
      this.tweens.add({ targets: r, y: SCENE_Y - 80, duration: 300, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
    } else if (verb === 'running') {
      const frames = ['redbok_00', 'redbok_01', 'redbok_02', 'redbok_03'];
      let f = 0;
      this.runEvent = this.time.addEvent({ delay: 110, loop: true, callback: () => r.active && r.setTexture(frames[(f = (f + 1) % 4)]) });
      this.tweens.add({ targets: r, x: cx + 160, duration: 700, yoyo: true, repeat: -1, onYoyo: () => r.setFlipX(false), onRepeat: () => r.setFlipX(true) });
      r.setFlipX(true);
    } else if (verb === 'sleeping') {
      r.setTexture('redbok_09').setAngle(-80);
      fitSprite(r, 170);
      const z = this.add.text(cx + 90, SCENE_Y - 80, 'Z z z', outlinedTextStyle(34, COLORS.sky));
      this.stage.add(z);
      this.tweens.add({ targets: z, y: SCENE_Y - 120, alpha: 0.3, duration: 1000, yoyo: true, repeat: -1 });
    } else {
      r.setTexture('redbok_10');
      fitSprite(r, 170);
      this.tweens.add({ targets: r, angle: { from: -15, to: 15 }, duration: 260, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: r, scaleY: r.scaleY * 0.9, duration: 130, yoyo: true, repeat: -1 });
    }
    speak('What is Redbok doing?');
    return { question: 'What is Redbok doing?', answer: verb, others: Phaser.Utils.Array.Shuffle(VERBS.filter((v) => v !== verb)) };
  }

  what() {
    const e = Phaser.Utils.Array.GetRandom(COUNTABLE);
    this.sprite(e.sprite, this.w / 2, SCENE_Y, 220);
    const article = (w) => (/^[aeiou]/.test(w) ? 'an' : 'a');
    const say = (w) => `It's ${article(w)} ${w}.`;
    const others = Phaser.Utils.Array.Shuffle(COUNTABLE.filter((x) => x.word !== e.word)).slice(0, 2).map((x) => say(x.word));
    speak('What is it?');
    return { question: 'What is it? Что это?', answer: say(e.word), others };
  }

  answer(opt) {
    if (this.locked) return;
    this.locked = true;
    const right = opt.text === this.answerText;
    if (right) this.points += 1;
    opt.button.setVariant(right ? 'good' : 'bad');
    if (!right) this.options.find((o) => o.text === this.answerText)?.button.setVariant('good');
    this.options.forEach((o) => o.button.setEnabled(false));
    speak(this.answerText);
    this.message.setText(right ? 'Верно!' : `Правильно: ${this.answerText}`);
    this.time.delayedCall(1800, () => this.next());
  }

  finish() {
    this.tweens.killAll();
    this.stage.removeAll(true);
    this.question.setText('');
    this.options.forEach((o) => o.button.setEnabled(false));
    const stars = Math.floor(this.points / 2);
    if (stars) addStars(stars);
    const record = submitRecord('phrase', this.points);
    arenaPlayed();
    this.score.setText(`Верно ${this.points}/${ROUNDS}${record ? ' — новый рекорд!' : ''}   +${stars} ★`);
    this.message.setText('');
    this.again.setVisible(true);
  }
}
