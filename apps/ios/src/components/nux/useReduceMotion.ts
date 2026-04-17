import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/** Tracks the system "Reduce Motion" preference. Decorative animations should
 *  degrade to fades when this returns true; functional ones (progress, fill)
 *  stay visible. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduce(value)
    })
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduce,
    )
    return () => {
      mounted = false
      sub.remove()
    }
  }, [])

  return reduce
}
