import { addLowPowerModeListener, getLowPowerModeEnabled } from '@dit/dit-native'
import { useEffect, useState } from 'react'

/** Tracks the system low power mode flag from the native layer. */
export const useSystemLowPowerMode = () => {
  const [isSystemLowPowerModeEnabled, setIsSystemLowPowerModeEnabled] = useState(false)

  useEffect(() => {
    let isMounted = true

    void getLowPowerModeEnabled().then((enabled) => {
      if (isMounted) {
        setIsSystemLowPowerModeEnabled(enabled)
      }
    })

    const subscription = addLowPowerModeListener((enabled) => {
      setIsSystemLowPowerModeEnabled(enabled)
    })

    return () => {
      isMounted = false
      subscription.remove()
    }
  }, [])

  return isSystemLowPowerModeEnabled
}
