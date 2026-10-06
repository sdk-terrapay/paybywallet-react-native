#import "RNPayByWallet.h"

#if __has_include(<RNPayByWallet/RNPayByWallet-Swift.h>)
#import <RNPayByWallet/RNPayByWallet-Swift.h>
#else
#import "RNPayByWallet-Swift.h"
#endif

/// Turbo Module shell. Codegen requires an Objective-C++ entry point; the real
/// work lives in `PayByWalletBridge.swift`, which talks to the Swift SDK.
@implementation RNPayByWallet {
  PayByWalletBridge *_bridge;
}

- (instancetype)init
{
  if (self = [super init]) {
    __weak RNPayByWallet *weakSelf = self;
    _bridge = [[PayByWalletBridge alloc] initWithEmit:^(NSDictionary *event) {
      [weakSelf emitOnEvent:event];
    }];
  }
  return self;
}

+ (NSString *)moduleName
{
  return @"PayByWallet";
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)launch:(JS::NativePayByWallet::NativeConfig &)config
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  // Copy out of the C++ struct now: it does not outlive this call.
  NSDictionary *args = @{
    @"accessToken" : config.accessToken() ?: @"",
    @"refreshToken" : config.refreshToken() ?: @"",
    @"subscriberDialCode" : config.subscriberDialCode() ?: @"",
    @"subscriberCountry" : config.subscriberCountry() ?: @"",
    @"subscriberCountryName" : config.subscriberCountryName() ?: @"",
    @"subscriberName" : config.subscriberName() ?: @"",
    @"subscriberMSISDN" : config.subscriberMSISDN() ?: @"",
    @"subscriberCurrency" : config.subscriberCurrency() ?: @"",
    @"walletBalance" : @(config.walletBalance()),
    @"primaryColor" : config.primaryColor() ?: @"",
    @"secondaryColor" : config.secondaryColor() ?: @"",
    @"environment" : config.environment() ?: @"sandbox",
  };

  [_bridge launch:args
          resolve:^{ resolve(nil); }
           reject:^(NSString *code, NSString *message) { reject(code, message, nil); }];
}

- (void)processPayment:(NSString *)transactionId
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [_bridge processPayment:transactionId
                  resolve:^{ resolve(nil); }
                   reject:^(NSString *code, NSString *message) { reject(code, message, nil); }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativePayByWalletSpecJSI>(params);
}

@end
