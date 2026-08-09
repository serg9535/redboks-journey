import os
import sys
import argparse
from google import genai
from google.genai import types

MODEL = "gemini-2.5-flash-image"  # "Nano Banana" — Imagen (predict-модели) закрыты для этого ключа


def generate_image(prompt: str, output_path: str, aspect_ratio: str = "1:1"):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Ошибка: Переменная GEMINI_API_KEY не найдена.")
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    print(f"Генерация ассета по запросу: '{prompt}'...")

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(aspect_ratio=aspect_ratio),
        ),
    )

    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(part.inline_data.data)
            print(f"Успешно сохранено: {output_path}")
            return

    raise RuntimeError(f"В ответе не найдено изображение: {response}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Автоматическая генерация ассетов для игры.")
    parser.add_argument("--prompt", required=True, help="Текстовое описание ассета")
    parser.add_argument("--out", required=True, help="Путь сохранения файла (например, assets/sprites/potion.png)")
    parser.add_argument("--ratio", default="1:1", help="Соотношение сторон (1:1, 16:9, 4:3 и т.д.)")

    args = parser.parse_args()
    generate_image(args.prompt, args.out, args.ratio)
