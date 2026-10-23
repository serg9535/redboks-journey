// Произношение английских слов через Web Speech API (встроен в браузер,
// работает офлайн на Android/iOS). Этап Presentation из брифа: картинка + слово + озвучка.
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text) {
  if (!canSpeak || !text) return;
  const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
  utterance.lang = 'en-US';
  utterance.rate = 0.8;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith('en'));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

// Английские слова в репликах NPC пишутся ЗАГЛАВНЫМИ (см. npcs.js) — их и озвучиваем.
export function englishWordsIn(line) {
  return line.match(/\b[A-Z]{2,}\b/g) ?? [];
}
