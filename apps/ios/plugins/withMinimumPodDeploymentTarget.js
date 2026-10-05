const { withPodfile } = require('expo/config-plugins')

const marker = '# Dit: align all pod targets, including resource bundles, with the app minimum.'
const hook = `
    ${marker}
    minimum_deployment_target = Gem::Version.new(podfile_properties['ios.deploymentTarget'] || '15.1')
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |configuration|
        current_target = configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current_target && Gem::Version.new(current_target) < minimum_deployment_target
          configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum_deployment_target.to_s
        end
      end
    end
`

/** Raises old pod resource-bundle targets without lowering newer platform requirements. */
function configureMinimumPodDeploymentTarget(podfile) {
  if (podfile.includes(marker)) return podfile
  const postInstall = /react_native_post_install\(\s*installer,[\s\S]*?\n[ \t]*\)/
  if (!postInstall.test(podfile)) throw new Error('Cannot find React Native post-install hook in Podfile')
  return podfile.replace(postInstall, (match) => `${match}\n${hook}`)
}

/** Keeps CocoaPods resource targets compatible with the configured app deployment target. */
module.exports = function withMinimumPodDeploymentTarget(config) {
  return withPodfile(config, (config) => {
    config.modResults.contents = configureMinimumPodDeploymentTarget(config.modResults.contents)
    return config
  })
}
module.exports.configureMinimumPodDeploymentTarget = configureMinimumPodDeploymentTarget
