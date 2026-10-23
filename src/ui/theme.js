// Единый визуальный стиль UI: тёплые «конфетные» цвета под чиби пиксель-арт
// (тёмная сливовая обводка — как контур у спрайтов) вместо тёмно-синих плашек.
export const FONT = '"Nunito", "Trebuchet MS", system-ui, sans-serif';

export const COLORS = {
  ink: 0x2d1e3e,
  cream: 0xfff6e0,
  creamShade: 0xe9d3a8,
  sun: 0xffc93c,
  sunShade: 0xd99a14,
  leaf: 0x7bc950,
  leafShade: 0x4c932c,
  berry: 0xe8553e,
  berryShade: 0xa93421,
  sky: 0x6ec6ff,
  skyShade: 0x3889c4,
  grey: 0xc9c2d3,
  greyShade: 0x8f86a0,
  night: 0x1b1530,
};

export const hex = (color) => `#${color.toString(16).padStart(6, '0')}`;

export function textStyle(size = 20, color = COLORS.ink, extra = {}) {
  return {
    fontFamily: FONT,
    fontStyle: '800',
    fontSize: `${size}px`,
    color: hex(color),
    ...extra,
  };
}

// Светлый текст поверх картинки/фона — с толстой обводкой, чтобы читался на любом биоме.
export function outlinedTextStyle(size = 20, color = COLORS.cream, extra = {}) {
  return textStyle(size, color, { stroke: hex(COLORS.ink), strokeThickness: Math.max(3, Math.round(size / 5)), ...extra });
}

// Спрайты нарезаны из генераций разного разрешения (200–512 px) — масштабируем
// по целевому размеру, а не фиксированным коэффициентом, иначе персонажи
// одного «роста» на экране получаются разного размера.
export function fitSprite(image, size) {
  const src = Math.max(image.width, image.height);
  return image.setScale(size / src);
}
