/**
 * Stacked overlays layered above the liquid shader: a black dim that pulls
 * the shader brightness back, and three soft radial gradients matching
 * apps/ios/src/components/BackgroundGlow.tsx so both platforms share the
 * same chromatic atmosphere.
 */
export function BackgroundGlow() {
  return (
    <>
      <div className="background-dim" aria-hidden="true" />
      <div className="background-glow" aria-hidden="true" />
    </>
  )
}
