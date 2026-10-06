import Foundation
import TerraPayWalletSDK
import UIKit

/// iOS half of the PayByWallet bridge.
///
/// JS calls `launch` / `processPayment` down (via `RNPayByWallet.mm`); the
/// SDK's completion handler callbacks are forwarded back up through `emit`.
@objc(PayByWalletBridge)
public final class PayByWalletBridge: NSObject {

  public typealias Emit = ([String: Any]) -> Void
  public typealias Resolve = () -> Void
  public typealias Reject = (String, String) -> Void

  private let emit: Emit

  // MARK: - Silent-dismissal watch
  //
  // Some SDK exits (e.g. the back arrow on the QR scanner) dismiss its screens
  // without calling the completion handler. While a result is pending we watch
  // the presenting controller and report `onClosed` once the SDK's screen is
  // gone and no callback followed, so JS is never left waiting.

  private var awaitingResult = false
  private var sawSdkScreen = false
  private weak var sdkPresenter: UIViewController?
  private var dismissalWatch: Timer?

  @objc public init(emit: @escaping Emit) {
    self.emit = emit
    super.init()
  }

  // MARK: - Host view controller
  //
  // Resolved per call rather than captured once: under UIApplicationSceneManifest
  // the window may not exist yet when the module is created.

  private var hostController: UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let window =
      scenes.first(where: { $0.activationState == .foregroundActive })?.keyWindow
      ?? scenes.first?.keyWindow
    var top = window?.rootViewController
    // Skip screens that are on their way out (e.g. the host PIN modal JS has
    // just closed); presenting from them would orphan the SDK's next screen.
    while let presented = top?.presentedViewController, !presented.isBeingDismissed {
      top = presented
    }
    return top
  }

  // MARK: - JS -> native

  @objc public func launch(
    _ args: [String: Any],
    resolve: @escaping Resolve,
    reject: @escaping Reject
  ) {
    DispatchQueue.main.async { [self] in
      guard let controller = hostController else {
        reject("INVALID_CONTEXT", "No visible view controller to present from.")
        return
      }

      // The iOS SDK takes the balance as a string; JS sends a number.
      let walletBalance: String?
      switch args["walletBalance"] {
      case let value as NSNumber: walletBalance = value.stringValue
      case let value as String: walletBalance = value
      default: walletBalance = nil
      }

      let environment: TPEnvironment
      switch args["environment"] as? String {
      case "production": environment = .production
      case "sandbox", nil: environment = .sandbox
      case let other?:
        reject("INVALID_ENVIRONMENT", "Unknown environment '\(other)'.")
        return
      }

      let config = TerraPayWalletSDKConfig(
        controller: controller,
        accessToken: args["accessToken"] as? String ?? "",
        refreshToken: args["refreshToken"] as? String ?? "",
        subscriberDialCode: args["subscriberDialCode"] as? String ?? "",
        subscriberCountry: args["subscriberCountry"] as? String ?? "",
        subscriberCountryName: args["subscriberCountryName"] as? String ?? "",
        subscriberName: args["subscriberName"] as? String ?? "",
        subscriberMSISDN: args["subscriberMSISDN"] as? String ?? "",
        subscriberCurrency: args["subscriberCurrency"] as? String ?? "",
        walletBalance: walletBalance,
        primaryColor: args["primaryColor"] as? String ?? "",
        secondaryColor: args["secondaryColor"] as? String ?? "",
        environment: environment
      )

      watchForSilentDismissal(from: controller)
      TerraPayWalletClient.shared.launch(with: config) { [weak self] type, error, merchant, status in
        self?.forward(type: type, error: error, merchant: merchant, status: status)
      }
      resolve()
    }
  }

  @objc public func processPayment(
    _ transactionId: String,
    resolve: @escaping Resolve,
    reject: @escaping Reject
  ) {
    guard !transactionId.trimmingCharacters(in: .whitespaces).isEmpty else {
      reject("INVALID_TRANSACTION_ID", "transactionId is required.")
      return
    }
    DispatchQueue.main.async { [self] in
      let controller = hostController
      watchForSilentDismissal(from: controller)
      TerraPayWalletClient.shared.processPayment(
        controller: controller,
        transactionId: transactionId
      )
      resolve()
    }
  }

  private func watchForSilentDismissal(from presenter: UIViewController?) {
    stopWatching()
    awaitingResult = true
    sawSdkScreen = false
    sdkPresenter = presenter
    // The SDK presents asynchronously, so poll rather than check once.
    dismissalWatch = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
      self?.checkForSilentDismissal()
    }
  }

  private func checkForSilentDismissal() {
    guard awaitingResult, let presenter = sdkPresenter else {
      stopWatching()
      return
    }
    if presenter.presentedViewController != nil {
      sawSdkScreen = true
      return
    }
    guard sawSdkScreen else { return }

    // The SDK's own exit callbacks fire from the dismissal's completion block,
    // so give them a moment before deciding none is coming.
    stopWatching()
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
      guard let self, self.awaitingResult else { return }
      self.send("onClosed", [:])
    }
  }

  private func stopWatching() {
    dismissalWatch?.invalidate()
    dismissalWatch = nil
  }

  // MARK: - Native -> JS

  private func forward(
    type: TPLaunchType,
    error: TPErrorInfo?,
    merchant: TPMerchant?,
    status: TPPaymentStatus?
  ) {
    switch type {
    case .onPINAuthenticate:
      send("onPinAuthenticate", [
        "merchantName": merchant?.merchantName as Any,
        "subscriberAmount": merchant?.subscriberAmount as Any,
        "subscriberCurrency": merchant?.subscriberCurrency as Any,
      ])
    case .onPaymentSuccess:
      send("onPaymentSuccess", Self.paymentStatusMap(status, error: error))
    case .onPaymentFailure:
      send("onPaymentFailure", Self.paymentStatusMap(status, error: error))
    case .onError:
      send("onError", [
        "code": error?.code ?? "",
        "message": error?.message ?? "Something went wrong.",
      ])
    case .cancelled:
      send("onCancelled", [
        "code": error?.code ?? "",
        "message": error?.message ?? "User cancelled.",
      ])
    case .closed:
      send("onClosed", [:])
    @unknown default:
      send("onError", ["code": "", "message": "Unrecognised SDK result."])
    }
  }

  /// Same keys as the Android bridge's `TPPaymentStatus.toMap()`. Falls back to
  /// the error info when the SDK reports a failure without a status.
  private static func paymentStatusMap(
    _ status: TPPaymentStatus?,
    error: TPErrorInfo?
  ) -> [String: Any] {
    let responseStatus: String? = status?.responseStatus ?? error?.code
    let responseMessage: String? = status?.responseMessage ?? error?.message
    return [
      "responseStatus": responseStatus as Any,
      "responseMessage": responseMessage as Any,
      "gatewayReferenceId": status?.gatewayReferenceId as Any,
      "orderId": status?.orderId as Any,
    ]
  }

  private func send(_ type: String, _ fields: [String: Any]) {
    // Any callback ends the wait for this launch / processPayment.
    awaitingResult = false
    stopWatching()
    // Drop nils/NSNull so optional fields arrive as `undefined` in JS.
    var payload = fields.compactMapValues { value -> Any? in
      if value is NSNull { return nil }
      if case Optional<Any>.none = value { return nil }
      return value
    }
    payload["type"] = type
    DispatchQueue.main.async { [emit] in
      emit(payload)
    }
  }
}
