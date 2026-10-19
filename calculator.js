/**
 * LLM VRAM Calculator — compact, dependency-free estimation engine.
 * Copyright 2026 contributors. MIT License.
 *
 * Estimates assume dense autoregressive attention (MHA/GQA) with standard K/V tensors.
 * Not a profiler; special architectures (MLA, MoE, sliding window, etc.) need own models.
 */
(function (root, factory) {
  'use strict';
  const calculator = factory();
  if (typeof module === 'object' && module.exports) module.exports = calculator;
  if (root) root.VramCalculator = calculator;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const GIB = 1024 ** 3;

  const PRESETS = Object.freeze({
    qwen32: Object.freeze({
      title: 'Qwen2.5-32B-Instruct',
      parametersBillions: 32.8,
      layers: 64,
      kvHeads: 8,
      headDim: 128,
      maxContext: 32768,
      configUrl: 'https://huggingface.co/Qwen/Qwen2.5-32B-Instruct/blob/main/config.json'
    }),
    llama70: Object.freeze({
      title: 'Llama-3.3-70B-Instruct',
      parametersBillions: 70.6,
      layers: 80,
      kvHeads: 8,
      headDim: 128,
      maxContext: 131072,
      configUrl: 'https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct/blob/main/config.json'
    })
  });

  function requirePositiveNumber(value, name, max = 1e9) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0 || n > max) throw new RangeError(name + ': укажите положительное число');
    return n;
  }

  function estimate(input) {
    if (!input || typeof input !== 'object') throw new TypeError('Не заданы параметры модели');
    const parametersBillions = requirePositiveNumber(input.parametersBillions, 'Параметры', 10000);
    const bitsPerWeight = requirePositiveNumber(input.bitsPerWeight, 'Бит на вес', 32);
    const layers = requirePositiveNumber(input.layers, 'Число слоёв', 10000);
    const kvHeads = requirePositiveNumber(input.kvHeads, 'KV-головы', 100000);
    const headDim = requirePositiveNumber(input.headDim, 'Размерность головы', 100000);
    const contextTokens = requirePositiveNumber(input.contextTokens, 'Контекст', 10000000);
    const parallelRequests = requirePositiveNumber(input.parallelRequests, 'Число запросов', 100000);
    const kvBytes = requirePositiveNumber(input.kvBytes, 'Байт на KV-элемент', 8);
    const runtimeReserve = Number(input.runtimeReserve);
    if (!Number.isFinite(runtimeReserve) || runtimeReserve < 0 || runtimeReserve > 10000)
      throw new RangeError('Резерв runtime: укажите число от 0 до 10 000');
    const gpuCount = requirePositiveNumber(input.gpuCount, 'Число GPU', 128);
    const gpuVram = requirePositiveNumber(input.gpuVram, 'VRAM на GPU', 10000);
    if (![layers, kvHeads, headDim, contextTokens, parallelRequests, gpuCount].every(Number.isInteger))
      throw new RangeError('Архитектура, токены, число запросов и GPU должны быть целыми числами');

    // parametersB * 1e9 × effective bits-per-weight / 8 = total bytes.
    // Effective BPW can reflect metadata / per-group scale overhead for quantized weights.
    const weightsGiB = (parametersBillions * 1e9 * bitsPerWeight / 8) / GIB;
    // Standard GQA/MHA cache with a complete context for each concurrent request.
    // 2 = K and V; this is NOT appropriate for MLA, sparse KV or special attention.
    const kvGiB = (2 * layers * kvHeads * headDim * contextTokens * parallelRequests * kvBytes) / GIB;
    const totalGiB = weightsGiB + kvGiB + runtimeReserve;
    const availableGiB = gpuCount * gpuVram;
    const slackGiB = availableGiB - totalGiB;
    const share = totalGiB / availableGiB;
    const status = share > 1 ? 'insufficient' : share > 0.85 ? 'tight' : 'headroom';
    return { weightsGiB, kvGiB, runtimeGiB: runtimeReserve, totalGiB, availableGiB, slackGiB,
      share, status, kvPerTokenBytes: 2 * layers * kvHeads * headDim * kvBytes,
      totalTokens: contextTokens * parallelRequests,
      multiGPU: gpuCount > 1 };
  }

  return Object.freeze({ PRESETS, estimate, GIB });
});
