import Phaser from 'phaser';
import { addStars, getRecord, submitRecord } from '../data/progress.js';
import { COLORS, fitSprite, outlinedTextStyle } from '../ui/theme.js';
import { Button, drawSpeakerIcon } from '../ui/widgets.js';
import { speak } from '../ui/speech.js';
import { againButton, arenaPlayed, buildOverlay } from '../ui/overlay.js';

// Команды «телом»: ребёнок выполняет их вживую, вне экрана.
const COMMANDS = [
  { en: 'touch your nose', ru: 'дотронься до носа' },
  { en: 'touch your ears', ru: 'дотронься до ушей' },
  { en: 'touch your head', ru: 'дотронься до головы' },
  { en: 'close your eyes', ru: 'закрой глаза' },
  { en: 'open your mouth', ru: 'открой рот' },
  { en: 'clap your hands', ru: 'хлопни в ладоши' },
  { en: 'stamp your feet', ru: 'потопай ногами' },
  { en: 'touch your tummy', ru: 'дотронься до животика' },
  { en: 'jump', ru: 'прыгни' },
  { en: 'sit down', ru: 'сядь' },
  { en: 'stand up', ru: 'встань' },
  { en: 'turn around', ru: 'повернись кругом' },
  { en: 'wave your hand', ru: 'помаши рукой' },
];
const ROUNDS = 12;
const SIMON_CHANCE = 0.65;

// «Саймон говорит» (Simon Says) — зарядка и тормозной контроль одновременно:
// команда со словами «Simon says» — выполни и нажми «Сделал!»; без них — НЕ делай
// и нажми «Стою!». Выполнение проверяет взрослый рядом, игра проверяет только выбор.
export class SimonSaysScene extends Phaser.Scene {
  constructor() {
    super('SimonSays');
  }

  create() {
    Object.assign(this, buildOverlay(this, 'Саймон говорит'));
    this.add.text(this.w / 2, 96, 'Если «Simon says» — делай! Если нет — стой!', outlinedTextStyle(22)).setOrigin(0.5);
    this.simon = fitSprite(this.add.image(this.w / 2, 230, 'redbok_00'), 170);
    this.cmdText = this.add.text(this.w / 2, 360, '', outlinedTextStyle(36, COLORS.sun, { align: 'center', wordWrap: { width: 820 } })).setOrigin(0.5);
    this.ruText = this.add.text(this.w / 2, 405, '', outlinedTextStyle(20)).setOrigin(0.5);
    new Button(this, {
      x: this.w / 2 + 330,
      y: 230,
      width: 90,
      height: 60,
      variant: 'info',
      icon: (g, cx, cy, color) => drawSpeakerIcon(g, cx, cy, color, 26),
      onClick: () => this.say(),
    });
    this.didBtn = new Button(this, { x: this.w / 2 - 150, y: 490, width: 260, height: 74, label: 'Сделал!', fontSize: 28, variant: 'good', onClick: () => this.answer(true) });
    this.stayBtn = new Button(this, { x: this.w / 2 + 150, y: 490, width: 260, height: 74, label: 'Стою!', fontSize: 28, variant: 'info', onClick: () => this.answer(false) });
    this.again = againButton(this, () => this.start());
    this.start();
  }

  start() {
    this.again.setVisible(false);
    this.round = 0;
    this.points = 0;
    this.next();
  }

  say() {
    speak(this.simonSays ? `Simon says, ${this.cmd.en}!` : `${this.cmd.en}!`);
  }

  next() {
    if (this.closed) return;
    if (this.round >= ROUNDS) return this.finish();
    this.round += 1;
    this.cmd = Phaser.Utils.Array.GetRandom(COMMANDS);
    this.simonSays = Math.random() < SIMON_CHANCE;
    this.cmdText.setText(`${this.simonSays ? 'Simon says: ' : ''}${this.cmd.en}!`.toUpperCase());
    this.ruText.setText(this.cmd.ru);
    this.simon.setTexture(this.simonSays ? 'redbok_10' : 'redbok_00');
    fitSprite(this.simon, 170);
    this.tweens.add({ targets: this.simon, y: 215, duration: 200, yoyo: true });
    this.didBtn.setEnabled(true).setVariant('good');
    this.stayBtn.setEnabled(true).setVariant('info');
    this.locked = false;
    this.score.setText(`Раунд ${this.round}/${ROUNDS}   Верно ${this.points}   Рекорд ${getRecord('simon')}`);
    this.message.setText('');
    this.say();
  }

  answer(did) {
    if (this.locked) return;
    this.locked = true;
    const right = did === this.simonSays;
    if (right) this.points += 1;
    (did ? this.didBtn : this.stayBtn).setVariant(right ? 'good' : 'bad');
    (did ? this.stayBtn : this.didBtn).setEnabled(false);
    this.message.setText(right ? 'Молодец!' : this.simonSays ? 'Саймон сказал — надо было делать!' : 'Саймон не говорил — надо было стоять!');
    if (!right) this.cameras.main.shake(120, 0.006);
    this.time.delayedCall(1400, () => this.next());
  }

  finish() {
    const stars = Math.floor(this.points / 3);
    if (stars) addStars(stars);
    const record = submitRecord('simon', this.points);
    arenaPlayed();
    this.cmdText.setText('Отличная зарядка!');
    this.ruText.setText('');
    this.didBtn.setEnabled(false);
    this.stayBtn.setEnabled(false);
    this.score.setText(`Верно ${this.points}/${ROUNDS}${record ? ' — новый рекорд!' : ''}   +${stars} ★`);
    this.message.setText('');
    this.again.setVisible(true);
  }
}
