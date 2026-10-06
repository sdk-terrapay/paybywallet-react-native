require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNPayByWallet"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  # The TerraPay PayByWallet SDK is built for iOS 15.0+.
  s.platforms    = { :ios => "15.0" }
  s.source       = { :git => "https://github.com/sdk-terrapay/paybywallet-react-native.git", :tag => "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.private_header_files = "ios/**/*.h"
  s.swift_version = "5.0"

  # The pre-built SDK travels with the package, so embedding apps need no
  # manual framework wiring. It is a dynamic framework; CocoaPods' "Embed Pods
  # Frameworks" phase copies it into the app.
  #
  # dSYMs are stripped from the vendored copy (Xcode discards them when
  # packaging an app anyway). Re-strip after refreshing the xcframework:
  #   rm -rf ios/Frameworks/TerraPayWalletSDK.xcframework/*/dSYMs
  s.vendored_frameworks = "ios/Frameworks/TerraPayWalletSDK.xcframework"
  s.resource_bundles = { "RNPayByWallet_privacy" => ["ios/PrivacyInfo.xcprivacy"] }

  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
  }

  install_modules_dependencies(s)
end
