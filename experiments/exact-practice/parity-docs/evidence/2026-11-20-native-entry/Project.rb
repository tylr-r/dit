require 'xcodeproj'
project = Xcodeproj::Project.new('DitComparison.xcodeproj')
target = project.new_target(:ui_test_bundle, 'DitComparison', :ios, '26.0')
target.add_file_references([project.main_group.new_reference('MatchedEntry.swift')])
target.build_configurations.each do |c|
  c.build_settings.merge!({'GENERATE_INFOPLIST_FILE'=>'YES','PRODUCT_BUNDLE_IDENTIFIER'=>'com.tylerobinson.dit.paritytests','SWIFT_VERSION'=>'5.0','TARGETED_DEVICE_FAMILY'=>'1','SUPPORTED_PLATFORMS'=>'iphonesimulator','SDKROOT'=>'iphonesimulator'})
end
project.save
scheme=Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project.path,'DitComparison')
