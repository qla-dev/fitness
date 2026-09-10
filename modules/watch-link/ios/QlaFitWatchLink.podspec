Pod::Spec.new do |s|
  s.name           = 'QlaFitWatchLink'
  s.version        = '1.0.0'
  s.summary        = 'Phone-side WatchConnectivity bridge for live Apple Watch heart rate.'
  s.description    = 'Receives heart-rate and workout-state messages streamed by the qla.fit watchOS app.'
  s.author         = ''
  s.homepage       = 'https://qla.fit'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
