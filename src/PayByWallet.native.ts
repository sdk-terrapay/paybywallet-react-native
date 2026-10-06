import NativePayByWallet, { type NativeEvent } from './NativePayByWallet';
import type { PayByWalletConfig, PayByWalletEvent } from './types';

/**
 * Drives the native TerraPay PayByWallet SDK (`TerraPayClient` on Android,
 * `TerraPayWalletClient` on iOS).
 *
 * Calls go down through `launch` / `processPayment`; the SDK's callbacks come
 * back up as `PayByWalletEvent`s delivered to `addListener` subscribers.
 */
export const PayByWallet = {
  /**
   * Validates `config` natively and presents the SDK's payment UI.
   *
   * Rejects (with `code` / `message`) if the SDK refuses the configuration.
   */
  launch(config: PayByWalletConfig): Promise<void> {
    return NativePayByWallet.launch({
      accessToken: config.accessToken,
      refreshToken: config.refreshToken,
      subscriberDialCode: config.subscriberDialCode,
      subscriberCountry: config.subscriberCountry,
      subscriberCountryName: config.subscriberCountryName,
      subscriberName: config.subscriberName,
      subscriberMSISDN: config.subscriberMsisdn,
      subscriberCurrency: config.subscriberCurrency,
      walletBalance: config.walletBalance,
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor,
      environment: config.environment ?? 'sandbox',
      referenceNumber: config.referenceNumber,
    });
  },

  /**
   * Completes the payment after your own PIN screen has authenticated the
   * user. `transactionId` must be a unique alphanumeric order id.
   */
  processPayment(transactionId: string): Promise<void> {
    return NativePayByWallet.processPayment(transactionId);
  },

  /**
   * Subscribes to SDK callbacks. Subscribe before calling `launch`, and call
   * `remove()` on the returned subscription when done.
   */
  addListener(listener: (event: PayByWalletEvent) => void): {
    remove(): void;
  } {
    return NativePayByWallet.onEvent((raw) => {
      const event = toEvent(raw);
      if (event) listener(event);
    });
  },
};

function toEvent(raw: NativeEvent): PayByWalletEvent | null {
  switch (raw.type) {
    case 'onPinAuthenticate':
      return {
        type: 'pinAuthenticate',
        merchant: {
          merchantName: raw.merchantName,
          amount: raw.subscriberAmount,
          currency: raw.subscriberCurrency,
        },
      };
    case 'onPaymentSuccess':
    case 'onPaymentFailure':
      return {
        type:
          raw.type === 'onPaymentSuccess' ? 'paymentSuccess' : 'paymentFailure',
        result: {
          responseStatus: raw.responseStatus,
          responseMessage: raw.responseMessage,
          gatewayReferenceId: raw.gatewayReferenceId,
          orderId: raw.orderId,
        },
      };
    case 'onError':
      return {
        type: 'error',
        code: raw.code ?? '',
        message: raw.message ?? 'Something went wrong.',
      };
    case 'onCancelled':
      return {
        type: 'cancelled',
        code: raw.code ?? '',
        message: raw.message ?? 'User cancelled.',
      };
    case 'onClosed':
      return { type: 'closed' };
    default:
      console.warn(`[PayByWallet] Unhandled native callback: ${raw.type}`);
      return null;
  }
}
