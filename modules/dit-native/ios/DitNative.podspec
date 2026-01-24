require 'json'

Pod::Spec.new do |s|
  s.name           = 'DitNative'
  s.version        = '0.0.1'
  s.summary        = 'Native code for Dit'
  s.description    = 'Native code for Dit application including Audio, Haptics and Auth'
  s.license        = 'MIT'
  s.author         = 'Dit Team'
  s.homepage       = 'https://github.com/tylr-r/dit'
  
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.4'

  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'Firebase/Auth'
  s.dependency 'GoogleSignIn'

  s.source_files = "**/*.{h,m,swift}"
end
