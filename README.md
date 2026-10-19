# LLM VRAM Calculator · Start Server

**Бесплатный калькулятор VRAM для инференса LLM.** Помогает примерно оценить память под веса модели, KV-cache, runtime и сопоставить расчёт с суммарным объёмом GPU.

> **📲 Telegram Start Server:** [https://t.me/start_server](https://t.me/start_server) — новые технические разборы GPU, LLM и AI-инфраструктуры.

**Free LLM inference VRAM estimator:** weights + KV cache + runtime overhead, with architecture presets for Qwen2.5 32B and Llama 3.3 70B. Works as a dependency-free static web page.

> ⚠️ Оценки — **не гарантии размещения или производительности**. Калькулятор моделирует стандартный dense MHA/GQA KV-cache и не подходит без адаптации для MLA, MoE, sliding-window, CPU offload и нестандартных механизмов внимания. При multi-GPU нельзя просто суммировать VRAM без проверки шардирования и распределения слоёв.

## Возможности / Features

- Пресеты **Qwen2.5-32B-Instruct** и **Llama 3.3 70B** с параметрами архитектуры из `config.json`.
- Пользовательские архитектуры (число слоёв, KV-heads, head dimension, число параметров).
- Выбор бит на вес: 16, ~8.2, ~4.8 или произвольное **эффективное BPW**.
- KV-cache с учётом токенов на запрос, параллельных запросов и BF16/FP16 или FP8.
- Редактируемый запас на runtime/буферы.
- Сравнение с GPU-конфигурацией и копирование результата.
- Без сбора данных, зависимостей, API или сервера; работает в браузере и на GitHub Pages.

## Запуск локально

Скачайте репозиторий и откройте `index.html` в браузере. Для локального HTTP-просмотра:

```bash
python3 -m http.server 8000
```

Затем откройте `http://localhost:8000`. Установка пакетов не нужна.

## Развернуть на GitHub Pages

1. Создайте публичный репозиторий `llm-vram-calculator` от имени компании или команды.
2. Загрузите все файлы **в корень** репозитория, включая `.nojekyll`.
3. Откройте **Settings → Pages → Build and deployment → Deploy from a branch**.
4. Выберите ветку `main` и папку `/(root)`, сохраните настройки.
5. GitHub покажет ссылку на работающий калькулятор после публикации.

[Официальная инструкция GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Telegram Start Server

👉 **[Подписаться на Telegram-канал Start Server](https://t.me/start_server)** — инженерные разборы GPU-серверов, LLM, AI-кластеров и оборудования.

На странице калькулятора кнопка «Читать Start Server в Telegram» уже настроена через `config.js` и ведёт на тот же канал:

```js
window.START_SERVER_CONFIG = {
  telegramUrl: 'https://t.me/start_server',
  websiteUrl: 'https://start-server.ru/'
};
```

## Методика расчёта

Все величины памяти выводятся в **GiB**, а не десятичных GB.

```text
weights_GiB = parameters_billions × 10^9 × effective_BPW / 8 / 2^30
kv_GiB = 2 × layers × kv_heads × head_dim × context_tokens × concurrent_requests × KV_bytes / 2^30
total_GiB = weights_GiB + kv_GiB + runtime_reserve_GiB
```

Эффективное BPW для некоторых форматов квантизации превышает номинальные 4 или 8 бит из-за метаданных. Значения 4.8 и 8.2 **только иллюстративные**, для точного расчёта введите BPW конкретного файла/формата. Runtime по умолчанию 3 GiB — **условный резерв**, не результат замера.

В таблице GPU условно сравниваются *суммарная* VRAM и *суммарная* оценка потребления. Зелёный статус не означает подтверждённый запуск. Важны пиковое потребление, распределение модели, бэкенд, фрагментация памяти и требуемая пропускная способность.

### Параметры пресетов

| Preset | Params (approx.) | Layers | KV heads | Head dim |
|---|---:|---:|---:|---:|
| Qwen2.5-32B-Instruct | 32.8B | 64 | 8 | 128 |
| Llama 3.3 70B | 70.6B | 80 | 8 | 128 |

Architecture sources: [Qwen2.5 config](https://huggingface.co/Qwen/Qwen2.5-32B-Instruct/blob/main/config.json), [Llama 3.3 config](https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct/blob/main/config.json). Memory behavior/reference: [vLLM KV-cache interface](https://docs.vllm.ai/en/latest/api/vllm/v1/kv_cache_interface/).

## Тесты

Требуется Node.js 18+. Проверка:

```bash
npm test
```

Пакеты для тестирования не устанавливаются: используется встроенный `node:test`.

## Что ещё можно добавить

- Сопоставление с реальными измерениями vLLM / llama.cpp для конкретных GPU.
- Отдельный расчёт prefill/decode, throughput и KV-sharing.
- Модель распределения по GPU по типу tensor/pipeline parallelism.
- Импорт архитектуры из вручную загруженного `config.json`.

---

Создан для технического сообщества **Start Server** · [сайт компании](https://start-server.ru/).

Licensed under MIT. Contributions and corrections are welcome.
