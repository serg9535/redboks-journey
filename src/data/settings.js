// Настройки игрока, сохраняются в localStorage (переживают перезагрузку страницы).
const SHOW_TRANSLATION_KEY = 'redbok_show_translation';

export function getShowTranslation() {
  try {
    const v = localStorage.getItem(SHOW_TRANSLATION_KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

export function setShowTranslation(value) {
  try {
    localStorage.setItem(SHOW_TRANSLATION_KEY, value ? '1' : '0');
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — настройка просто не сохранится
  }
}
