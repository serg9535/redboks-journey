// Задание дня от Старейшины Мосса: одно на день (по дате), прогресс — счётчик
// событий type, который копят сцены через bumpDaily (progress.js):
// answers — верные ответы в бою; wins — побеждённые монстры; arena — сыгранные игры Арены.
import { addStars, getDaily, setDaily } from './progress.js';

export const DAILY_TASKS = [
  { type: 'answers', goal: 15, text: 'дай 15 верных ответов в бою' },
  { type: 'wins', goal: 5, text: 'победи 5 монстров' },
  { type: 'arena', goal: 3, text: 'сыграй 3 игры на Арене' },
  { type: 'answers', goal: 25, text: 'дай 25 верных ответов в бою' },
  { type: 'wins', goal: 8, text: 'победи 8 монстров' },
];
const REWARD = 6;

// Сегодняшнее задание (создаётся при первом обращении за день).
export function todayDaily() {
  const date = new Date().toDateString();
  let d = getDaily();
  if (!d || d.date !== date) {
    const dayIndex = Math.floor(Date.now() / 86400000) % DAILY_TASKS.length;
    const task = DAILY_TASKS[dayIndex];
    d = { date, type: task.type, goal: task.goal, text: task.text, count: 0, done: false };
    setDaily(d);
  }
  return d;
}

// Реплики Старейшины про задание дня; выполненное сдаётся с наградой один раз.
export function talkDaily() {
  const d = todayDaily();
  if (d.done) return ['Задание дня выполнено! Приходи завтра за новым.'];
  if (d.count >= d.goal) {
    setDaily({ ...d, done: true });
    addStars(REWARD);
    return [`Ты справился с заданием дня! Держи ${REWARD} ★`];
  }
  return [`Задание дня: ${d.text}. Уже ${Math.min(d.count, d.goal)} из ${d.goal}. Награда — ${REWARD} ★`];
}

export const dailyReady = () => {
  const d = todayDaily();
  return !d.done && d.count >= d.goal;
};
