// FX-CORE-01 — a DOM-free, versioned curve contract. Source of truth for
// the offline editor, isolated PNG bake and both developer packages.
(function (root, create) {
  const api = Object.freeze(create());
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FxCurves = api;
})(globalThis, function () {
  'use strict';
  const VERSION = 1, MAX_KEYS = 64;
  const DOMAINS = ['effectTime', 'emitterTime', 'particleAge', 'pathPosition'];
  const INTERPOLATION = ['linear', 'stepped', 'bezier'];
  const UNIT_BY_DOMAIN = {
    effectTime: ['seconds', 'normalized-duration'],
    emitterTime: ['seconds', 'normalized-duration'],
    particleAge: ['seconds', 'normalized-lifetime'],
    pathPosition: ['pixels', 'normalized-path']
  };
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const within = (value, min, max) => Math.max(min, Math.min(max, value));
  function fail(message) { throw new TypeError('Invalid FX curve: ' + message); }
  function checkKeys(value, allowed, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' must be an object');
    for (const name of Object.keys(value)) if (!allowed.includes(name)) fail('unknown ' + label + ' property: ' + name);
  }
  function vec(value, label) {
    if (!Array.isArray(value) || value.length !== 2 || !value.every(finite)) fail(label + ' must be a finite [x,y]');
    return value.slice();
  }
  function normalize(input) {
    checkKeys(input, ['schemaVersion', 'parameterKey', 'domain', 'inputUnit', 'valueUnit',
      'inputRange', 'valueRange', 'defaultValue', 'clamp', 'monotonic', 'keys'], 'curve');
    if (input.schemaVersion !== VERSION) fail('unsupported schemaVersion');
    if (typeof input.parameterKey !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/.test(input.parameterKey))
      fail('parameterKey must be a stable identifier');
    if (!DOMAINS.includes(input.domain)) fail('unknown domain');
    if (!UNIT_BY_DOMAIN[input.domain].includes(input.inputUnit)) fail('incompatible inputUnit for domain');
    if (typeof input.valueUnit !== 'string' || !/^[\w%/.-]{1,32}$/.test(input.valueUnit)) fail('invalid valueUnit');
    const inputRange = vec(input.inputRange, 'inputRange'), valueRange = vec(input.valueRange, 'valueRange');
    if (!(inputRange[1] > inputRange[0]) || !(valueRange[1] > valueRange[0])) fail('invalid range');
    if (input.inputUnit.startsWith('normalized-') && (inputRange[0] !== 0 || inputRange[1] !== 1))
      fail('normalized input must span [0,1]');
    if (!finite(input.defaultValue) || input.defaultValue < valueRange[0] || input.defaultValue > valueRange[1])
      fail('defaultValue is outside valueRange');
    if (!['hold', 'default'].includes(input.clamp)) fail('clamp must be hold or default');
    if (typeof input.monotonic !== 'boolean') fail('monotonic must be boolean');
    if (!Array.isArray(input.keys) || input.keys.length < 2 || input.keys.length > MAX_KEYS)
      fail('curve needs 2–64 keys');
    const ids = new Set();
    const keys = input.keys.map((k, index) => {
      checkKeys(k, ['id', 'x', 'y', 'mode', 'in', 'out'], 'key');
      if (typeof k.id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(k.id) || ids.has(k.id))
        fail('key IDs must be distinct stable identifiers');
      ids.add(k.id);
      if (!finite(k.x) || !finite(k.y)) fail('nonfinite key coordinate');
      if (k.x < inputRange[0] || k.x > inputRange[1] ||
          k.y < valueRange[0] || k.y > valueRange[1]) fail('key outside range');
      if (!INTERPOLATION.includes(k.mode)) fail('unsupported interpolation');
      if (index && !(k.x > input.keys[index - 1].x)) fail('keys must have strictly increasing x');
      const key = { id: k.id, x: k.x, y: k.y, mode: k.mode };
      if (k.in !== undefined && k.in !== null) key.in = vec(k.in, k.id + '.in');
      if (k.out !== undefined && k.out !== null) key.out = vec(k.out, k.id + '.out');
      return key;
    });
    if (keys[0].x !== inputRange[0] || keys[keys.length - 1].x !== inputRange[1])
      fail('keys must cover the input range exactly');
    if (input.parameterKey === 'transitionProgress' && (keys[0].y !== 0 || keys[keys.length - 1].y !== 1))
      fail('transitionProgress must begin at 0 and finish at 1');
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (input.monotonic && a.y > b.y) fail('time-warp keys must be nondecreasing');
      if (a.mode === 'bezier') {
        if (!a.out || !b.in) fail('bezier segments require outgoing/incoming handles');
        if (a.out[0] < a.x || a.out[0] > b.x || b.in[0] < a.x ||
            b.in[0] > b.x || a.out[0] > b.in[0])
          fail('Bezier x handles must be ordered inside their segment');
        for (const val of [a.out[1], b.in[1]])
          if (val < valueRange[0] || val > valueRange[1]) fail('Bezier y handle out of range');
        if (input.monotonic && !(a.y <= a.out[1] && a.out[1] <= b.in[1] && b.in[1] <= b.y))
          fail('time-warp Bezier handles must be nondecreasing');
      }
    }
    return {
      schemaVersion: VERSION, parameterKey: input.parameterKey, domain: input.domain,
      inputUnit: input.inputUnit, valueUnit: input.valueUnit, inputRange, valueRange,
      defaultValue: input.defaultValue, clamp: input.clamp,
      monotonic: input.monotonic, keys
    };
  }
  function bezier(a, b, c, d, t) {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  }
  function evaluate(input, x) {
    const c = normalize(input);
    if (!finite(x)) fail('evaluation position must be finite');
    const keys = c.keys, first = keys[0], last = keys[keys.length - 1];
    if (x <= first.x) return c.clamp === 'hold' ? first.y : c.defaultValue;
    if (x >= last.x) return c.clamp === 'hold' ? last.y : c.defaultValue;
    let lo = 0, hi = keys.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (keys[mid].x <= x) lo = mid; else hi = mid;
    }
    const a = keys[lo], b = keys[lo + 1];
    if (a.mode === 'stepped') return a.y;
    const t = (x - a.x) / (b.x - a.x);
    if (a.mode === 'linear') return a.y + (b.y - a.y) * t;
    let left = 0, right = 1;
    for (let i = 0; i < 36; i++) {
      const mid = (left + right) / 2;
      if (bezier(a.x, a.out[0], b.in[0], b.x, mid) < x) left = mid;
      else right = mid;
    }
    const value = bezier(a.y, a.out[1], b.in[1], b.y, (left + right) / 2);
    return within(value, c.valueRange[0], c.valueRange[1]);
  }
  const K = (id, x, y, mode = 'linear', incoming, outgoing) => {
    const key = { id, x, y, mode };
    if (incoming) key.in = incoming;
    if (outgoing) key.out = outgoing;
    return key;
  };
  const PRESETS = Object.freeze(['linear', 'easeIn', 'easeOut', 'easeInOut',
    'fastAttack', 'slowDecay', 'pulse', 'burst']);
  function createPreset(name, options = {}) {
    if (!PRESETS.includes(name)) fail('unknown preset: ' + name);
    const specs = {
      linear: [K('start', 0, 0), K('end', 1, 1)],
      easeIn: [K('start', 0, 0, 'bezier', null, [.42, 0]), K('end', 1, 1, 'linear', [1, 1])],
      easeOut: [K('start', 0, 0, 'bezier', null, [0, 0]), K('end', 1, 1, 'linear', [.58, 1])],
      easeInOut: [K('start', 0, 0, 'bezier', null, [.42, 0]), K('end', 1, 1, 'linear', [.58, 1])],
      fastAttack: [K('start', 0, 0, 'bezier', null, [.04, .75]), K('end', 1, 1, 'linear', [.55, 1])],
      slowDecay: [K('start', 0, 1, 'bezier', null, [.18, .98]), K('end', 1, 0, 'linear', [.77, .02])],
      pulse: [K('start', 0, 0), K('peak', .5, 1), K('end', 1, 0)],
      burst: [K('start', 0, 0, 'stepped'), K('burst', .12, 1, 'stepped'),
        K('decay', .35, .6), K('end', 1, 0)]
    };
    const increasing = !['slowDecay', 'pulse', 'burst'].includes(name);
    const monotonic = options.monotonic === undefined ? increasing : options.monotonic;
    const inputRange = options.inputRange || [0, 1], valueRange = options.valueRange || [0, 1];
    const mapX = x => inputRange[0] + x * (inputRange[1] - inputRange[0]);
    const mapY = y => valueRange[0] + y * (valueRange[1] - valueRange[0]);
    const keys = specs[name].map(k => {
      const next = { id: k.id, x: mapX(k.x), y: mapY(k.y), mode: k.mode };
      if (k.in) next.in = [mapX(k.in[0]), mapY(k.in[1])];
      if (k.out) next.out = [mapX(k.out[0]), mapY(k.out[1])];
      return next;
    });
    return normalize({
      schemaVersion: VERSION,
      parameterKey: options.parameterKey || 'value',
      domain: options.domain || 'effectTime',
      inputUnit: options.inputUnit || 'normalized-duration',
      valueUnit: options.valueUnit || 'normalized',
      inputRange, valueRange,
      defaultValue: options.defaultValue ?? valueRange[0],
      clamp: options.clamp || 'hold', monotonic, keys
    });
  }
  function serialize(curve) { return JSON.stringify(normalize(curve)); }
  function deserialize(json) {
    if (typeof json !== 'string') fail('serialized curve must be JSON text');
    let parsed;
    try { parsed = JSON.parse(json); } catch { fail('invalid JSON'); }
    return normalize(parsed);
  }
  function sample(curve, positions) {
    if (!Array.isArray(positions)) fail('positions must be an array');
    return positions.map(p => evaluate(curve, p));
  }
  return { VERSION, PRESETS, normalize, evaluate, createPreset, serialize, deserialize, sample };
});
