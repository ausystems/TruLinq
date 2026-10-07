/* The ink wash: a slow mesh of the brand's blue tints moving under a panel, the way ink drifts through wet paper.
   One full-screen triangle in WebGL. Every colour is a soft point that wanders on its own slow loop; the paper between
   them bends with two long waves and turns a little around one spot, and each pixel takes the colours of the points
   near it, weighted by a gaussian (a softmax over distance), so there are no seams. It is all soft gradient, so it is
   rendered small and scaled up, dithered by one step so the pale tints never band, drawn at most 30 times a second and
   only while it can be seen. The caller decides whether it moves (`play`) or holds one moment (`draw`).
   Wherever small text sits (`keep`), the ink is held to a limit measured as relative luminance, in linear light, so the
   text keeps its contrast whatever drifts past: on light paper a floor it may not darken below, at night (`limit`) a
   ceiling it may not brighten above, for the light text there. The edge of each zone is feathered. */

const VERT = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0., 1.); }';
const N = 10, K = 4;
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;
uniform vec2 u_span;
uniform vec3 u_col[${N}];
uniform vec2 u_pos[${N}];
uniform vec2 u_sz[${N}];
uniform vec4 u_ph;
uniform vec4 u_sw;
uniform vec2 u_warp;
uniform vec4 u_keep[${K}];
uniform vec3 u_floor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 at = vec2(uv.x, 1. - uv.y) * u_span;
  vec2 p = at;
  vec2 k = p * u_warp.y;
  p.x += u_warp.x * (sin(k.y * 2.1 + u_ph.x) + .5 * sin(k.y * 3.7 - u_ph.y));
  p.y += u_warp.x * (cos(k.x * 1.8 + u_ph.z) + .5 * cos(k.x * 3.3 - u_ph.w));
  vec2 d = p - u_sw.xy;
  float a = u_sw.z * exp(-dot(d, d) * u_sw.w), s = sin(a), c = cos(a);
  p = u_sw.xy + vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  float e[${N}];
  float m = -1e4;
  for (int i = 0; i < ${N}; i++) { vec2 q = p - u_pos[i]; e[i] = u_sz[i].y - dot(q, q) * u_sz[i].x; m = max(m, e[i]); }
  vec3 col = vec3(0.);
  float sum = 0.;
  for (int i = 0; i < ${N}; i++) { float w = exp(e[i] - m); col += u_col[i] * w; sum += w; }
  col /= sum;
  float keep = 0.;
  for (int i = 0; i < ${K}; i++) {
    vec2 o = max(max(u_keep[i].xy - at, at - u_keep[i].zw), 0.);
    float r = length(o) / u_floor.y;
    keep = max(keep, exp(-r * r));
  }
  if (keep > 0.) {
    vec3 lin = pow((col + .055) / 1.055, vec3(2.4));
    float lum = dot(lin, vec3(.2126, .7152, .0722));
    if (u_floor.z > 0.) lin = mix(lin, vec3(1.), keep * clamp((u_floor.x - lum) / max(1. - lum, 1e-4), 0., 1.));
    else lin *= mix(1., min(1., u_floor.x / max(lum, 1e-4)), keep);
    col = 1.055 * pow(lin, vec3(1. / 2.4)) - .055;
  }
  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));
  gl_FragColor = vec4(col + (n - .5) / 255., 1.);
}`;

/* '#E6EFFD' (or a token holding one) to [r, g, b] in 0..1 */
export function rgb(hex) {
  const h = String(hex).trim().replace('#', '');
  const v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(v)) return null;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
}

/* layout: { points: [{ color: [r, g, b], x, y (0..1 of the panel, y down), ax, ay (how far it drifts, in units of
   the panel's short side), fx, fy (how fast, radians a second), size (short-side units), bias }], swirl: { x, y
   (0..1), angle (radians at its heart), reach (how fast the turn fades with distance) } }. Up to ten points. */
export function createWash(canvas, { layout, warp = .035, waves = 1, speed = 1, floor = .85, feather = 56, maxSide = 720 } = {}) {
  /* a floor (dir 1) on light paper; `limit` turns it into a ceiling (dir -1) at night */
  let limit = { to: floor, dir: 1 };
  const attrs = { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' };
  /* a context that would be drawn by the CPU still gets one still frame, but never a running loop */
  let gl = canvas.getContext('webgl', { ...attrs, failIfMajorPerformanceCaveat: true }), software = false;
  if (!gl) { gl = canvas.getContext('webgl', attrs); software = !!gl; }
  if (!gl) throw new Error('WebGL unavailable');

  let prog, loc = {}, ready = false;
  const compile = (type, src) => {
    const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(sh) || 'shader');
    return sh;
  };
  function init() {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(prog) || 'link');
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    ['u_res', 'u_span', 'u_col', 'u_pos', 'u_sz', 'u_ph', 'u_sw', 'u_warp', 'u_keep', 'u_floor'].forEach((k) => (loc[k] = gl.getUniformLocation(prog, k)));
    ready = true;
    setLayout(lay);
    setKeep(boxes);
  }

  /* boxes in CSS pixels of the canvas: [left, top, right, bottom]; unused slots sit far outside it */
  let boxes = [];
  function setKeep(list) {
    boxes = list.slice(0, K);
    if (!ready || !sized) return;
    const u = Math.min(canvas.clientWidth, canvas.clientHeight) || 1;
    const out = [];
    for (let i = 0; i < K; i++) { const b = boxes[i]; out.push(...(b ? b.map((v) => v / u) : [-9, -9, -8, -8])); }
    gl.uniform4fv(loc.u_keep, out);
    gl.uniform3f(loc.u_floor, limit.to, feather / u, limit.dir);
  }

  /* unused slots get a copy of the last point that weighs nothing */
  let lay = layout, pts = [], swirl = { x: .5, y: .5, angle: 0, reach: 3 };
  function setLayout(next) {
    lay = next;
    pts = next.points.slice(0, N);
    while (pts.length < N) pts.push({ ...pts[pts.length - 1], bias: -60 });
    swirl = next.swirl || swirl;
    if (!ready) return;
    gl.uniform3fv(loc.u_col, pts.flatMap((p) => p.color));
    gl.uniform2fv(loc.u_sz, pts.flatMap((p) => [1 / (p.size * p.size), p.bias || 0]));
  }

  /* sized from the element's box, which the caller reports when it changes */
  let span = [1, 1], sized = false;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const k = Math.min(1, maxSide / Math.max(w, h));
    const rw = Math.max(1, Math.round(w * k)), rh = Math.max(1, Math.round(h * k));
    if (canvas.width !== rw || canvas.height !== rh) { canvas.width = rw; canvas.height = rh; }
    span = w >= h ? [w / h, 1] : [1, h / w];
    sized = true;
    setKeep(boxes);
  }

  const TAU = Math.PI * 2, wrap = (v) => v % TAU;
  function draw(time) {
    if (!ready || !sized || gl.isContextLost()) return;
    const t = time * speed;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(loc.u_res, canvas.width, canvas.height);
    gl.uniform2f(loc.u_span, span[0], span[1]);
    gl.uniform2fv(loc.u_pos, pts.flatMap((p, i) => [
      p.x * span[0] + p.ax * Math.sin(wrap(t * p.fx + i * 1.3)),
      p.y * span[1] + p.ay * Math.cos(wrap(t * p.fy + i * 2.1))
    ]));
    gl.uniform4f(loc.u_ph, wrap(t * .23), wrap(t * .17), wrap(t * .19 + 1.1), wrap(t * .13 + 2.3));
    gl.uniform4f(loc.u_sw, swirl.x * span[0] + .05 * Math.sin(wrap(t * .07)), swirl.y * span[1] + .04 * Math.cos(wrap(t * .09)), swirl.angle * Math.sin(wrap(t * .05 + .8)), swirl.reach || 3);
    gl.uniform2f(loc.u_warp, warp, waves);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* the running loop: time only advances while it is drawn, so it never jumps after a pause */
  let raf = 0, on = false, t = 0, last = 0, lastDraw = 0;
  const FRAME = 1000 / 30;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (now - lastDraw < FRAME - 2) return;
    t += Math.min(now - (last || now), 100) / 1000;
    last = now; lastDraw = now;
    draw(t);
  }
  function play(yes) {
    const want = yes && !software;
    if (want === on) return;
    on = want;
    if (on) { last = 0; raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ready = false; cancelAnimationFrame(raf); canvas.dispatchEvent(new Event('washlost')); });
  canvas.addEventListener('webglcontextrestored', () => { init(); draw(t); if (on) { on = false; play(true); } canvas.dispatchEvent(new Event('washrestored')); });

  resize();
  init();
  return {
    draw: (at = t) => { t = at; draw(t); },
    play,
    setLayout: (next) => { setLayout(next); draw(t); },
    keep: (list) => { setKeep(list); draw(t); },
    limit: (to, dir) => { limit = { to, dir }; setKeep(boxes); draw(t); },
    resize: () => { resize(); draw(t); },
    get software() { return software; },
    get time() { return t; }
  };
}
