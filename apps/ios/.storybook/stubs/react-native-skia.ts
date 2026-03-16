import React from 'react'

const noop = () => null
const noopObj = new Proxy({}, { get: () => noop })

export const Canvas = noop
export const RoundedRect = noop
export const Shader = noop
export const Skia = {
  RuntimeEffect: { Make: () => null },
  XYWHRect: () => null,
  RRectXY: () => null,
}
