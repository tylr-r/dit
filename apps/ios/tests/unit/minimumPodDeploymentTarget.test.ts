import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { configureMinimumPodDeploymentTarget } = require('../../plugins/withMinimumPodDeploymentTarget.js')

describe('CocoaPods deployment target configuration', () => {
  it('adds the resource-bundle fix inside post_install and stays idempotent', () => {
    const source = `target 'Dit' do
  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
    )
  end
end
`
    const updated = configureMinimumPodDeploymentTarget(source)
    expect(updated).toContain('installer.pods_project.targets.each')
    expect(updated).toContain('Gem::Version.new(current_target) < minimum_deployment_target')
    expect(updated.indexOf('installer.pods_project.targets.each')).toBeLessThan(updated.lastIndexOf('  end'))
    expect(configureMinimumPodDeploymentTarget(updated)).toBe(updated)
  })

  it('reports changed Podfile templates instead of silently skipping the fix', () => {
    expect(() => configureMinimumPodDeploymentTarget('')).toThrow('Cannot find React Native post-install hook')
  })
})
