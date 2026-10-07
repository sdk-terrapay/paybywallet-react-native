package com.terrapay.paybywallet.reactnative

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.activity.ComponentActivity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.terrapay.payByWallet.PaymentsHomeActivity
import com.terrapay.payByWallet.network.MerchantDetailsModel
import com.terrapay.payByWallet.network.TPPaymentStatus
import com.terrapay.payByWallet.network.TerraPayClient
import com.terrapay.payByWallet.network.TerraPayConfig
import com.terrapay.payByWallet.network.TerraPayEnvironment
import com.terrapay.payByWallet.network.TerraPayResult

/**
 * Android half of the PayByWallet bridge.
 *
 * JS calls `launch` / `processPayment` down; the SDK's [TerraPayResult]
 * callbacks are forwarded back up through the `onEvent` emitter.
 */
class PayByWalletModule(reactContext: ReactApplicationContext) :
  NativePayByWalletSpec(reactContext) {

  private val main = Handler(Looper.getMainLooper())
  private val application = reactContext.applicationContext as Application

  /**
   * True while the SDK's screen is showing and has not yet reported back.
   * Some SDK exits (e.g. system back on the QR scanner) finish the activity
   * without any [TerraPayResult] callback; [sdkActivityWatcher] turns those
   * into `onClosed` so JS is never left waiting.
   */
  private var awaitingResult = false

  private val sdkActivityWatcher = object : Application.ActivityLifecycleCallbacks {
    override fun onActivityDestroyed(destroyed: Activity) {
      if (destroyed is PaymentsHomeActivity && destroyed.isFinishing && awaitingResult) {
        send("onClosed", emptyMap())
      }
    }

    override fun onActivityCreated(created: Activity, savedInstanceState: Bundle?) {}
    override fun onActivityStarted(started: Activity) {}
    override fun onActivityResumed(resumed: Activity) {}
    override fun onActivityPaused(paused: Activity) {}
    override fun onActivityStopped(stopped: Activity) {}
    override fun onActivitySaveInstanceState(saved: Activity, outState: Bundle) {}
  }

  init {
    application.registerActivityLifecycleCallbacks(sdkActivityWatcher)
  }

  override fun invalidate() {
    application.unregisterActivityLifecycleCallbacks(sdkActivityWatcher)
    super.invalidate()
  }

  override fun getName() = NAME

  // ---- JS -> native -------------------------------------------------------

  /**
   * The SDK's UI is Compose-based and rejects any context that is not a
   * [ComponentActivity]. React Native's `ReactActivity` already is one, so this
   * only trips for unusual hosts; checking here turns an opaque SDK error into
   * an actionable one.
   */
  private fun requireComponentActivity(promise: Promise): ComponentActivity? {
    val current = reactApplicationContext.currentActivity
    if (current is ComponentActivity) return current
    promise.reject(
      "INVALID_CONTEXT",
      if (current == null) "No foreground activity to launch from."
      else "PayByWallet needs an androidx ComponentActivity host " +
        "(e.g. ReactActivity); got ${current.javaClass.name}.",
    )
    return null
  }

  override fun launch(config: ReadableMap, promise: Promise) {
    main.post { launchOnMain(config, promise) }
  }

  private fun launchOnMain(config: ReadableMap, promise: Promise) {
    val activity = requireComponentActivity(promise) ?: return

    if (!config.hasKey("walletBalance") || config.isNull("walletBalance")) {
      promise.reject("INVALID_WALLET_BALANCE", "walletBalance must be a number.")
      return
    }
    val balance = config.getDouble("walletBalance")

    val environment = when (val env = config.string("environment")) {
      "production" -> TerraPayEnvironment.PRODUCTION
      "sandbox", null -> TerraPayEnvironment.SANDBOX
      else -> {
        promise.reject("INVALID_ENVIRONMENT", "Unknown environment '$env'.")
        return
      }
    }

    val sdkConfig = TerraPayConfig(
      primaryColor = config.string("primaryColor").orEmpty(),
      secondaryColor = config.string("secondaryColor").orEmpty(),
      subscriberDialCode = config.string("subscriberDialCode").orEmpty(),
      subscriberMSISDN = config.string("subscriberMSISDN").orEmpty(),
      walletBalance = balance,
      subscriberCountryName = config.string("subscriberCountryName").orEmpty(),
      subscriberCountry = config.string("subscriberCountry").orEmpty(),
      subscriberCurrency = config.string("subscriberCurrency").orEmpty(),
      subscriberName = config.string("subscriberName").orEmpty(),
      accessToken = config.string("accessToken").orEmpty(),
      refreshToken = config.string("refreshToken").orEmpty(),
      environment = environment,
    )

    // Surface configuration problems as a rejected promise rather than as an
    // asynchronous onError, so JS can await the launch.
    TerraPayClient.validateInputFields(activity, sdkConfig)?.let { error ->
      promise.reject(error.code, error.message)
      return
    }

    TerraPayClient.init(
      context = activity,
      config = sdkConfig,
      terraPayResult = callbacks,
    )
    awaitingResult = true
    promise.resolve(null)
  }

  override fun processPayment(transactionId: String, promise: Promise) {
    if (transactionId.isBlank()) {
      promise.reject("INVALID_TRANSACTION_ID", "transactionId is required.")
      return
    }
    main.post {
      val activity = requireComponentActivity(promise) ?: return@post
      TerraPayClient.processPayment(context = activity, transactionId = transactionId)
      awaitingResult = true
      promise.resolve(null)
    }
  }

  // ---- Native -> JS -------------------------------------------------------

  private fun send(type: String, fields: Map<String, String?>) {
    // Any callback ends the wait; the SDK invokes them on the main thread
    // before finishing its activity, so this is set before the destroy check.
    awaitingResult = false
    val payload = Arguments.createMap().apply {
      putString("type", type)
      // Omit nulls so optional fields arrive as `undefined` in JS.
      fields.forEach { (key, value) -> if (value != null) putString(key, value) }
    }
    main.post { emitOnEvent(payload) }
  }

  private val callbacks = object : TerraPayResult {

    override fun onPinAuthenticate(merchantDetails: MerchantDetailsModel) {
      send(
        "onPinAuthenticate",
        mapOf(
          "merchantName" to merchantDetails.merchantName,
          "subscriberAmount" to merchantDetails.subscriberAmount,
          "subscriberCurrency" to merchantDetails.subscriberCurrency,
        ),
      )
    }

    override fun onPaymentSuccess(paymentStatus: TPPaymentStatus) =
      send("onPaymentSuccess", paymentStatus.toMap())

    override fun onPaymentFailure(paymentStatus: TPPaymentStatus) =
      send("onPaymentFailure", paymentStatus.toMap())

    override fun onError(errorCode: String, message: String) =
      send("onError", mapOf("code" to errorCode, "message" to message))

    override fun onCancelled(errorCode: String, message: String) =
      send("onCancelled", mapOf("code" to errorCode, "message" to message))
  }

  private fun TPPaymentStatus.toMap(): Map<String, String?> = mapOf(
    "responseStatus" to responseStatus,
    "responseMessage" to responseMessage,
    "gatewayReferenceId" to gatewayReferenceId,
    "orderId" to orderId,
  )

  private fun ReadableMap.string(key: String): String? =
    if (hasKey(key) && !isNull(key)) getString(key) else null

  companion object {
    const val NAME = NativePayByWalletSpec.NAME
  }
}
