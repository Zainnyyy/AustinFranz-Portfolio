import { useEffect, useMemo, useRef, useState } from 'react'
import { Renderer, Program, Mesh, Triangle, RenderTarget, Texture } from 'ogl'
import useInView from '../hooks/useInView'
import { NAV, ROW1, ROW2, STATS, SERVICES, TOOLS, PROJECTS, TYPED, BABEL, EMAIL, FORM_URL, PROFILE } from '../data'
import { card } from '../ui'
import './MicroSlats.css'

function Reveal({ className = '', delay = 0, children }) {
  const [ref, seen] = useInView()
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`reveal ${seen ? 'in' : ''} ${className}`}>
      {children}
    </div>
  )
}

function SectionFrame({ id, no, label, tag, tagClass = 'bg-[#FACC15] text-gray-950', foot, right = 'ILOILO, PHILIPPINES', children }) {
  return (
    <section id={id} className="py-14 md:py-20 border-t-2 border-gray-950 grid-blueprint-bg bg-[#FAFAFA] overflow-hidden">
      <div className="max-w-[1700px] mx-auto px-2 sm:px-6">
        <Reveal className="relative bg-white border-2 border-gray-950 shadow-[12px_12px_0_0_rgba(0,0,0,.95)] p-5 sm:p-8 md:p-12">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 border-b-2 border-gray-950 font-mono text-xs uppercase font-black">
            <span className="bg-gray-950 text-white px-2.5 py-1 w-fit shadow-[2px_2px_0_0_#000]">{no} // {label}</span>
            <span className={`${tagClass} border border-gray-950 px-2.5 py-1 text-[10px] w-fit shadow-[2px_2px_0_0_#000] rotate-1`}>{tag}</span>
          </div>
          <div className="my-8 space-y-8">{children}</div>
          <div className="pt-4 border-t-2 border-gray-950 flex flex-col sm:flex-row justify-between items-center gap-3 font-mono text-[10px] sm:text-xs font-black uppercase">
            <span className="bg-gray-950 text-white px-2.5 py-0.5">{no} // {foot}</span>
            <span>{right}</span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function CountUp({ to, duration = 1400 }) {
  const [ref, seen] = useInView()
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!seen) return
    let raf; const t0 = performance.now()
    const f = now => {
      const p = Math.min((now - t0) / duration, 1)
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(f)
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [seen, to, duration])
  return <span ref={ref}>{n}</span>
}

'use client';

const SWELL_PRESETS = {
  swell: {
    scale: 1.5,
    speed: 0.6,
    direction: 250,
    chop: 0.55,
    stretch: 0,
    glint: 0.7,
    contrast: 1.25,
    perspective: 0.55,
    fog: 0.55
  },
  tide: {
    scale: 1.3,
    speed: 0.5,
    direction: 262,
    chop: 0.2,
    stretch: 0.12,
    glint: 0.45,
    contrast: 1.1,
    perspective: 0.5,
    fog: 0.4
  },
  storm: {
    scale: 0.55,
    speed: 1.6,
    direction: 236,
    chop: 1,
    stretch: 0.3,
    glint: 1.3,
    contrast: 1.8,
    perspective: 0.8,
    fog: 0.35
  },
  signal: {
    scale: 0.85,
    speed: 1.2,
    direction: 180,
    chop: 0.6,
    stretch: 0.85,
    glint: 0.25,
    contrast: 1.2,
    perspective: 0,
    fog: 0
  }
};

const FLUID_SIZE = 96;
const PRESSURE_STEPS = 16;
const SPLAT_FORCE = 6900;
const SPLASH_JETS = 3;
const PIXEL_BUDGET = 4.5e6;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const parseColor = (value, fallback) => {
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return fallback;
    ctx.fillStyle = '#000000';
    ctx.fillStyle = value;
    const resolved = ctx.fillStyle;
    if (resolved.startsWith('#')) {
      const n = parseInt(resolved.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
    }
    const parts = resolved.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return fallback;
    return [Number(parts[0]) / 255, Number(parts[1]) / 255, Number(parts[2]) / 255, parts[3] ? Number(parts[3]) : 1];
  } catch {
    return fallback;
  }
};

const passVertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fluidVertex = `#version 300 es
in vec2 position;
uniform vec2 uTexel;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
void main() {
  vUv = position * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0);
  vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y);
  vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fluidHead = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
`;

const splatFragment = `${fluidHead}
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec2 uPoint;
uniform vec3 uValue;
uniform float uRadius;
void main() {
  vec2 offset = vUv - uPoint;
  offset.x *= uAspect;
  float falloff = exp(-dot(offset, offset) / uRadius);
  fragColor = vec4(texture(uTarget, vUv).xyz + uValue * falloff, 1.0);
}
`;

const curlFragment = `${fluidHead}
uniform sampler2D uVelocity;
void main() {
  float left = texture(uVelocity, vL).y;
  float right = texture(uVelocity, vR).y;
  float top = texture(uVelocity, vT).x;
  float bottom = texture(uVelocity, vB).x;
  fragColor = vec4(0.5 * (right - left - top + bottom), 0.0, 0.0, 1.0);
}
`;

const vorticityFragment = `${fluidHead}
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uSwirl;
uniform float uDt;
void main() {
  float left = texture(uCurl, vL).x;
  float right = texture(uCurl, vR).x;
  float top = texture(uCurl, vT).x;
  float bottom = texture(uCurl, vB).x;
  float middle = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(top) - abs(bottom), abs(right) - abs(left));
  force = force / (length(force) + 0.0001) * uSwirl * middle;
  force.y = -force.y;
  vec2 velocity = texture(uVelocity, vUv).xy + force * uDt;
  fragColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
}
`;

const divergenceFragment = `${fluidHead}
uniform sampler2D uVelocity;
void main() {
  vec2 middle = texture(uVelocity, vUv).xy;
  float left = vL.x < 0.0 ? -middle.x : texture(uVelocity, vL).x;
  float right = vR.x > 1.0 ? -middle.x : texture(uVelocity, vR).x;
  float top = vT.y > 1.0 ? -middle.y : texture(uVelocity, vT).y;
  float bottom = vB.y < 0.0 ? -middle.y : texture(uVelocity, vB).y;
  fragColor = vec4(0.5 * (right - left + top - bottom), 0.0, 0.0, 1.0);
}
`;

const pressureFragment = `${fluidHead}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float left = texture(uPressure, vL).x;
  float right = texture(uPressure, vR).x;
  float top = texture(uPressure, vT).x;
  float bottom = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  fragColor = vec4((left + right + top + bottom - divergence) * 0.25, 0.0, 0.0, 1.0);
}
`;

const projectFragment = `${fluidHead}
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  float left = texture(uPressure, vL).x;
  float right = texture(uPressure, vR).x;
  float top = texture(uPressure, vT).x;
  float bottom = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy - vec2(right - left, top - bottom);
  fragColor = vec4(velocity, 0.0, 1.0);
}
`;

const advectFragment = `${fluidHead}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uDt;
uniform float uFade;
void main() {
  vec2 from = vUv - uDt * texture(uVelocity, vUv).xy * uTexel;
  fragColor = texture(uSource, from) / (1.0 + uFade * uDt);
}
`;

const scaleFragment = `${fluidHead}
uniform sampler2D uSource;
uniform float uValue;
void main() {
  fragColor = texture(uSource, vUv) * uValue;
}
`;

const fieldFragment = `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform vec4 uGrid;
uniform vec2 uOrigin;
uniform vec2 uSlat;
uniform float uTime;
uniform float uScale;
uniform float uDirection;
uniform float uChop;
uniform float uStretch;
uniform float uGlint;
uniform float uContrast;
uniform float uPerspective;
uniform float uFog;
uniform float uIntro;
uniform sampler2D tVelocity;
uniform sampler2D tInk;
uniform vec2 uFluidTexel;
uniform float uFluid;
uniform float uInk;
uniform float uLean;
out vec4 fragColor;

const float TURN[4] = float[4](0.0, -0.95, 0.78, 1.62);
const float LENGTH[4] = float[4](2.6, 1.7, 1.12, 0.76);
const float HEIGHT[4] = float[4](1.0, 0.75, 0.5, 0.3);
const float SHIFT[4] = float[4](0.0, 2.3, 4.1, 1.1);

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  float row = uGrid.y - 1.0 - cell.y;
  vec2 center = uOrigin + vec2(cell.x, row) * uGrid.zw + uSlat * 0.5;
  float v = clamp(center.y / uSize.y, 0.0, 1.0);

  vec2 flow = vec2(0.0);
  float ink = 0.0;
  if (uFluid > 0.5) {
    vec2 fluidUv = clamp(vec2(center.x / uSize.x, 1.0 - center.y / uSize.y), 0.0, 1.0);
    flow = texture(tVelocity, fluidUv).xy * uFluidTexel * uSize;
    ink = texture(tInk, fluidUv).x;
  }

  float horizon = mix(8.0, 0.5, uPerspective);
  float depth = (1.0 + horizon) / (v + horizon);
  vec2 world = vec2((center.x - uSize.x * 0.5) / uSize.y * depth, (depth - 1.0) * horizon * 2.2);
  world -= flow * 0.00018 * depth;
  world /= max(uScale, 0.05);

  float meander = 0.55 * sin(dot(world, vec2(0.23, 0.41)) * 0.9 + uTime * 0.13)
    + 0.3 * sin(dot(world, vec2(-0.37, 0.19)) * 1.4 - uTime * 0.09);

  float steep = uChop * 0.45;
  float height = 0.0;
  float total = 0.0;
  for (int i = 0; i < 4; i++) {
    float angle = uDirection + TURN[i];
    vec2 heading = vec2(cos(angle), sin(angle));
    float k = 6.2831853 / LENGTH[i];
    float omega = sqrt(9.81 * k) * 0.35;
    float theta = k * dot(world, heading) - omega * uTime + SHIFT[i] + meander * (0.6 + 0.3 * float(i));
    height += HEIGHT[i] * (cos(theta) + steep * cos(2.0 * theta));
    total += HEIGHT[i] * (1.0 + steep);
  }
  float level = clamp(0.5 + 0.5 * height / (total * 0.85), 0.0, 1.0);
  float crest = smoothstep(0.6, 1.0, level);
  float glint = crest * crest * uGlint;

  float haze = mix(1.0, 1.0 - uFog, pow(1.0 - v, 1.4));
  float light = (pow(level, uContrast) + glint * 0.8) * haze;
  float glow = 1.0 - exp(-max(ink, 0.0) * uInk * 1.6);
  light = 1.0 - (1.0 - clamp(light, 0.0, 1.0)) * (1.0 - glow);

  float front = uIntro * 1.35;
  float reveal = 1.0 - smoothstep(front - 0.35, front, v);
  float sweep = exp(-pow((v - front + 0.22) / 0.07, 2.0)) * (1.0 - uIntro);
  light = (light + sweep * 0.8) * reveal;
  light = max(light, 0.045 * reveal);
  float span = mix(1.0 - uStretch, 1.0, level) + glow * 0.3;
  span = clamp(span, 0.08, 1.0) * mix(0.1, 1.0, reveal);
  float tint = clamp(max(glint * 1.4, glow * 0.9) + sweep, 0.0, 1.0);
  float lean = clamp(flow.x / 1400.0, -1.0, 1.0) * uLean * reveal;

  fragColor = vec4(clamp(light, 0.0, 1.0), span, tint, 0.5 + 0.5 * lean);
}
`;

const slatFragment = `#version 300 es
precision highp float;
uniform sampler2D tField;
uniform vec2 uSize;
uniform float uDpr;
uniform vec4 uGrid;
uniform vec2 uOrigin;
uniform vec2 uSlat;
uniform float uRound;
uniform float uTilt;
uniform vec3 uColor;
uniform vec3 uGlintColor;
uniform vec4 uBackground;
out vec4 fragColor;

float pill(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 local = p - uOrigin;
  vec2 cell = floor(local / uGrid.zw);
  vec4 background = vec4(uBackground.rgb * uBackground.a, uBackground.a);
  vec4 slat = vec4(0.0);
  int reach = uTilt > 0.0 ? 1 : 0;
  for (int dx = -1; dx <= 1; dx++) {
    if (abs(dx) > reach) continue;
    vec2 neighbour = cell + vec2(float(dx), 0.0);
    if (neighbour.x < 0.0 || neighbour.y < 0.0 || neighbour.x >= uGrid.x || neighbour.y >= uGrid.y) continue;
    vec4 field = texelFetch(tField, ivec2(int(neighbour.x), int(uGrid.y - 1.0 - neighbour.y)), 0);
    vec2 offset = local - neighbour * uGrid.zw - uSlat * 0.5;
    float angle = (field.a - 0.5) * 2.0 * uTilt;
    float c = cos(angle);
    float s = sin(angle);
    vec2 turned = vec2(c * offset.x + s * offset.y, c * offset.y - s * offset.x);
    vec2 halfSize = vec2(uSlat.x * 0.5, uSlat.y * 0.5 * field.g);
    float radius = uRound * min(halfSize.x, halfSize.y);
    float alpha = clamp(0.5 - pill(turned, halfSize, radius) * uDpr, 0.0, 1.0) * field.r;
    if (alpha > slat.a) slat = vec4(mix(uColor, uGlintColor, field.b) * alpha, alpha);
  }
  fragColor = slat + background * (1.0 - slat.a);
}
`;

const MicroSlats = ({
  preset = 'swell',
  color = '#A855F7',
  glintColor = '#ffffff',
  backgroundColor = '#000000',
  slatWidth = 10,
  slatHeight = 25,
  gap = 3,
  roundness = 0.75,
  scale,
  speed,
  direction,
  chop,
  stretch,
  glint,
  contrast,
  perspective,
  fog,
  interactive = true,
  cursorStrength = 1,
  cursorSize = 40,
  swirl = 0,
  trail = 1.4,
  lean = 0,
  intro = true,
  introDuration = 1.5,
  paused = false,
  className = '',
  style
}) => {
  const containerRef = useRef(null);
  const settingsRef = useRef(null);
  const wakeRef = useRef(null);

  const base = SWELL_PRESETS[preset] || SWELL_PRESETS.swell;
  const pick = (value, key) => (value === undefined || value === null ? base[key] : value);

  const colors = useMemo(
    () => ({
      color: parseColor(color, [0.66, 0.33, 0.97, 1]),
      glintColor: parseColor(glintColor, [1, 1, 1, 1]),
      backgroundColor: parseColor(backgroundColor, [0, 0, 0, 1])
    }),
    [color, glintColor, backgroundColor]
  );

  useEffect(() => {
    settingsRef.current = {
      ...colors,
      slatWidth,
      slatHeight,
      gap,
      roundness,
      scale: pick(scale, 'scale'),
      speed: pick(speed, 'speed'),
      direction: pick(direction, 'direction'),
      chop: pick(chop, 'chop'),
      stretch: pick(stretch, 'stretch'),
      glint: pick(glint, 'glint'),
      contrast: pick(contrast, 'contrast'),
      perspective: pick(perspective, 'perspective'),
      fog: pick(fog, 'fog'),
      interactive,
      cursorStrength,
      cursorSize,
      swirl,
      trail,
      lean,
      intro,
      introDuration,
      paused
    };
    wakeRef.current?.();
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
    const gl = renderer.gl;
    if (!renderer.isWebgl2) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return undefined;
    }
    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);

    const geometry = new Triangle(gl);
    const blank = new Texture(gl);
    const floatTargets = !!(
      gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')
    );

    const dispose = target => {
      gl.deleteFramebuffer(target.buffer);
      gl.deleteTexture(target.texture.texture);
    };

    let fieldTarget = new RenderTarget(gl, {
      width: 1,
      height: 1,
      depth: false,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST
    });

    const fieldUniforms = {
      uSize: { value: [1, 1] },
      uGrid: { value: [1, 1, 1, 1] },
      uOrigin: { value: [0, 0] },
      uSlat: { value: [1, 1] },
      uTime: { value: 0 },
      uScale: { value: 1 },
      uDirection: { value: 0 },
      uChop: { value: 0.5 },
      uStretch: { value: 0.3 },
      uGlint: { value: 1 },
      uContrast: { value: 1 },
      uPerspective: { value: 0.7 },
      uFog: { value: 0.5 },
      uIntro: { value: 0 },
      tVelocity: { value: blank },
      tInk: { value: blank },
      uFluidTexel: { value: [1, 1] },
      uFluid: { value: 0 },
      uInk: { value: 1 },
      uLean: { value: 0.5 }
    };
    const fieldMesh = new Mesh(gl, {
      geometry,
      program: new Program(gl, {
        vertex: passVertex,
        fragment: fieldFragment,
        uniforms: fieldUniforms,
        depthTest: false,
        depthWrite: false
      })
    });

    const slatUniforms = {
      tField: { value: fieldTarget.texture },
      uSize: { value: [1, 1] },
      uDpr: { value: 1 },
      uGrid: { value: [1, 1, 1, 1] },
      uOrigin: { value: [0, 0] },
      uSlat: { value: [1, 1] },
      uRound: { value: 1 },
      uTilt: { value: 0 },
      uColor: { value: [1, 1, 1] },
      uGlintColor: { value: [1, 1, 1] },
      uBackground: { value: [0, 0, 0, 1] }
    };
    const slatMesh = new Mesh(gl, {
      geometry,
      program: new Program(gl, {
        vertex: passVertex,
        fragment: slatFragment,
        uniforms: slatUniforms,
        depthTest: false,
        depthWrite: false
      })
    });

    const fluidTexel = { value: [1, 1] };
    const fluidPass = (fragment, uniforms) =>
      new Mesh(gl, {
        geometry,
        program: new Program(gl, {
          vertex: fluidVertex,
          fragment,
          uniforms: { uTexel: fluidTexel, ...uniforms },
          depthTest: false,
          depthWrite: false
        })
      });
    const splatPass = fluidPass(splatFragment, {
      uTarget: { value: blank },
      uAspect: { value: 1 },
      uPoint: { value: [0, 0] },
      uValue: { value: [0, 0, 0] },
      uRadius: { value: 0.01 }
    });
    const curlPass = fluidPass(curlFragment, { uVelocity: { value: blank } });
    const vorticityPass = fluidPass(vorticityFragment, {
      uVelocity: { value: blank },
      uCurl: { value: blank },
      uSwirl: { value: 20 },
      uDt: { value: 0.016 }
    });
    const divergencePass = fluidPass(divergenceFragment, { uVelocity: { value: blank } });
    const pressurePass = fluidPass(pressureFragment, { uPressure: { value: blank }, uDivergence: { value: blank } });
    const projectPass = fluidPass(projectFragment, { uPressure: { value: blank }, uVelocity: { value: blank } });
    const advectPass = fluidPass(advectFragment, {
      uVelocity: { value: blank },
      uSource: { value: blank },
      uDt: { value: 0.016 },
      uFade: { value: 1 }
    });
    const scalePass = fluidPass(scaleFragment, { uSource: { value: blank }, uValue: { value: 0 } });

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let width = 1;
    let height = 1;
    let raf = 0;
    let last = performance.now();
    let time = 0;
    let introClock = 0;
    let visible = true;
    let alive = true;
    let fluid = null;
    let fluidUntil = 0;
    let fluidDirty = false;
    let splashTurn = 0;
    const splats = [];
    const pointer = { x: 0, y: 0, tracked: false };

    const run = (mesh, target) => renderer.render({ scene: mesh, target, clear: false });

    const floatTarget = (w, h) =>
      new RenderTarget(gl, {
        width: w,
        height: h,
        depth: false,
        type: gl.HALF_FLOAT,
        format: gl.RGBA,
        internalFormat: gl.RGBA16F,
        minFilter: gl.LINEAR,
        magFilter: gl.LINEAR
      });

    const swapPair = (w, h) => ({
      read: floatTarget(w, h),
      write: floatTarget(w, h),
      swap() {
        const next = this.read;
        this.read = this.write;
        this.write = next;
      }
    });

    const disposeFluid = () => {
      if (!fluid) return;
      [fluid.velocity, fluid.ink, fluid.pressure].forEach(pair => {
        dispose(pair.read);
        dispose(pair.write);
      });
      dispose(fluid.divergence);
      dispose(fluid.curl);
      fluid = null;
    };

    const buildFluid = () => {
      if (!floatTargets) return;
      const aspect = width / height;
      const w = Math.max(8, Math.round(aspect >= 1 ? FLUID_SIZE * aspect : FLUID_SIZE));
      const h = Math.max(8, Math.round(aspect >= 1 ? FLUID_SIZE : FLUID_SIZE / aspect));
      if (fluid && fluid.width === w && fluid.height === h) return;
      disposeFluid();
      fluid = {
        width: w,
        height: h,
        velocity: swapPair(w, h),
        ink: swapPair(w, h),
        pressure: swapPair(w, h),
        divergence: floatTarget(w, h),
        curl: floatTarget(w, h)
      };
      fluidTexel.value = [1 / w, 1 / h];
    };

    const resize = () => {
      width = Math.max(1, container.clientWidth);
      height = Math.max(1, container.clientHeight);
      renderer.dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(PIXEL_BUDGET / (width * height)));
      renderer.setSize(width, height);
      buildFluid();
      start();
    };

    const layout = s => {
      const slatW = clamp(s.slatWidth, 1, 64);
      const slatH = clamp(s.slatHeight, 2, 240);
      const gapSize = clamp(s.gap, 0, 64);
      const pitchX = slatW + gapSize;
      const pitchY = slatH + gapSize;
      const cols = Math.min(2048, Math.ceil((width + gapSize) / pitchX) + 1);
      const rows = Math.min(2048, Math.ceil((height + gapSize) / pitchY) + 1);
      const originX = (width - (cols * pitchX - gapSize)) / 2;
      const originY = (height - (rows * pitchY - gapSize)) / 2;
      if (fieldTarget.width !== cols || fieldTarget.height !== rows) {
        dispose(fieldTarget);
        fieldTarget = new RenderTarget(gl, {
          width: cols,
          height: rows,
          depth: false,
          minFilter: gl.NEAREST,
          magFilter: gl.NEAREST
        });
        slatUniforms.tField.value = fieldTarget.texture;
      }
      const tilt = Math.min(0.42, Math.asin(clamp((pitchX * 1.5 - slatW * 0.5) / (slatH * 0.5), 0, 1)));
      return { slatW, slatH, tilt, grid: [cols, rows, pitchX, pitchY], origin: [originX, originY] };
    };

    const splat = (pair, point, value, radius) => {
      const u = splatPass.program.uniforms;
      u.uTarget.value = pair.read.texture;
      u.uAspect.value = width / height;
      u.uPoint.value = point;
      u.uValue.value = value;
      u.uRadius.value = radius;
      run(splatPass, pair.write);
      pair.swap();
    };

    const stepFluid = (f, dt, s) => {
      if (s.swirl > 0) {
        curlPass.program.uniforms.uVelocity.value = f.velocity.read.texture;
        run(curlPass, f.curl);

        const vorticity = vorticityPass.program.uniforms;
        vorticity.uVelocity.value = f.velocity.read.texture;
        vorticity.uCurl.value = f.curl.texture;
        vorticity.uSwirl.value = clamp(s.swirl, 0, 2) * 40;
        vorticity.uDt.value = dt;
        run(vorticityPass, f.velocity.write);
        f.velocity.swap();
      }

      divergencePass.program.uniforms.uVelocity.value = f.velocity.read.texture;
      run(divergencePass, f.divergence);

      scalePass.program.uniforms.uSource.value = f.pressure.read.texture;
      scalePass.program.uniforms.uValue.value = 0.8;
      run(scalePass, f.pressure.write);
      f.pressure.swap();

      pressurePass.program.uniforms.uDivergence.value = f.divergence.texture;
      for (let i = 0; i < PRESSURE_STEPS; i++) {
        pressurePass.program.uniforms.uPressure.value = f.pressure.read.texture;
        run(pressurePass, f.pressure.write);
        f.pressure.swap();
      }

      projectPass.program.uniforms.uPressure.value = f.pressure.read.texture;
      projectPass.program.uniforms.uVelocity.value = f.velocity.read.texture;
      run(projectPass, f.velocity.write);
      f.velocity.swap();

      const fade = 1 / clamp(s.trail, 0.1, 10);
      const advect = advectPass.program.uniforms;
      advect.uDt.value = dt;
      advect.uVelocity.value = f.velocity.read.texture;
      advect.uSource.value = f.velocity.read.texture;
      advect.uFade.value = fade * 1.4;
      run(advectPass, f.velocity.write);
      f.velocity.swap();

      advect.uVelocity.value = f.velocity.read.texture;
      advect.uSource.value = f.ink.read.texture;
      advect.uFade.value = fade;
      run(advectPass, f.ink.write);
      f.ink.swap();
    };

    const clearFluid = f => {
      scalePass.program.uniforms.uValue.value = 0;
      [f.velocity, f.ink, f.pressure].forEach(pair => {
        scalePass.program.uniforms.uSource.value = pair.read.texture;
        run(scalePass, pair.write);
        pair.swap();
      });
    };

    const frame = now => {
      raf = 0;
      if (!alive) return;
      const s = settingsRef.current;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (!s) return;

      if (!s.paused && !reducedMotion) time += dt * s.speed;
      introClock = s.intro && !reducedMotion ? introClock + dt / Math.max(0.2, s.introDuration) : 1;
      const introLinear = Math.min(introClock, 1);
      const introEase =
        introLinear < 0.5 ? 4 * introLinear * introLinear * introLinear : 1 - Math.pow(-2 * introLinear + 2, 3) / 2;

      if (fluid && splats.length) {
        const radius = Math.pow(clamp(s.cursorSize, 4, 600) / height, 2) * 0.35;
        const aspect = width / height;
        for (const [u, v, du, dv, turn] of splats) {
          if (turn === null) {
            splat(fluid.velocity, [u, v], [du * SPLAT_FORCE, dv * SPLAT_FORCE, 0], radius);
            splat(fluid.ink, [u, v], [0.13, 0, 0], radius);
            continue;
          }
          const jet = radius * 0.55;
          const reach = Math.sqrt(jet * 0.5) * 1.9;
          const push = SPLAT_FORCE * 0.08;
          for (let i = 0; i < SPLASH_JETS; i++) {
            const angle = turn + (i / SPLASH_JETS) * Math.PI * 2;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            const point = [u + (dx * reach) / aspect, v + dy * reach];
            const spin = [(dx - dy) * Math.SQRT1_2 * push, (dy + dx) * Math.SQRT1_2 * push, 0];
            splat(fluid.velocity, point, spin, jet);
            splat(fluid.ink, point, [0.75, 0, 0], jet);
          }
          splat(fluid.ink, [u, v], [0.45, 0, 0], radius);
        }
        splats.length = 0;
        fluidDirty = true;
      }
      const fluidActive = fluid !== null && now < fluidUntil;
      if (fluid) {
        if (fluidActive) stepFluid(fluid, Math.min(Math.max(dt, 1 / 240), 1 / 30), s);
        else if (fluidDirty) {
          clearFluid(fluid);
          fluidDirty = false;
        }
      }

      const grid = layout(s);

      fieldUniforms.uSize.value = [width, height];
      fieldUniforms.uGrid.value = grid.grid;
      fieldUniforms.uOrigin.value = grid.origin;
      fieldUniforms.uSlat.value = [grid.slatW, grid.slatH];
      fieldUniforms.uTime.value = time;
      fieldUniforms.uScale.value = s.scale;
      fieldUniforms.uDirection.value = (s.direction * Math.PI) / 180;
      fieldUniforms.uChop.value = clamp(s.chop, 0, 1.5);
      fieldUniforms.uStretch.value = clamp(s.stretch, 0, 0.95);
      fieldUniforms.uGlint.value = Math.max(0, s.glint);
      fieldUniforms.uContrast.value = clamp(s.contrast, 0.2, 4);
      fieldUniforms.uPerspective.value = clamp(s.perspective, 0, 1);
      fieldUniforms.uFog.value = clamp(s.fog, 0, 1);
      fieldUniforms.uIntro.value = introEase;
      fieldUniforms.uFluid.value = fluidActive ? 1 : 0;
      fieldUniforms.tVelocity.value = fluid ? fluid.velocity.read.texture : blank;
      fieldUniforms.tInk.value = fluid ? fluid.ink.read.texture : blank;
      fieldUniforms.uFluidTexel.value = fluidTexel.value;
      fieldUniforms.uInk.value = clamp(s.cursorStrength, 0, 3);
      fieldUniforms.uLean.value = clamp(s.lean, 0, 1);
      renderer.render({ scene: fieldMesh, target: fieldTarget });

      slatUniforms.uSize.value = [width, height];
      slatUniforms.uDpr.value = renderer.dpr;
      slatUniforms.uGrid.value = grid.grid;
      slatUniforms.uOrigin.value = grid.origin;
      slatUniforms.uSlat.value = [grid.slatW, grid.slatH];
      slatUniforms.uRound.value = clamp(s.roundness, 0, 1);
      slatUniforms.uTilt.value = fluidActive && s.lean > 0 ? grid.tilt : 0;
      slatUniforms.uColor.value = s.color.slice(0, 3);
      slatUniforms.uGlintColor.value = s.glintColor.slice(0, 3);
      slatUniforms.uBackground.value = s.backgroundColor;
      renderer.render({ scene: slatMesh });

      const moving = (!s.paused && !reducedMotion && s.speed !== 0) || introClock < 1;
      if (visible && (moving || fluidActive || fluidDirty)) raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf || !visible || !alive) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const locate = e => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      return { x, y, u: x / w, v: 1 - y / h, h, inside: x >= 0 && y >= 0 && x <= w && y <= h };
    };

    const queue = (u, v, du, dv, turn) => {
      if (splats.length > 32) splats.shift();
      splats.push([u, v, du, dv, turn]);
      const s = settingsRef.current;
      fluidUntil = performance.now() + Math.max(1.5, (s ? s.trail : 1.4) * 5) * 1000;
      start();
    };

    const onPointerMove = e => {
      const s = settingsRef.current;
      const spot = locate(e);
      if (!fluid || !s || !s.interactive || reducedMotion || !spot.inside) {
        pointer.tracked = false;
        return;
      }
      if (pointer.tracked && (spot.x !== pointer.x || spot.y !== pointer.y)) {
        queue(spot.u, spot.v, (spot.x - pointer.x) / spot.h, (pointer.y - spot.y) / spot.h, null);
      }
      pointer.x = spot.x;
      pointer.y = spot.y;
      pointer.tracked = true;
    };

    const onPointerDown = e => {
      const s = settingsRef.current;
      const spot = locate(e);
      if (!fluid || !s || !s.interactive || reducedMotion || !spot.inside) return;
      splashTurn += 2.39996;
      queue(spot.u, spot.v, 0, 0, splashTurn);
    };

    const onPointerLeave = () => {
      pointer.tracked = false;
    };

    const onPointerOut = e => {
      if (!e.relatedTarget) onPointerLeave();
    };

    const onVisibility = () => {
      if (!document.hidden) start();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerout', onPointerOut, { passive: true });
    window.addEventListener('blur', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      start();
    });
    intersectionObserver.observe(container);

    wakeRef.current = start;
    resize();

    return () => {
      alive = false;
      visible = false;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerout', onPointerOut);
      window.removeEventListener('blur', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      wakeRef.current = null;
      disposeFluid();
      dispose(fieldTarget);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, []);

  return <div ref={containerRef} className={`micro-slats ${className}`.trim()} style={style} />;
};

function BabelWidget() {
  const [i, setI] = useState(0)
  const [fade, setFade] = useState(false)

  useEffect(() => {
    let t2
    const t1 = setInterval(() => {
      setFade(true)
      t2 = setTimeout(() => { setI(n => (n + 1) % BABEL.length); setFade(false) }, 250)
    }, 2000)
    return () => { clearInterval(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className="absolute -top-4 left-3 sm:left-6 z-40 bg-[#FF4D8D] text-white border-2 border-gray-950 p-2 rounded-xl shadow-[4px_4px_0_0_#000] w-[170px] sm:w-[195px] h-[76px] flex flex-col justify-between rotate-2 group-hover:rotate-0 transition-transform">
      <div className="flex justify-between">
        <span className="text-[7px] font-black bg-black px-1 rounded">AZ-PORTFOLIO</span>
        <span className="text-[7.5px] bg-white text-gray-950 px-1.5 rounded font-black border border-gray-950">{BABEL[i][0]}</span>
      </div>
      <div className="bg-white text-gray-950 border border-gray-950 px-2 py-1 rounded-lg overflow-hidden">
        <p className={`text-[9px] font-black truncate transition-opacity duration-300 ${fade ? 'opacity-0' : 'opacity-100'}`}>{BABEL[i][1]}</p>
      </div>
    </div>
  )
}

function Terminal() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    let i = 0, j = 0, span, timer
    const step = () => {
      if (i >= TYPED.length) {
        timer = setTimeout(() => { el.textContent = ''; i = j = 0; step() }, 4200)
        return
      }
      if (!j) { span = document.createElement('span'); span.className = TYPED[i][0]; el.appendChild(span) }
      span.textContent = TYPED[i][1].slice(0, ++j)
      if (j >= TYPED[i][1].length) { i++; j = 0 }
      timer = setTimeout(step, 45)
    }
    el.textContent = ''
    step()
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="max-w-[38rem] bg-[#0d1520] border-2 border-[#0a0a0a] rounded-[14px] shadow-[6px_6px_0_0_#0a0a0a] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-1.5">
        <span className="flex gap-[7px]">
          <i className="w-[11px] h-[11px] rounded-full bg-[#ff5f57]" />
          <i className="w-[11px] h-[11px] rounded-full bg-[#febc2e]" />
          <i className="w-[11px] h-[11px] rounded-full bg-[#28c840]" />
        </span>
        <span className="text-xs font-bold text-slate-200 truncate">
          <b className="text-[#FF4D8D] font-extrabold">austin@az</b><span className="text-slate-400">: $ </span>./deploy
        </span>
      </div>
      <pre className="m-0 px-4 sm:px-5 pt-3 pb-6 text-xs sm:text-[13px] leading-8 text-slate-200 whitespace-pre-wrap min-h-[210px]"><code ref={ref} /><span className="caret" /></pre>
    </div>
  )
}

const W = 540, H = 172, P = 3, GY = H - 34
const DINO = ['.........xxxxxx','.........xx.xxx','.........xxxxxx','.........xxxxx.','x.......xxxxx..','xx.....xxxxxxx.','xxx...xxxxxxxx.','xxxxxxxxxxxxx..','.xxxxxxxxxxxx..','..xxxxxxxxxx...','...xxxxxxxx....']
const LEGS = [['..xxx..xxx.....','..xx...xx......','..xx...........','.xxx...........'],['..xxx..xxx.....','..xx...xx......','.......xx......','.......xxx.....']]
const CA = ['..x..','x.x..','x.x.x','xxx.x','..xxx','..x..','..x..','..x..']
const CB = ['...x...','x..x..x','x..x..x','x..x..x','xxxxx.x','...xxxx','...x...','...x...','...x...','...x...']
const CLD = ['..xxxxx...','.x.....x..','x.......xx','xxxxxxxxxx']

function DinoGame() {
  const canvas = useRef(null)
  const badge = useRef(null)

  useEffect(() => {
    const c = canvas.current, x = c.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = W * dpr; c.height = H * dpr
    x.setTransform(dpr, 0, 0, dpr, 0, 0)

    const blit = (rows, px, py, s, col) => {
      x.fillStyle = col
      rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === 'x') x.fillRect(px + i * s, py + j * s, s, s) })
    }
    let sp = 3.4, dy = 0, vy = 0, jmp = false, fr = 0, sc = 0
    let obs = [{ x: W + 20, r: CA }]
    const bump = Array.from({ length: 40 }, (_, i) => ({ x: Math.random() * W, w: 2 + (i * 7) % 8, o: (i % 3) * 3 }))
    const clouds = Array.from({ length: 4 }, () => ({ x: Math.random() * W, y: 38 + Math.random() * 16 }))

    const tick = () => {
      const dk = document.documentElement.classList.contains('dark')
      const T = dk ? { bg: '#0d1117', fg: '#8b949e', dm: '#3d444d' } : { bg: '#fff', fg: '#535353', dm: '#c9c9c9' }
      if (badge.current) badge.current.textContent = dk ? 'NIGHT_MODE' : 'DAY_MODE'
      x.fillStyle = T.bg; x.fillRect(0, 0, W, H)
      fr++; sc += sp * 0.12; sp = 3.4 + Math.min(sc / 900, 2.6)

      clouds.forEach(o => { o.x -= sp * 0.18; if (o.x < -60) { o.x = W + 30; o.y = 38 + Math.random() * 16 } blit(CLD, o.x, o.y, 6, T.dm) })
      x.fillStyle = T.fg; x.fillRect(0, GY + 2, W, 2)
      bump.forEach(b => { b.x -= sp; if (b.x < -12) b.x = W + Math.random() * 30; x.fillStyle = T.dm; x.fillRect(b.x, GY + 6 + b.o, b.w, 2) })

      obs.forEach(o => { o.x -= sp; blit(o.r, o.x, GY + 2 - o.r.length * P, P, T.fg) })
      obs = obs.filter(o => o.x > -40)
      const last = obs[obs.length - 1]
      if (!last || last.x < W - (170 + Math.random() * 190)) obs.push({ x: W + 20, r: Math.random() > 0.55 ? CB : CA })

      if (!jmp) for (const o of obs) { const d = o.x - (46 + 15 * P); if (d > 0 && d < 34 + sp * 9) { jmp = true; vy = 10.4; break } }
      if (jmp) { dy += vy; vy -= 0.62; if (dy <= 0) { dy = 0; vy = 0; jmp = false } }

      const by = GY + 2 - (DINO.length + 4) * P - dy
      blit(DINO, 46, by, P, T.fg)
      blit(LEGS[jmp ? 0 : Math.floor(fr / 6) % 2], 46, by + DINO.length * P, P, T.fg)
      x.fillStyle = T.bg; x.fillRect(46 + 11 * P, by + P, P, P)
      x.fillStyle = T.dm; x.font = 'bold 13px ui-monospace,Menlo,Consolas,monospace'; x.textAlign = 'right'
      x.fillText('HI 00420   ' + ('00000' + Math.floor(sc)).slice(-5), W - 16, 26)
    }

    let raf, lastT = 0, acc = 0
    const loop = n => {
      if (!lastT) lastT = n
      acc += Math.min(n - lastT, 200); lastT = n
      let g = 0
      while (acc >= 1000 / 60 && g++ < 5) { tick(); acc -= 1000 / 60 }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className={`lg:col-span-5 ${card} border-t-4 border-t-[#22C55E] p-5 sm:p-6`}>
      <div className="flex justify-between border-b-2 border-gray-900 pb-2 mb-3 text-[9px] font-black uppercase"><span>[01] DINO_GAME.EXE</span><span className="text-gray-500">AUTOPLAY</span></div>
      <div className="border-2 border-gray-950 rounded-2xl shadow-[6px_6px_0_0_#000] overflow-hidden">
        <div className="bg-gray-950 text-white px-3 py-2 flex justify-between items-center text-[11px] font-black">
          <span>dino_runner.exe</span>
          <span className="flex gap-1.5">
            <b className="w-5 h-5 bg-[#F4F2EB] text-gray-950 border border-gray-950 rounded text-center leading-4">_</b>
            <b className="w-5 h-5 bg-[#F4F2EB] text-gray-950 border border-gray-950 rounded text-center leading-5 text-[10px]">□</b>
            <b className="w-5 h-5 bg-[#FF4D8D] border border-gray-950 rounded text-center leading-5 text-[10px]">✕</b>
          </span>
        </div>
        <div className="p-3 bg-white">
          <div className="flex justify-between items-center border-b-2 border-gray-950 pb-2 mb-3 text-[10px] font-black uppercase">
            <span className="flex items-center gap-2"><i className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />DINO_RUNNER // AUTO_PILOT</span>
            <span ref={badge} className="bg-gray-950 text-white px-2 py-0.5 text-[8.5px] rounded">DAY_MODE</span>
          </div>
          <div className="h-40 sm:h-44 border-2 border-gray-950 rounded-xl overflow-hidden bg-[#F4F2EB] p-1">
            <canvas ref={canvas} className="w-full h-full block bg-white rounded-lg" />
          </div>
          <div className="mt-3 flex justify-between items-center text-[9px] font-bold uppercase border-t-2 border-gray-950 pt-2">
            <span className="text-gray-700">SYS_STATUS: 200 OK</span>
            <span className="bg-[#0038FF] text-white px-2.5 py-0.5 font-black rounded border border-gray-950">AUTO_PILOT // ACTIVE</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const COL = ['#D1D5DB', '#86EFAC', '#4ADE80', '#22C55E', '#15803D', '#FF4D8D']
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]

function GitHubContributions() {
  const grid = useRef(null), wrap = useRef(null), count = useRef(null)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    const fetchContributions = async () => {
      try {
        const response = await fetch('https://api.github.com/users/Zainnyyy/repos?sort=updated&per_page=100')
        const repos = await response.json()
        const total = repos.reduce((sum, repo) => sum + (repo.pushed_at ? 1 : 0), 0)
        setTotalCount(total)
      } catch (error) {
        console.error('Failed to fetch contributions:', error)
      }
    }
    fetchContributions()
  }, [])

  useEffect(() => {
    const g = grid.current, w = wrap.current, ct = count.current
    let cols, tile, cells, lv, sn, tr, eaten, timer, rt
    const ix = (x, y) => y * cols + x

    const build = () => {
      const av = Math.max(120, w.clientWidth - 24)
      cols = Math.max(10, Math.floor(av / 16))
      tile = Math.max(8, Math.floor((av - (cols - 1) * 2) / cols))
      g.style.gridTemplateColumns = `repeat(${cols},${tile}px)`; g.style.gap = '2px'; g.innerHTML = ''
      cells = []; lv = []
      for (let i = 0; i < 7 * cols; i++) {
        const d = document.createElement('div'), r = Math.random()
        const c = COL[r > .92 ? 5 : r > .78 ? 4 : r > .55 ? 3 : r > .25 ? 2 : 1]
        d.style.cssText = `width:${tile}px;height:${tile}px;background:${c};border-radius:2px;transition:.15s`
        g.appendChild(d); cells.push(d); lv.push(c)
      }
      sn = [0, 1, 2, 3, 4, 5].map(i => ({ x: Math.floor(cols / 4) - i, y: 3 }))
      tr = []; eaten = 0; ct.textContent = '000 DOTS'
    }
    const paint = () => {
      tr.forEach(i => { const c = cells[i]; c.style.background = c.dataset.e ? COL[0] : lv[i]; c.style.opacity = c.dataset.e ? .45 : 1; c.style.transform = '' })
      tr = []
      sn.forEach((p, r) => { const i = ix(p.x, p.y), c = cells[i]; c.style.background = r ? '#15803D' : '#FACC15'; c.style.opacity = 1; c.style.transform = r ? '' : 'scale(1.15)'; tr.push(i) })
    }
    const step = () => {
      const h = sn[0], nk = sn[1], tl = ix(sn[sn.length - 1].x, sn[sn.length - 1].y)
      const opts = DIRS.filter(d => {
        const x = h.x + d[0], y = h.y + d[1]
        if ((x === nk.x && y === nk.y) || x < 0 || y < 0 || x >= cols || y >= 7) return false
        const i = ix(x, y)
        return i === tl || sn.every(s => ix(s.x, s.y) !== i)
      })
      if (!opts.length) { build(); paint(); return }
      const p = opts[Math.floor(Math.random() * opts.length)], x = h.x + p[0], y = h.y + p[1], i = ix(x, y)
      if (!cells[i].dataset.e) { cells[i].dataset.e = 1; ct.textContent = String(++eaten).padStart(3, '0') + ' DOTS' }
      sn.unshift({ x, y }); sn.pop(); paint()
    }
    const reset = () => { clearInterval(timer); build(); paint(); timer = setInterval(step, 110) }
    const onResize = () => { clearTimeout(rt); rt = setTimeout(reset, 200) }
    reset()
    addEventListener('resize', onResize)
    return () => { clearInterval(timer); clearTimeout(rt); removeEventListener('resize', onResize) }
  }, [])

  return (
    <div className={`${card} border-t-4 border-t-[#0038FF] p-4 sm:p-8`}>
      <div className="flex flex-wrap justify-between items-center gap-2 border-b-2 border-gray-900 pb-3 mb-4">
        <span className="text-[10px] font-black uppercase tracking-wider">[02] GITHUB_ACTIVITY_MATRIX</span>
        <span className="text-[9px] font-bold bg-[#0038FF] text-white px-2 py-0.5 border border-gray-950">52_WEEKS</span>
      </div>
      <div className="bg-white border-2 border-gray-900 p-2.5 sm:p-4 shadow-[6px_6px_0_0_#000]">
        <div className="flex justify-between items-center border-b-2 border-gray-900 pb-2 mb-3 text-[10px] font-black uppercase">
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />GITHUB.MATRIX // SNAKE</span>
          <span className="bg-gray-950 text-white px-2 py-0.5 text-[8.5px]">ZAINNYYY</span>
        </div>
        <div ref={wrap} className="w-full border-2 border-gray-900 p-2 sm:p-3 bg-[#F4F2EB] overflow-hidden flex justify-center">
          <div ref={grid} className="inline-grid" />
        </div>
        <div className="mt-3 flex justify-between items-center text-[9px] font-bold uppercase border-t border-gray-300 pt-2">
          <span>EATEN: <b ref={count} className="text-emerald-700">000 DOTS</b></span>
          <span className="bg-[#22C55E] text-gray-950 px-2 py-0.5 font-black border border-gray-900">GITHUB//CONTRIBUTIONS</span>
        </div>
      </div>
    </div>
  )
}

function Navbar({ dark, onToggleTheme }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const esc = e => e.key === 'Escape' && setOpen(false)
    addEventListener('keydown', esc)
    return () => { removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <nav className="fixed w-full top-0 z-50 px-3 sm:px-6 py-2.5 bg-[#FAFAFA]/90 backdrop-blur-md border-b-2 border-gray-950" style={{ paddingTop: 'calc(.625rem + env(safe-area-inset-top, 0px))' }}>
        <div className="max-w-[1700px] mx-auto flex justify-between items-center">
          <a href="#hero" className="flex items-center gap-2 font-oswald text-xl sm:text-2xl font-bold tracking-tighter hover:text-[#FF4D8D] transition-colors">
            <span className="w-3 h-3 bg-[#FF4D8D] border border-gray-950 inline-block shadow-[1px_1px_0_0_#000]" />
            AZ<span className="text-[#0038FF]">.</span>
          </a>
          <div className="flex items-center gap-2">
            <ul className="hidden md:flex items-center gap-2.5 mr-2 font-mono text-xs font-bold uppercase tracking-wider">
              {NAV.map(([label, href, hover]) => (
                <li key={href}>
                  <a href={href} className={`px-2.5 py-1 rounded-md border border-transparent hover:border-gray-950 ${hover} transition-all hover:shadow-[2px_2px_0_0_#000]`}>{label}</a>
                </li>
              ))}
            </ul>
            <button onClick={onToggleTheme} aria-label="Toggle dark mode" className="font-mono text-xs font-black uppercase bg-white border-2 border-gray-950 px-2.5 py-1 rounded-lg shadow-[3px_3px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_0_#000] flex items-center gap-1.5 transition-all">
              <span>{dark ? '☀️' : '🌙'}</span>
              <span className="hidden sm:inline">{dark ? 'LIGHT' : 'DARK'}</span>
            </button>
            <button onClick={() => setOpen(true)} aria-label="Open menu" className="md:hidden font-mono text-xs font-black bg-[#FACC15] text-gray-950 border-2 border-gray-950 px-3 py-1 rounded-lg shadow-[3px_3px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full border border-gray-950" />MENU ☰
            </button>
          </div>
        </div>
      </nav>

      <div onClick={e => e.target === e.currentTarget && setOpen(false)} className={`fixed inset-0 bg-gray-950/70 backdrop-blur-sm z-[60] md:hidden flex items-start justify-end p-4 pt-16 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="w-full max-w-xs sm:max-w-sm bg-white border-3 border-gray-950 rounded-3xl p-6 shadow-[10px_10px_0_0_#000] space-y-5">
          <div className="flex items-center justify-between border-b-2 border-gray-950 pb-4">
            <span className="font-oswald text-xl font-bold">NAVIGATION</span>
            <button onClick={() => setOpen(false)} className="font-mono text-xs font-black bg-[#FF4D8D] text-white border-2 border-gray-950 px-2.5 py-1 rounded-md shadow-[2px_2px_0_0_#000]">✕ CLOSE</button>
          </div>
          <ul className="space-y-2.5 font-oswald text-xl font-bold uppercase">
            {NAV.map(([label, href]) => (
              <li key={href}>
                <a href={href} onClick={() => setOpen(false)} className="block bg-[#F4F2EB] hover:bg-[#FACC15] hover:text-gray-950 border-2 border-gray-950 px-4 py-2.5 rounded-xl shadow-[3px_3px_0_0_#000] transition-all">{label.toUpperCase()}</a>
              </li>
            ))}
          </ul>
          <div className="pt-2 border-t-2 border-gray-950 flex justify-between font-mono text-[10px] font-black uppercase text-gray-600">
            <span>AZ // PORTFOLIO</span>
            <span className="bg-[#FACC15] text-gray-950 px-2 border border-gray-950">2026</span>
          </div>
        </div>
      </div>
    </>
  )
}

const Sparkle = ({ className }) => (
  <svg className={`sparkle absolute hidden md:block ${className}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0c.9 6.4 3.6 9.1 12 12-8.4 2.9-11.1 5.6-12 12-.9-6.4-3.6-9.1-12-12C8.4 9.1 11.1 6.4 12 0z" />
  </svg>
)

function Hero() {
  return (
    <section id="hero" className="relative min-h-screen pt-24 pb-10 px-2 sm:px-6 flex items-center justify-center overflow-hidden grid-blueprint-bg bg-[#FAFAFA]">
      <Sparkle className="top-28 right-5 w-6 h-6 text-[#FF4D8D]" />
      <Sparkle className="bottom-28 left-5 w-5 h-5 text-[#0038FF]" />

      <div className="relative w-full max-w-[1700px] bg-white border-2 border-gray-950 shadow-[12px_12px_0_0_rgba(0,0,0,.95)] p-5 sm:p-8 md:p-12 overflow-hidden">
        <div className="flex justify-between items-center gap-2 pb-4 border-b-2 border-gray-950 font-mono uppercase font-black">
          <span className="bg-gray-950 text-white px-2.5 py-1 text-[10px] sm:text-xs shadow-[2px_2px_0_0_#000]">AZ // PORTFOLIO</span>
          <span className="bg-[#FACC15] text-gray-950 border border-gray-950 px-2.5 py-1 text-[9px] shadow-[2px_2px_0_0_#000] rotate-1">WEB &amp; UI DEV</span>
        </div>

        <div className="my-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* left */}
          <div className="lg:col-span-5 space-y-6">
            <div className="group relative w-full h-[320px] sm:h-[420px] bg-gray-950 rounded-2xl p-2.5 border-3 border-gray-950 shadow-[8px_8px_0_0_#000] mt-8">
              <span className="absolute -top-9 left-10 text-2xl z-50 hover:scale-125 transition-transform cursor-pointer" title="woof">🐕</span>
              <div
                className="relative w-full h-full rounded-xl overflow-hidden grayscale contrast-125 group-hover:grayscale-0 transition-all duration-700"
                style={{ background: "url(/img/hero.webp) 50% 6%/cover, radial-gradient(circle at 55% 40%,#fff 0,#bbb 40%,#222 100%)" }}
              >
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-black/20" />
              </div>
              <a href="#contact" title="say hi → contact" className="absolute top-4 right-4 z-30 bg-white p-1 rounded border border-gray-950 shadow-[2px_2px_0_0_#000] flex flex-col items-center hover:scale-110 transition-transform">
                <span className="w-9 h-9 block" style={{ background: 'conic-gradient(#000 25%,#fff 0 50%,#000 0 75%,#fff 0) 0 0/6px 6px' }} />
                <span className="text-[6.5px] font-black text-gray-950">A7-QR</span>
              </a>
              <BabelWidget />
              <div className="absolute -bottom-5 right-2 sm:right-6 bg-[#FACC15] text-gray-950 border-2 border-gray-950 p-2.5 rounded-xl shadow-[4px_4px_0_0_#000] max-w-[190px] rotate-2 group-hover:rotate-0 transition-transform z-30">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-[8px] font-black"><i className="w-2 h-2 bg-[#FF5500] border border-gray-950 rounded-full animate-ping" />AZ / NOTE</span>
                  <span className="text-[7px] bg-black text-white px-1 rounded">0x7F</span>
                </div>
                <p className="text-[9px] font-bold leading-tight">Building web solutions.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
              <div className="flex gap-2 sm:gap-3">
                <a href="#about" className="bg-white text-gray-950 border-2 border-gray-950 px-4 py-1.5 rounded-full font-oswald text-xs font-bold uppercase shadow-[3px_3px_0_0_#000] hover:bg-gray-100 transition-all">ABOUT ME</a>
                <a href="#skills" className="bg-[#FF5500] text-white border-2 border-gray-950 px-4 py-1.5 rounded-full font-oswald text-xs font-bold uppercase shadow-[3px_3px_0_0_#000] hover:bg-gray-950 transition-all">TECH STACK</a>
              </div>
              <div className="bg-[#A7F3D0] text-gray-950 px-3 py-1 rounded-full border-[1.5px] border-gray-950 text-[9px] font-black shadow-[2px_2px_0_0_#000] flex items-center gap-1.5">
                <i className="w-2 h-2 bg-emerald-600 border border-gray-950 rounded-full" />OPEN TO PROJECTS
              </div>
            </div>
          </div>

          {/* right */}
          <div className="lg:col-span-7 space-y-5 lg:pl-4 relative">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-[#FF4D8D] text-white text-[9px] font-black uppercase px-2.5 py-1 border border-gray-950 shadow-[2px_2px_0_0_#000] -rotate-2">AUSTIN ARABIA // DEV</span>
              <span className="bg-[#F4F2EB] text-gray-950 text-[9px] font-bold px-2 py-0.5 border border-gray-950 shadow-[1px_1px_0_0_#000]" style={{ fontFamily: "'Noto Sans JP',sans-serif" }}>学生 • ILOILO</span>
              <i className="w-2.5 h-2.5 bg-[#FF5500] border border-gray-950 rounded-full" />
            </div>

            <div className="flex flex-col space-y-2">
              <h1 className="glitch font-oswald text-5xl sm:text-7xl md:text-8xl lg:text-[6.2rem] font-bold leading-[.88] tracking-tighter uppercase">LEARNING &amp;</h1>
              <div className="sm:pl-6">
                <span className="bg-[#FACC15] text-gray-950 font-oswald text-4xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold uppercase px-3 sm:px-4 border-2 border-gray-950 shadow-[4px_4px_0_0_#000] -rotate-1 inline-block">BUILDING</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 pt-1 flex-wrap">
                <span className="bg-[#FF4D8D] text-white font-oswald text-4xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold uppercase px-3 sm:px-4 border-2 border-gray-950 shadow-[4px_4px_0_0_#000] rotate-2 inline-block">WEB</span>
                <span className="font-oswald text-5xl sm:text-7xl md:text-8xl lg:text-[6rem] font-bold tracking-tighter uppercase">SOLUTIONS<span className="text-[#FF5500] animate-pulse">.</span></span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-y border-gray-300 py-2.5">
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] font-extrabold uppercase bg-[#F4F2EB] px-2 py-0.5 border border-gray-950 shadow-[1px_1px_0_0_#000]">LOC: ILOILO, PH</span>
                <span className="text-[9px] font-extrabold uppercase bg-[#A7F3D0] text-gray-950 px-2 py-0.5 border border-gray-950 shadow-[1px_1px_0_0_#000]">ROLE: DEV / UI DESIGNER</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black bg-black text-white px-2 py-0.5">0x7F</span>
                <div className="h-3.5 w-14 tech-barcode hidden sm:block" />
              </div>
            </div>

            <div className="pt-3 border-t-2 border-gray-950"><Terminal /></div>
          </div>
        </div>

        <div className="pt-4 border-t-2 border-gray-950 flex flex-col sm:flex-row justify-between items-center gap-3 font-mono text-[10px] sm:text-xs font-black uppercase">
          <span className="bg-gray-950 text-white px-2.5 py-0.5">001 // PORTFOLIO</span>
          <span>ILOILO, PHILIPPINES • [0x7F]</span>
        </div>
      </div>
    </section>
  )
}

function About() {
  return (
    <SectionFrame id="about" no="002" label="ABOUT SPEC" tag="PROFILE & EXPERIMENTS" foot="ABOUT SPEC">
      <div className={`relative ${card} bg-[#F4F2EB] border-l-8 border-l-[#FACC15] p-6 sm:p-10`}>
        <span className="absolute -top-8 right-12 text-2xl hover:scale-125 transition-transform cursor-pointer">🐱</span>
        <div className="corner-ticks" />
        <div className="space-y-4 relative">
          <span className="inline-block bg-[#FACC15] text-gray-950 text-[10px] font-black px-3 py-1 border border-gray-950 shadow-[2px_2px_0_0_#000] -rotate-1">STUDENT • UI / WEB</span>
          <h3 className="font-oswald text-5xl sm:text-6xl md:text-7xl font-bold uppercase tracking-tight leading-none">AUSTIN FRANZ ARABIA</h3>
          <p className="text-xs sm:text-sm leading-relaxed font-medium max-w-4xl">
            BSIT student at <b className="text-[#0038FF]">Western Institute of Technology</b> and a{' '}
            <b className="bg-[#A7F3D0] text-gray-950 border border-gray-950 px-1">beginner developer &amp; UI designer</b>. Currently in my third year of IT studies, constantly evolving my toolkit to create more impactful and efficient web solutions.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        <DinoGame />
        <div className="lg:col-span-7 relative overflow-hidden bg-[#FF4D8D] text-white border-2 border-gray-950 rounded-3xl p-5 sm:p-8 shadow-[8px_8px_0_0_#000] hover:shadow-[14px_14px_0_0_#000] hover:-translate-y-1 transition-all flex flex-col justify-between">
          <div className="absolute right-2 top-2 w-28 h-28 halftone-dots opacity-20" />
          <div className="relative">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <span className="text-[9px] font-black uppercase tracking-widest bg-black px-2.5 py-0.5">STATUS // OPPORTUNITIES</span>
              <span className="bg-[#FACC15] text-gray-950 font-oswald text-xs font-black px-3 py-1 border-[1.5px] border-gray-950 shadow-[2px_2px_0_0_#000] rotate-3">GROW WITH ME!</span>
            </div>
            <h4 className="font-oswald text-3xl sm:text-4xl md:text-5xl font-bold uppercase tracking-tight mt-2 mb-3 text-white">OPEN TO PROJECTS &amp; COLLABORATION</h4>
            <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-medium max-w-xl">Looking for projects, collaborations and chances to learn. Have a project in mind? Send me a message and let's talk.</p>
          </div>
          <div className="mt-6 pt-4 border-t-2 border-white/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <span className="bg-[#22C55E] text-gray-950 border-2 border-gray-950 px-3.5 py-2 rounded-xl shadow-[3px_3px_0_0_#000] -rotate-1 sm:-rotate-3 hover:rotate-0 transition-all font-oswald text-sm font-black uppercase tracking-wider text-center">OPEN TO COLLAB</span>
            <div className="flex flex-col sm:flex-row gap-3"><a href="#contact" className="text-xs sm:text-sm font-bold bg-white text-gray-950 border-2 border-gray-950 px-6 py-2.5 rounded-full shadow-[3px_3px_0_0_#000] hover:bg-black hover:text-white transition-all text-center">LET'S CONNECT [-&gt;]</a><a href="/resume.pdf" download className="text-xs sm:text-sm font-bold bg-white text-gray-950 border-2 border-gray-950 px-6 py-2.5 rounded-full shadow-[3px_3px_0_0_#000] hover:bg-black hover:text-white transition-all text-center">RESUME ↓</a></div>
          </div>
        </div>
      </div>

      <GitHubContributions />
    </SectionFrame>
  )
}

function Chips({ items, dark }) {
  return items.map(([name, color, tag]) => (
    <div key={name} className={`chip flex items-center gap-3 border-2 border-gray-950 px-5 py-3 rounded-2xl shadow-[4px_4px_0_0_#000] hover:-translate-y-1 transition-all cursor-pointer ${dark ? 'bg-gray-950 hover:border-[#FF5500] text-white' : 'bg-white hover:border-[#0038FF]'}`}>
      <span className="ic w-8 h-8 rounded-lg grid place-items-center font-black text-xs text-white border border-gray-950" style={{ background: color, color: color === '#fbf0df' ? '#000' : undefined }}>
        {name.replace(/[^A-Za-z+]/g, '').slice(0, 2)}
      </span>
      <span className="font-oswald text-2xl font-bold uppercase tracking-tight">{name}</span>
      <span className={`text-[9px] font-extrabold border-l-2 border-gray-700 pl-3 ml-1 ${dark ? 'text-[#0038FF]' : 'text-[#FF5500]'}`}>{tag}</span>
    </div>
  ))
}

const Row = ({ items, dir, dark }) => (
  <div className="mrow overflow-hidden">
    <div className={`mq ${dir}`}><Chips items={items} dark={dark} /><Chips items={items} dark={dark} /></div>
  </div>
)

function TechStack() {
  return (
    <SectionFrame id="skills" no="003" label="TECH ARSENAL" tag="LANGUAGES & RUNTIMES" foot="TECH ARSENAL" right="PRIMARY: REACT & JAVASCRIPT">
      <div>
        <h2 className="glitch font-oswald text-5xl sm:text-6xl md:text-7xl font-bold uppercase tracking-tight leading-none">TECH STACK<span className="text-[#0038FF]">.</span></h2>
        <p className="text-xs sm:text-sm text-gray-600 mt-2">Hover over an icon to pause the animation and reveal its original colors.</p>
      </div>
      <div className="relative border-2 border-gray-950 bg-[#F4F2EB] px-3 py-6 sm:px-8 sm:py-8 rounded-3xl shadow-[6px_6px_0_0_#000] overflow-hidden space-y-3">
        <Row items={ROW1} dir="l" />
        <Row items={ROW2} dir="r" dark />
      </div>
    </SectionFrame>
  )
}

function SkillMatrix() {
  return (
    <SectionFrame id="matrix" no="004" label="SKILL MATRIX" tag="WEB & UI DESIGN" foot="SKILL MATRIX">
      <div className="relative z-10">
        <h2 className="font-oswald text-5xl sm:text-6xl md:text-7xl font-bold uppercase tracking-tight leading-none">SKILLS</h2>
        <span className="block w-24 h-1.5 bg-[#FACC15] border border-gray-950 mt-3" />
        <p className="text-xs sm:text-sm mt-3 max-w-2xl">A snapshot of the languages and tools I use to design and build for the web.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 relative z-10">
        {STATS.map(([to, unit, label]) => (
          <div key={label} className="border-2 border-gray-950 p-4 sm:p-6 shadow-[5px_5px_0_0_#000] bg-white">
            <div className="font-oswald font-bold text-5xl sm:text-6xl leading-none"><CountUp to={to} /><span className="text-[#FF4D8D] text-3xl sm:text-4xl ml-1">{unit}</span></div>
            <h3 className="mt-2 text-[10px] sm:text-xs font-black uppercase text-gray-600">{label}</h3>
          </div>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-2 gap-10 relative">
        <div className="absolute inset-0 -z-10">
          <MicroSlats
            preset="swell"
            color="#A855F7"
            glintColor="#ffffff"
            backgroundColor="rgba(255,255,255,0.03)"
            slatWidth={8}
            slatHeight={20}
            gap={2}
            roundness={0.75}
            interactive={false}
            swirl={0}
            trail={1.4}
            lean={0}
            intro={true}
            introDuration={2}
            paused={false}
          />
        </div>
        <section className="relative z-10">
          <p className="text-[10px] font-black uppercase text-[#FF4D8D]">Focus</p>
          <h3 className="font-oswald text-3xl font-bold uppercase">Core Expertise</h3>
          <span className="block w-16 h-1 bg-gray-950 my-2" />
          <p className="text-xs sm:text-sm leading-relaxed mb-5">Currently in my third year of IT studies at WIT, constantly evolving my toolkit to create more impactful and efficient web solutions.</p>
          <p className="text-[10px] font-black uppercase text-[#FF4D8D] mb-2">Services</p>
          <div className="flex flex-wrap gap-2">{SERVICES.map(s => <span key={s} className="tk">{s}</span>)}</div>
        </section>
        <section className="relative z-10">
          <p className="text-[10px] font-black uppercase text-[#FF4D8D]">Stack</p>
          <h3 className="font-oswald text-3xl font-bold uppercase">Toolkit</h3>
          <span className="block w-16 h-1 bg-gray-950 my-2" />
          <div className="space-y-4">
            {Object.entries(TOOLS).map(([group, items]) => (
              <div key={group}>
                <span className="text-[10px] font-black text-gray-600">{group}</span>
                <div className="flex flex-wrap gap-2 mt-1.5">{items.map(t => <span key={t} className="tk hover:-translate-y-0.5 transition-transform">{t}</span>)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </SectionFrame>
  )
}

function Projects() {
  return (
    <SectionFrame id="works" no="005" label="PROJECTS" tag="SELECTED WORKS" tagClass="bg-[#0038FF] text-white" foot="PROJECTS">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-2 border-gray-950 pb-6">
        <div>
          <h2 className="glitch font-oswald text-5xl sm:text-7xl md:text-8xl font-bold uppercase tracking-tighter leading-none">PROJECT<span className="text-[#0038FF]">.</span></h2>
          <p className="mt-3 text-xs sm:text-sm text-gray-800 leading-relaxed">Selected UI and web projects I have designed and built while studying.</p>
        </div>
        <span className="text-[10px] font-black uppercase bg-[#FACC15] text-gray-950 border border-gray-950 px-3 py-1.5 shadow-[2px_2px_0_0_#000] rotate-1 w-fit">05 ENTRIES</span>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
        {PROJECTS.map(p => {
          const live = !!p.url
          const Thumb = live ? 'a' : 'div'
          const link = live ? { href: p.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Open ${p.host}` } : {}
          return (
            <article key={p.no} className="proj bg-white border-2 border-gray-950 shadow-[8px_8px_0_0_#000] transition-all flex flex-col">
              <Thumb {...link} className="relative block h-44 border-b-2 border-gray-950 overflow-hidden" style={{ background: p.bg }}>
                {p.img
                  ? <img src={p.img} alt={p.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                  : <span className="absolute inset-0 grid place-items-center font-oswald text-4xl font-bold text-white/90 mix-blend-difference">{live ? p.name : 'SOON'}</span>}
                <span className="absolute top-3 left-3 text-[9px] font-black px-2 py-0.5 border-2 border-gray-950 shadow-[2px_2px_0_0_#000] bg-[#22C55E] text-gray-950" style={live ? undefined : { background: '#FACC15' }}>{live ? 'LIVE' : 'SHOWCASE'}</span>
                <span className="absolute top-3 right-3 bg-gray-950 text-white text-xs font-black px-2 py-0.5">{p.no}</span>
              </Thumb>
              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-[#FF4D8D]">{p.kind}</p>
                  <h3 className="font-oswald text-3xl font-bold uppercase">{p.name}</h3>
                  <p className="text-xs leading-relaxed mt-2">{p.desc}</p>
                  <div className="flex flex-wrap gap-2 mt-3">{p.tags.map(t => <span key={t} className="tk text-[10px]! py-0.5!">{t}</span>)}</div>
                </div>
                <div className="flex justify-between items-center border-t-2 border-gray-950 pt-3 text-xs font-bold">
                  <span className="truncate">{p.host}</span>
                  {live
                    ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="bg-[#FACC15] text-gray-950 border-2 border-gray-950 px-3 py-1 shadow-[2px_2px_0_0_#000] hover:bg-gray-950 hover:text-white transition-colors">Visit ↗</a>
                    : <span className="border-2 border-gray-300 px-3 py-1 text-gray-500">Coming soon</span>}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </SectionFrame>
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const RULES = {
  name: v => v && v.length <= 100,
  email: v => EMAIL_RE.test(v) && v.length <= 255,
  subject: v => v && v.length <= 120,
  message: v => v && v.length <= 1000,
}
const FIELDS = [
  ['name', 'Full name', 'Your full name', 'text', 100, 'Please enter your name (max. 100 characters).'],
  ['email', 'Email', 'you@company.com', 'email', 255, 'Please enter a valid email address.'],
  ['subject', 'Subject', 'Project collaboration / inquiry', 'text', 120, 'Please enter a subject (max. 120 characters).'],
  ['message', 'Message', 'Tell me about your project or requirements...', 'textarea', 1000, 'Please enter your message (max. 1000 characters).'],
]

function Contact() {
  const [vals, setVals] = useState({ name: '', email: '', subject: '', message: '' })
  const [errs, setErrs] = useState({})
  const [status, setStatus] = useState(null) // {msg, bad}
  const [sending, setSending] = useState(false)

  const change = (id, v) => {
    setVals(s => ({ ...s, [id]: v }))
    if (v.trim()) setErrs(e => ({ ...e, [id]: false }))
  }

  const submit = async e => {
    e.preventDefault()
    const v = Object.fromEntries(Object.entries(vals).map(([k, x]) => [k, x.trim()]))
    const bad = Object.fromEntries(Object.keys(RULES).map(k => [k, !RULES[k](v[k])]))
    setErrs(bad)
    const first = Object.keys(bad).find(k => bad[k])
    if (first) {
      document.getElementById(first)?.focus()
      return setStatus({ msg: 'Some fields need your attention. Please review the highlighted items.', bad: true })
    }
    if (!window.confirm(`Send this message to ${EMAIL}?\n\nSubject: ${v.subject}`)) {
      return setStatus({ msg: 'Sending cancelled. Your message is still saved in the form.', bad: true })
    }
    setSending(true)
    setStatus({ msg: '📡 Transmitting...' })
    const reset = () => setVals({ name: '', email: '', subject: '', message: '' })
    if (!FORM_URL) {
      // no form service configured: open the visitor's email app addressed to you
      const body = `Name: ${v.name}\nEmail: ${v.email}\n\n${v.message}`
      setTimeout(() => {
        window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(v.subject)}&body=${encodeURIComponent(body)}`
        setSending(false)
        setStatus({ msg: '📡 Opening your email app to send the message…' })
        reset()
      }, 600)
      return
    }
    try {
      const res = await fetch(FORM_URL, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(v) })
      if (res.ok) { setStatus({ msg: "✓ Message received. I'll get back to you soon." }); reset() }
      else { const d = await res.json().catch(() => ({})); setStatus({ msg: '⚠️ Error: ' + (d.error || 'Something went wrong.'), bad: true }) }
    } catch { setStatus({ msg: '⚠️ Connection error. Please try again.', bad: true }) }
    setSending(false)
  }

  return (
    <section id="contact" className="border-t-4 border-gray-950 grid-blueprint-bg bg-[#FAFAFA] py-14 md:py-20 px-3 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <Reveal>
          <span className="inline-block bg-gray-950 text-white text-xs font-black px-2.5 py-1 shadow-[2px_2px_0_0_#FF4D8D]">007 // CONTACT</span>
          <h1 className="font-oswald text-6xl sm:text-8xl font-bold uppercase leading-[.9] tracking-tighter mt-4 mb-8">
            Let’s <mark className="bg-[#FACC15] text-gray-950 px-2">Build</mark><br />Something.
          </h1>
          <div className="bg-white border-2 border-gray-950 shadow-[10px_10px_0_0_#000] p-5 sm:p-8">
            <h2 className="font-oswald text-3xl font-bold uppercase">Send a Message</h2>
            <p className="text-xs text-gray-600 mb-6">$ ./send --to austin</p>
            <form onSubmit={submit} noValidate>
              {FIELDS.map(([id, label, ph, type, max, msg]) => (
                <div key={id} className={`mb-5 ${errs[id] ? 'has-error' : ''}`}>
                  <label htmlFor={id} className="block text-xs font-black uppercase mb-1.5">{label}</label>
                  {type === 'textarea'
                    ? <textarea id={id} rows={6} maxLength={max} placeholder={ph} value={vals[id]} onChange={e => change(id, e.target.value)} className="ax-in" aria-invalid={!!errs[id]} />
                    : <input id={id} type={type} maxLength={max} placeholder={ph} value={vals[id]} onChange={e => change(id, e.target.value)} className="ax-in" aria-invalid={!!errs[id]} />}
                  <span className="err">{msg}</span>
                </div>
              ))}
              <button type="submit" disabled={sending} className="bg-[#FF4D8D] text-white border-2 border-gray-950 px-6 py-3 font-black uppercase text-sm shadow-[5px_5px_0_0_#000] hover:bg-[#0038FF] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-60">
                ▶ <span>{sending ? 'Sending...' : 'Send Message'}</span>
              </button>
              {status && <p role="status" aria-live="polite" className={`mt-4 text-sm font-bold ${status.bad ? 'text-rose-600' : 'text-emerald-600'}`}>{status.msg}</p>}
            </form>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Footer() {
  const btn = 'font-mono text-xs sm:text-sm font-black uppercase bg-white text-gray-950 border-2 border-white px-5 py-2.5 rounded-full active:translate-x-1 active:translate-y-1 active:shadow-none transition-all inline-flex gap-2'
  return (
    <footer id="footer" className="bg-[#111] text-white border-t-4 border-gray-950 py-10 px-4 sm:px-6">
      <div className="max-w-[1700px] mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-gray-800 pb-4 gap-4 font-mono text-xs uppercase font-bold text-gray-400">
          <span className="flex items-center gap-3 text-white font-black"><i className="w-2.5 h-2.5 bg-[#22C55E] rounded-full animate-pulse" />SYSTEM TERMINATED // END OF PAGE</span>
          <div className="h-4 w-36 tech-barcode" />
        </div>
        <div className="grid lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-6 space-y-2">
            <h2 className="font-oswald text-5xl sm:text-7xl md:text-8xl font-bold uppercase tracking-tighter leading-none">AUSTIN<span className="text-[#FF4D8D]"> ARABIA</span></h2>
            <p className="font-mono text-xs text-gray-400 max-w-xs">I am BSIT Student In {PROFILE.school}.</p>
          </div>
          <ul className="lg:col-span-6 flex flex-wrap gap-4 lg:justify-end">
            <li><a href="#contact" className={`${btn} shadow-[4px_4px_0_0_#0038FF] hover:bg-[#0038FF] hover:text-white hover:border-[#0038FF]`}>CONNECT WITH ME [-&gt;]</a></li>
            <li><a href={`mailto:${EMAIL}`} className={`${btn} shadow-[4px_4px_0_0_#FF4D8D] hover:bg-[#FF4D8D] hover:text-white hover:border-[#FF4D8D]`}>EMAIL [-&gt;]</a></li>
          </ul>
        </div>
        <div className="pt-4 border-t border-gray-800 text-center font-mono text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-widest">
          <p>© 2026 {PROFILE.full} — ALL RIGHTS RESERVED</p>
        </div>
      </div>
    </footer>
  )
}

export { Navbar, Hero, About, TechStack, SkillMatrix, Projects, Contact, Footer, Reveal, SectionFrame }
