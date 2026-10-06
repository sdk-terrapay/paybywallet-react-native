# 📦 TerraPay PayByWallet SDK for React Native

This SDK, provided by TerraPay, enables seamless payment transactions between
customers and merchants through the partner mobile application. It supports
QR code scanning and merchant ID–based payments, and wraps the native TerraPay
Android and iOS SDKs in a single React Native Turbo Module.

```text
              React Native (this package)
                         |
              +----------+----------+
              |                     |
        iOS bridge            Android bridge
              |                     |
   TerraPayWalletClient        TerraPayClient
   (TerraPayWalletSDK)         (payByWallet .aar)
```

## 🚀 Features

- QR Code and Merchant ID Payments.
- Customizable User Experience with brand colors.
- Launch SDK with a single entry point.
- Typed TypeScript API; events delivered as a discriminated union.

## 📲 Requirements

- React Native 0.76+ with the **New Architecture** (default since 0.76, mandatory since 0.82)
- **Android** — minSdk 28, compileSdk 36, JDK 17
- **iOS** — 15.0+, Xcode 16+

## 🔧 Installation

```sh
yarn add @terrapay/react-native-paybywallet
# or, from git:
yarn add "@terrapay/react-native-paybywallet@git+https://github.com/sdk-terrapay/paybywallet-react-native.git#v1.0.0"

cd ios && pod install
```

The native Android and iOS SDKs ship inside the package — there are no
frameworks to embed, no `.aar` to copy and no ProGuard rules to add. Rebuild the
app after installing (a Metro reload does not pick up native modules).

## 🛠️ Platform setup

### Android

```groovy
// android/build.gradle
buildscript {
    ext {
        minSdkVersion = 28      // required by the SDK
        compileSdkVersion = 36
        targetSdkVersion = 36
    }
}
```

Internet, camera and NFC permissions, and the R8 keep-rules, are contributed by
the package automatically. NFC host-card-emulation is marked *not required* so
the app still installs on emulators and non-NFC handsets.

### iOS

In `ios/Podfile`:

```ruby
platform :ios, '15.0'
```

`Info.plist` must contain `NSCameraUsageDescription` — the app crashes when the
QR scanner opens, and is rejected at review, without it:

```xml
<key>NSCameraUsageDescription</key>
<string>This will allow <your-app-name> to scan QR Code.</string>
```

## 🔐 Authentication (OAuth2)

The SDK requires an **access token** and a **refresh token**, obtained before
launch:

```
GET {base-url}/eig/getToken?subscriberid=%2B254712345678
user: <supplied by TerraPay>
password: <supplied by TerraPay>
```

```json
{
  "status": "OK",
  "subStatus": "Success",
  "access_token": "eyJhbGciOiJIUzI1NiJ9…",
  "refresh_token": "eyJhbGciOiJIUzI1NiJ9…",
  "expiry": "300"
}
```

- `subscriberid` is the **dial code plus MSISDN**, and the leading `+` must be
  percent-encoded as `%2B` (`encodeURIComponent` does this).
- `expiry` is a **string** of seconds, not a number.

> Perform this call from **your backend** and have the app fetch the token pair
> from your own API. Credentials compiled into an app can be extracted.

`example/src/tokenService.ts` has a reference implementation.

## 🌍 Environments

| Environment | Token endpoint (`baseUrl`) | `environment` |
| --- | --- | --- |
| UAT / sandbox | `https://uat-connect.terrapay.com:27211` | `'sandbox'` (default) |
| Production | `https://api-payments.terrapay.com:27211` | `'production'` |

Production requires separate credentials. Request them from
sdk-support@terrapay.com before go-live.

## 🛠️ Usage

### Config parameters

| Parameter | Required | Validation rule |
| --- | --- | --- |
| `accessToken` | Yes | OAuth2 access token from your backend |
| `refreshToken` | Yes | OAuth2 refresh token from your backend |
| `subscriberDialCode` | Yes | Must match `^\+\d+$` |
| `subscriberMsisdn` | Yes | Digits only, no dial code; length validated per country |
| `subscriberName` | Yes | Must not be empty |
| `subscriberCountry` | Yes | ISO 3166-1 alpha-2 |
| `subscriberCountryName` | Yes | Must not be empty |
| `subscriberCurrency` | Yes | ISO 4217 |
| `walletBalance` | Yes | Number |
| `primaryColor` | Yes | 6-digit hex, no `#` (e.g. `EC1B24`) |
| `secondaryColor` | Yes | 6-digit hex, no `#` (e.g. `FFFFFF`) |
| `environment` | No | `'sandbox'` (default) or `'production'` |
| `referenceNumber` | No | Android only |

### 1. Subscribe to events

Subscribe **before** calling `launch()`:

```tsx
import { PayByWallet } from '@terrapay/react-native-paybywallet';

useEffect(() => {
  const sub = PayByWallet.addListener((event) => {
    switch (event.type) {
      case 'pinAuthenticate':
        // Show your own PIN screen; on success call processPayment().
        openPinScreen(event.merchant); // { merchantName, amount, currency }
        break;
      case 'paymentSuccess':
        showReceipt(event.result);     // { responseStatus, responseMessage, gatewayReferenceId, orderId }
        break;
      case 'paymentFailure':
        showFailure(event.result);
        break;
      case 'error':
        showError(`${event.code}: ${event.message}`);
        break;
      case 'cancelled':                // user cancelled the flow
      case 'closed':                   // UI dismissed without a result
        break;
    }
  });
  return () => sub.remove();
}, []);
```

### 2. Launch

```tsx
try {
  await PayByWallet.launch({
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    subscriberDialCode: '+254',
    subscriberCountry: 'KE',
    subscriberCountryName: 'Kenya',
    subscriberName: 'Jane Wanjiru',
    subscriberMsisdn: '712345678',
    subscriberCurrency: 'KES',
    walletBalance: 9999654.5,
    primaryColor: '52B44A',
    secondaryColor: 'FFFFFF',
    environment: 'sandbox',
  });
} catch (e: any) {
  // Rejected config: e.code is one of the error codes below.
}
```

### 3. Process the payment after PIN verification

**The SDK never collects the user's PIN.** On `pinAuthenticate` it hands
control back to your app. Authenticate the user however your wallet normally
does, then:

```ts
await PayByWallet.processPayment(orderId);
```

`orderId` must be **unique per transaction** and alphanumeric — e.g. `TXN`
followed by 12 digits. Reusing an id causes the payment to be rejected.

## ⚠️ Error codes

`event.code` on an `error` event, or `e.code` on a rejected promise:

| Code | Meaning |
| --- | --- |
| `INVALID_CONTEXT` | No foreground activity / view controller to present from |
| `INVALID_ENVIRONMENT` | `environment` is not `sandbox` or `production` |
| `INVALID_DIAL_CODE` | `subscriberDialCode` is not `+` followed by digits |
| `INVALID_MSISDN` | MSISDN empty, non-numeric, or wrong length for the country |
| `INVALID_NAME` | `subscriberName` is empty |
| `INVALID_COUNTRY_CODE` | Not a valid ISO 3166-1 alpha-2 code |
| `INVALID_COUNTRY_NAME` | `subscriberCountryName` is empty |
| `INVALID_CURRENCY` | Not a valid ISO 4217 code |
| `INVALID_WALLET_BALANCE` | Balance missing or not a number |
| `INVALID_PRIMARY_COLOR` | Not a 6-digit hex value |
| `INVALID_SECONDARY_COLOR` | Not a 6-digit hex value |
| `INVALID_TRANSACTION_ID` | `processPayment` called with an empty order id |
| `NETWORK_ERROR` | The device could not reach the gateway |

Config validation on Android happens synchronously, so a bad config rejects
`launch()`. On iOS the SDK validates after presenting and reports an `error`
event instead — handle both.

## 🧩 Troubleshooting

| Symptom | Cause |
| --- | --- |
| `TurboModuleRegistry.getEnforcing(...): 'PayByWallet' could not be found` | Native rebuild needed after install (`pod install`, then rebuild) |
| Camera preview black / crash when scanning | `NSCameraUsageDescription` missing or camera permission denied |
| Release build works but payments silently fail | Custom ProGuard config stripping the SDK — the package ships the required keep-rules, do not exclude them |
| `Manifest merger failed : uses-sdk:minSdkVersion 24` | Set `minSdkVersion = 28` in `android/build.gradle` |
| Gradle fails with a bare version number | Wrong JDK; build with JDK 17 |

## 🧪 Example app

```sh
yarn
cp example/src/credentials.example.ts example/src/credentials.ts   # add UAT pair
yarn example android
cd example/ios && pod install && cd ../.. && yarn example ios
```

Demo PIN is `1234`.

## 🔄 Updating the native SDKs

| Platform | File | After replacing |
| --- | --- | --- |
| iOS | `ios/Frameworks/TerraPayWalletSDK.xcframework` | `rm -rf ios/Frameworks/TerraPayWalletSDK.xcframework/*/dSYMs` |
| Android | `android/libs/payByWallet-release.aar` | Re-check transitive deps in `android/build.gradle` and keep-rules in `android/consumer-rules.pro` |

## 🔐 License

Released under the MIT License. See [LICENSE](LICENSE).

## 📬 Contact

For support or inquiries, email: sdk-support@terrapay.com
