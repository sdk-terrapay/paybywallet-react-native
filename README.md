# 📦 TerraPay PayByWallet SDK for React Native

This SDK, provided by TerraPay, enables seamless payment transactions between
customers and merchants through the partner mobile application. It supports
multiple payment methods, including QR code scanning and merchant ID–based
payments, and is designed for easy integration with React Native applications
on Android and iOS.

## 🚀 Features

- QR Code and Merchant ID Payments.
- Customizable User Experience with brand colors.
- Launch SDK with a single entry point.
- Easily embeddable into any React Native app, with a typed TypeScript API.

## 📲 Requirements

- React Native 0.76+ with the **New Architecture** (default since 0.76, mandatory since 0.82)
- **Android** — minSdk 28, compileSdk 36, JDK 17
- **iOS** — 15.0+, Xcode 16+

## 🔧 Installation

Add the dependency to your `package.json`:

```sh
yarn add "@terrapay/react-native-paybywallet@git+https://github.com/sdk-terrapay/paybywallet-react-native.git#v1.0.0"

cd ios && pod install
```

Pin the git ref to a release tag. Tracking a branch would give your developers
and your CI different code depending on when each last installed.

The native Android and iOS SDKs ship inside the package — there are no
frameworks to embed, no `.aar` to copy and no ProGuard rules to add. Rebuild the
app after installing; a Metro reload does not pick up native modules.

## 🛠️ Permissions and platform setup

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

Build with JDK 17.

Internet, camera and NFC permissions, and the R8 keep-rules, are contributed by
the package automatically. NFC host-card-emulation is marked *not required* so
the app still installs on emulators and non-NFC handsets.

### iOS

Set the deployment target in `ios/Podfile`:

```ruby
platform :ios, '15.0'
```

`Info.plist` must contain `NSCameraUsageDescription` with a string explaining
how the app uses the camera — the app crashes at runtime and is rejected at
review without it:

```xml
<key>NSCameraUsageDescription</key>
<string>This will allow <your-app-name> to scan QR Code.</string>
```

**When building with Xcode 27 (iOS 27 SDK) or later** the app must adopt the
UIScene lifecycle, which the React Native template does not yet do. Without it
the app launches to a blank white screen and is terminated. The requirement
follows the SDK the app is built with, not the iOS version of the device, and
the change is safe for older SDKs too.

Add a scene manifest to `Info.plist`:

```xml
<key>UIApplicationSceneManifest</key>
<dict>
    <key>UIApplicationSupportsMultipleScenes</key><false/>
    <key>UISceneConfigurations</key>
    <dict>
        <key>UIWindowSceneSessionRoleApplication</key>
        <array>
            <dict>
                <key>UISceneConfigurationName</key><string>Default Configuration</string>
                <key>UISceneDelegateClassName</key><string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
            </dict>
        </array>
    </dict>
</dict>
```

Then start React Native from a scene delegate instead of from
`application(_:didFinishLaunchingWithOptions:)`:

```swift
// ios/<YourApp>/AppDelegate.swift
@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()
    reactNativeDelegate = delegate
    reactNativeFactory = factory
    return true   // window is created in SceneDelegate
  }

  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
  }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "<YourAppName>",
      in: window,
      launchOptions: nil
    )
  }
}
```

## 🔐 Authentication (OAuth2)

The SDK requires OAuth2 authentication. Your application must obtain both an
**access token** and a **refresh token** before launching the SDK, and pass both
in during initialization.

**Token generation endpoint**

```
GET {base-url}/eig/getToken?subscriberid=%2B254712345678
user: <supplied by TerraPay>
password: <supplied by TerraPay>
```

**Sample response**

```json
{
  "status": "OK",
  "subStatus": "Success",
  "access_token": "eyJhbGciOiJIUzI1NiJ9…",
  "refresh_token": "eyJhbGciOiJIUzI1NiJ9…",
  "expiry": "300"
}
```

Two details that commonly cause failures:

- `subscriberid` is the **dial code plus MSISDN** (`+254712345678`), and the
  leading `+` must be percent-encoded as `%2B`. Sent raw it arrives as a space
  and the lookup fails.
- `expiry` is returned as a **string** (`"300"`, seconds), not a number. Treat
  it as a string and parse it.

Refresh before expiry to keep long sessions alive.

> Perform this call from **your backend** and have the app fetch the token pair
> from your own API. Credentials compiled into an app can be extracted from the
> APK or IPA.

### Reference implementation

The same request in TypeScript, useful for a prototype or to verify your
credentials end to end:

```ts
export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
};

export async function fetchToken(opts: {
  baseUrl: string;   // see Environments below
  user: string;      // supplied by TerraPay
  password: string;  // supplied by TerraPay
  dialCode: string;  // '+254'
  msisdn: string;    // '712345678'
}): Promise<TokenPair> {
  // encodeURIComponent turns the leading '+' into %2B. Interpolating it
  // unencoded makes the gateway receive a space.
  const url =
    `${opts.baseUrl}/eig/getToken` +
    `?subscriberid=${encodeURIComponent(opts.dialCode + opts.msisdn)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        user: opts.user,
        password: opts.password,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (response.status !== 200) {
    throw new Error(`Token request failed: HTTP ${response.status}`);
  }

  const body = await response.json();
  const accessToken: string = body.access_token ?? '';
  if (!accessToken) {
    throw new Error(`Token rejected: ${body.subStatus ?? body.status}`);
  }

  // `expiry` arrives as a string, so parse rather than trust the type.
  const expiry = Number.parseInt(String(body.expiry), 10);

  return {
    accessToken,
    refreshToken: body.refresh_token ?? '',
    expiresInSeconds: Number.isFinite(expiry) ? expiry : 300,
  };
}
```

No extra dependencies — it uses the built-in `fetch`.

## 🌍 Environments

| Environment | Token endpoint (`baseUrl`) |
| --- | --- |
| UAT / sandbox | `https://uat-connect.terrapay.com:27211` |
| Production | `https://api-payments.terrapay.com:27211` |

Production requires separate credentials — your UAT `user` / `password` pair
will not authenticate against it.

Both platforms switch at runtime through the config:

```ts
PayByWallet.launch({
  // ...
  environment: 'production',   // default: 'sandbox'
});
```

Request production credentials from sdk-support@terrapay.com before your
go-live date.

## 🛠️ Usage

### Config params validation

| Parameter | Required | Validation rule |
| --- | --- | --- |
| `accessToken` | Yes | OAuth2 access token from your backend |
| `refreshToken` | Yes | OAuth2 refresh token from your backend |
| `subscriberDialCode` | Yes | Must match the pattern `^\+\d+$` |
| `subscriberMsisdn` | Yes | Digits only, no dial code; length validated per country |
| `subscriberName` | Yes | Must not be empty |
| `subscriberCountry` | Yes | Valid ISO 3166-1 alpha-2 country code |
| `subscriberCountryName` | Yes | Must not be empty |
| `subscriberCurrency` | Yes | Valid ISO 4217 currency code |
| `walletBalance` | Yes | Must not be null; numeric |
| `primaryColor` | Yes | Valid 6-digit hex code, no `#` (e.g. `EC1B24`) |
| `secondaryColor` | Yes | Valid 6-digit hex code, no `#` (e.g. `FFFFFF`) |
| `environment` | No | `'sandbox'` (default) or `'production'` |

#### 1. Import the SDK

```ts
import { PayByWallet } from '@terrapay/react-native-paybywallet';
```

#### 2. Initialize and launch the SDK

```ts
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
    primaryColor: '52B44A',     // your brand colour
    secondaryColor: 'FFFFFF',
    environment: 'sandbox',
  });
} catch (e: any) {
  showError(`${e.code}: ${e.message}`);   // config rejected
}
```

On Android, `launch()` validates the configuration synchronously and rejects
the promise if it is invalid, so you can surface the error immediately. On iOS
the SDK validates after presenting and reports an `error` event instead —
handle both.

#### 3. Handle the SDK results

Subscribe before calling `launch()`. Events arrive as a typed discriminated
union:

```tsx
useEffect(() => {
  const sub = PayByWallet.addListener(async (event) => {
    switch (event.type) {
      case 'pinAuthenticate': {
        // PIN/OTP authentication is required. Open your own PIN screen,
        // validate the user, then confirm the payment.
        const ok = await showMyPinScreen(event.merchant);
        if (ok) await PayByWallet.processPayment(generateOrderId());
        break;
      }
      case 'paymentSuccess':
        showReceipt(event.result);          // transaction succeeded
        break;
      case 'paymentFailure':
        showFailure(event.result);          // transaction failed
        break;
      case 'error':
        showError(`${event.code}: ${event.message}`); // invalid parameters or SDK error
        break;
      case 'cancelled':                     // user cancelled the flow
      case 'closed':                        // UI dismissed, no result
        break;
    }
  });
  return () => sub.remove();
}, []);
```

`event.result` carries `responseStatus`, `responseMessage`,
`gatewayReferenceId` and `orderId`.

#### 4. Process payment after PIN verified

**The SDK never collects the user's PIN.** On `pinAuthenticate` it returns the
merchant details and hands control back to your app. Authenticate the user
however your wallet normally does, then call:

```ts
await PayByWallet.processPayment(orderId);
```

`orderId` must be **unique per transaction** and alphanumeric — for example
`TXN` followed by 12 digits. Reusing an id causes the payment to be rejected.

`event.merchant` provides `merchantName`, `amount` and `currency` so you can
show what is being paid on your own confirmation screen.

## ⚠️ Error codes

`event.code` on an `error` event, and `e.code` on a rejected promise:

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

## 🧩 Troubleshooting

| Symptom | Cause |
| --- | --- |
| `TurboModuleRegistry.getEnforcing(...): 'PayByWallet' could not be found` | Native rebuild needed after install (`pod install`, then rebuild) — a Metro reload does not register native modules |
| Blank white screen on iOS when built with Xcode 27+ | UIScene lifecycle not adopted — see iOS setup |
| Camera preview black, or crash when scanning | `NSCameraUsageDescription` missing, or camera permission denied |
| Release build works but payments silently fail | Custom ProGuard rules stripping the SDK — the package ships the required keep-rules, do not exclude them |
| `Manifest merger failed : uses-sdk:minSdkVersion 24` | Set `minSdkVersion = 28` in `android/build.gradle` |
| Gradle fails with a bare version number | Wrong JDK; build with JDK 17 |

## 🧪 Sample app

A runnable sample app that consumes this package is maintained separately as
`paybywallet_sample`. Demo PIN is `1234`.

## 🔄 Updating the native SDKs (maintainers)

| Platform | File | After replacing |
| --- | --- | --- |
| iOS | `ios/Frameworks/TerraPayWalletSDK.xcframework` | `rm -rf ios/Frameworks/TerraPayWalletSDK.xcframework/*/dSYMs` |
| Android | `android/libs/payByWallet-release.aar` | Re-check transitive deps in `android/build.gradle` and keep-rules in `android/consumer-rules.pro` |

After changing anything in `src/`, run `yarn build` and commit the regenerated
`lib/` folder. It is checked in so partners can install from GitHub with any
package manager without a build step.

## 🔐 License

Released under the MIT License. See [LICENSE](LICENSE).

## 📬 Contact

For support or inquiries, email: sdk-support@terrapay.com
