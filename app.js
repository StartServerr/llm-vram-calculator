(function () {
  'use strict';
  const calc = window.VramCalculator;
  const $ = (id) => document.getElementById(id);
  const fields = ['parametersBillions', 'layers', 'kvHeads', 'headDim', 'bitsPerWeight',
    'contextTokens', 'parallelRequests', 'kvBytes', 'runtimeReserve', 'gpuVram', 'gpuCount'];
  const formatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
  const whole = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  const format = (v) => formatter.format(v);
  let lastResult = null;

  function setPreset(key) {
    const p = calc.PRESETS[key];
    if (!p) return;
    ['parametersBillions', 'layers', 'kvHeads', 'headDim'].forEach((f) => { $(f).value = p[f]; });
  }

  function readInput() {
    const values = {};
    fields.forEach((f) => { values[f] = $(f).value; });
    return values;
  }

  function update() {
    try {
      const x = readInput();
      lastResult = calc.estimate(x);
      $('input-error').hidden = true;
      const r = lastResult;
      $('total-value').textContent = format(r.totalGiB);
      $('weights-value').textContent = format(r.weightsGiB) + ' GiB';
      $('kv-value').textContent = format(r.kvGiB) + ' GiB';
      $('runtime-value').textContent = format(r.runtimeGiB) + ' GiB';
      $('available-value').textContent = format(r.availableGiB) + ' GiB';
      $('slack-value').textContent = (r.slackGiB > 0 ? '+' : '') + format(r.slackGiB) + ' GiB';
      $('kv-token-value').textContent = format(r.kvPerTokenBytes / 1024) + ' KiB';
      $('tokens-value').textContent = whole.format(r.totalTokens);
      $('weights-bar').style.width = (100 * r.weightsGiB / r.totalGiB) + '%';
      $('kv-bar').style.width = (100 * r.kvGiB / r.totalGiB) + '%';
      $('runtime-bar').style.width = (100 * r.runtimeGiB / r.totalGiB) + '%';
      const status = $('fit-message');
      status.className = 'fit-message' + (r.status === 'headroom' ? '' : ' ' + r.status);
      $('fit-title').textContent = r.status === 'insufficient' ? 'Не хватает суммарной VRAM'
        : r.status === 'tight' ? 'По объёму помещается впритык'
        : 'По суммарному объёму есть запас';
      $('fit-description').textContent = (r.multiGPU
        ? 'Сравниваем только суммарный объём GPU. Нужны совместимый способ шардирования и проверка памяти на каждой карте.'
        : 'Это предварительная оценка. Проверяйте реальное потребление runtime и ограничения модели.')
        + (r.status === 'tight' ? ' Рекомендуется увеличить запас.' : '');
    } catch (e) {
      lastResult = null;
      $('input-error').textContent = e.message || 'Проверьте введённые значения';
      $('input-error').hidden = false;
      $('total-value').textContent = '—';
      ['weights-value', 'kv-value', 'runtime-value', 'available-value', 'slack-value',
        'kv-token-value', 'tokens-value'].forEach((id) => { $(id).textContent = '—'; });
      ['weights-bar', 'kv-bar', 'runtime-bar'].forEach((id) => { $(id).style.width = '0%'; });
      $('fit-title').textContent = 'Исправьте параметры';
      $('fit-description').textContent = 'Введите корректные положительные значения.';
    }
  }

  $('preset').addEventListener('change', function () {
    setPreset(this.value);
    update();
  });
  const architecture = ['parametersBillions', 'layers', 'kvHeads', 'headDim'];
  architecture.forEach((id) => $(id).addEventListener('input', () => {
    // Changing architecture switches the selector to "custom" without overwriting edits.
    $('preset').value = 'custom';
    update();
  }));
  $('precision').addEventListener('change', function () {
    if (this.value !== 'custom') $('bitsPerWeight').value = this.value;
    update();
  });
  $('bitsPerWeight').addEventListener('input', () => {
    $('precision').value = 'custom';
    update();
  });
  fields.filter((f) => !architecture.includes(f) && f !== 'bitsPerWeight').forEach((f) => $(f).addEventListener('input', update));
  $('reset-button').addEventListener('click', () => {
    $('preset').value = 'qwen32';
    setPreset('qwen32');
    $('precision').value = '4.8';
    $('bitsPerWeight').value = '4.8';
    $('contextTokens').value = '8192';
    $('parallelRequests').value = '1';
    $('kvBytes').value = '2';
    $('runtimeReserve').value = '3';
    $('gpuVram').value = '48';
    $('gpuCount').value = '1';
    update();
  });
  $('copy-button').addEventListener('click', async () => {
    if (!lastResult) return;
    const x = readInput();
    const r = lastResult;
    const model = $('preset').selectedOptions[0].text;
    const summary = `LLM VRAM Calculator — Start Server\nМодель: ${model}\nВеса: ${format(r.weightsGiB)} GiB` +
      `\nKV-cache: ${format(r.kvGiB)} GiB\nРезерв runtime: ${format(r.runtimeGiB)} GiB` +
      `\nВсего: ${format(r.totalGiB)} GiB\nGPU: ${x.gpuCount} × ${x.gpuVram} GiB` +
      `\nКонтекст: ${x.contextTokens}; запросов: ${x.parallelRequests}; BPW: ${x.bitsPerWeight}` +
      '\nОценка, не гарантия фактического размещения.';
    const button = $('copy-button');
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(summary);
      else {
        const el = document.createElement('textarea'); el.value = summary; el.style.position = 'fixed';
        document.body.appendChild(el); el.select();
        if (!document.execCommand('copy')) throw new Error('Copy not supported');
        el.remove();
      }
      button.textContent = 'Скопировано ✓';
    } catch (_err) { button.textContent = 'Не удалось скопировать'; }
    window.setTimeout(() => { button.textContent = 'Скопировать расчёт ↗'; }, 1900);
  });
  const cfg = window.START_SERVER_CONFIG || {};
  if (typeof cfg.telegramUrl === 'string' && /^https:\/\/t\.me\/[A-Za-z0-9_+/-]+$/.test(cfg.telegramUrl)) {
    $('telegram-link').href = cfg.telegramUrl;
    $('telegram-link').hidden = false;
    $('telegram-note').hidden = true;
  }
  if (typeof cfg.websiteUrl === 'string' && /^https:\/\//.test(cfg.websiteUrl)) $('website-link').href = cfg.websiteUrl;
  setPreset('qwen32');
  update();
})();
