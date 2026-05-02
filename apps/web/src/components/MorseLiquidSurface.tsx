import { shader as shaderTokens } from '@dit/core'
import { useEffect, useRef } from 'react'

const TARGET_FPS = 24
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS
const PAUSE_FADE_OUT_MS = 420
const PAUSE_FADE_IN_MS = 320
const MAX_DPR = 1.5
// Web feels noticeably brisker than iOS at parity speed (display refresh +
// viewport size). Halve the wall-clock advance so the swirl reads as ambient
// rather than jittery on a desktop screen.
const SPEED_MULTIPLIER = 0.3

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision mediump float;

uniform float iTime;
uniform vec2 iResolution;

const float PI = 3.14159265;

mat2 rotate2d(float angle) {
  return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs((q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = (fragCoord * 2.0 - iResolution.xy) / min(iResolution.x, iResolution.y);

  float t = iTime * (2.0 * PI / ${shaderTokens.liquidCycleSeconds.toFixed(1)});

  uv += vec2(0.15 * cos(t), 0.15 * sin(t));
  uv *= rotate2d(0.8);

  for (float i = 1.0; i < 4.5; i++) {
    uv.x += 0.5 / i * sin(i * 1.6 * uv.y + t);
    uv.y += 0.5 / i * cos(i * 1.7 * uv.x + t + 1.5);
  }

  float r = 0.5 * abs(sin(uv.x + t));
  float g = 0.5 * abs(sin(uv.y + t + 2.0));
  float b = 0.6 * abs(sin(uv.x + uv.y));

  vec3 col = vec3(r, g, b);
  col = pow(col, vec3(2.0));
  col = clamp(col, 0.0, 1.0);

  float shine = max(0.0, dot(normalize(col), vec3(0.577)));
  col += pow(shine, 8.0) * 0.15;

  float maxChannel = max(col.r, max(col.g, col.b));
  float fade = smoothstep(0.15, 0.35, maxChannel);
  col *= fade;

  vec3 hsv = rgb2hsv(col);
  hsv.x = ${shaderTokens.liquidHue.toFixed(6)};
  col = hsv2rgb(hsv);

  gl_FragColor = vec4(col, 1.0);
}
`

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    if (import.meta.env.DEV) {
      console.error('[MorseLiquidSurface] shader compile failed:', gl.getShaderInfoLog(shader))
    }
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  if (!vs || !fs) return null
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    if (import.meta.env.DEV) {
      console.error('[MorseLiquidSurface] program link failed:', gl.getProgramInfoLog(program))
    }
    gl.deleteProgram(program)
    return null
  }
  return program
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Full-viewport WebGL canvas mirroring the iOS liquid shader. Honors
 * prefers-reduced-motion (single static frame) and document visibility
 * (paused with cross-fade). Falls back silently if WebGL is unavailable.
 */
export function MorseLiquidSurface() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl =
      (canvas.getContext('webgl', {
        antialias: false,
        premultipliedAlpha: true,
      }) as WebGLRenderingContext | null) ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
    if (!gl) {
      // Silent fallback — solid backdrop stays visible underneath.
      canvas.style.display = 'none'
      return
    }

    const program = createProgram(gl)
    if (!program) {
      canvas.style.display = 'none'
      return
    }

    const positionLoc = gl.getAttribLocation(program, 'a_position')
    const iTimeLoc = gl.getUniformLocation(program, 'iTime')
    const iResolutionLoc = gl.getUniformLocation(program, 'iResolution')

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )
    gl.useProgram(program)
    gl.enableVertexAttribArray(positionLoc)
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

    let width = 0
    let height = 0
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio ?? 1, MAX_DPR)
      const w = Math.max(1, Math.floor(rect.width * dpr))
      const h = Math.max(1, Math.floor(rect.height * dpr))
      if (w === width && h === height) return
      width = w
      height = h
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
    }
    resize()

    const ro = new ResizeObserver(() => {
      resize()
    })
    ro.observe(canvas)

    const reduceMotion = prefersReducedMotion()

    let rafId: number | null = null
    let lastFrameTime = performance.now()
    let accumMs = 0
    let elapsedSeconds = 0
    let paused = document.visibilityState === 'hidden'
    let opacity = paused ? 0 : 1
    let opacityTarget = paused ? 0 : 1
    let opacityChangedAt = performance.now()
    let opacityFadeMs = 0

    canvas.style.opacity = String(opacity)

    const drawFrame = () => {
      gl.uniform1f(iTimeLoc, elapsedSeconds)
      gl.uniform2f(iResolutionLoc, width, height)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    if (reduceMotion) {
      // Render a single frozen frame at t=0.
      drawFrame()
      return () => {
        ro.disconnect()
        gl.deleteProgram(program)
        gl.deleteBuffer(buffer)
      }
    }

    const tick = (now: number) => {
      const delta = now - lastFrameTime
      lastFrameTime = now

      // Opacity tween.
      if (opacity !== opacityTarget) {
        const tweenT = Math.min(1, opacityFadeMs > 0 ? (now - opacityChangedAt) / opacityFadeMs : 1)
        opacity = opacityTarget * tweenT + opacity * (1 - tweenT) // approximate ease
        // Snap when very close.
        if (Math.abs(opacity - opacityTarget) < 0.01) {
          opacity = opacityTarget
        }
        canvas.style.opacity = String(opacity)
      }

      if (!paused) {
        accumMs += delta
        if (accumMs >= FRAME_INTERVAL_MS) {
          elapsedSeconds =
            (elapsedSeconds + (accumMs / 1000) * SPEED_MULTIPLIER) % shaderTokens.liquidCycleSeconds
          accumMs = 0
          drawFrame()
        }
      }

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    const setPaused = (next: boolean) => {
      if (paused === next) return
      paused = next
      opacityTarget = next ? 0 : 1
      opacityFadeMs = next ? PAUSE_FADE_OUT_MS : PAUSE_FADE_IN_MS
      opacityChangedAt = performance.now()
      if (!next) {
        // Reset the accumulator so we don't fast-forward the shader on resume.
        accumMs = 0
        lastFrameTime = performance.now()
      }
    }

    const onVisibility = () => {
      setPaused(document.visibilityState === 'hidden')
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      ro.disconnect()
      if (rafId !== null) cancelAnimationFrame(rafId)
      gl.deleteProgram(program)
      gl.deleteBuffer(buffer)
    }
  }, [])

  return <canvas ref={canvasRef} className="morse-liquid-surface" aria-hidden="true" />
}
