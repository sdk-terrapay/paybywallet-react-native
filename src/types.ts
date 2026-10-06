/** Which TerraPay backend the SDK talks to. Honoured on both platforms. */
export type PayByWalletEnvironment = 'sandbox' | 'production';

/** Configuration handed to the native TerraPay PayByWallet SDK on launch. */
export type PayByWalletConfig = {
  accessToken: string;
  refreshToken: string;
  /** `+` followed by digits, e.g. `+254`. */
  subscriberDialCode: string;
  /** ISO 3166-1 alpha-2, e.g. `KE`. */
  subscriberCountry: string;
  subscriberCountryName: string;
  subscriberName: string;
  /** Digits only, without the dial code. */
  subscriberMsisdn: string;
  /** ISO 4217, e.g. `KES`. */
  subscriberCurrency: string;
  walletBalance: number;
  /** 6-digit hex, no leading '#', e.g. `52B44A`. */
  primaryColor: string;
  /** 6-digit hex, no leading '#', e.g. `FFFFFF`. */
  secondaryColor: string;
  /** Defaults to `sandbox`. */
  environment?: PayByWalletEnvironment;
  /** Android only: optional reference passed through to `TerraPayClient.init`. */
  referenceNumber?: string;
};

/** Merchant the user is about to pay, delivered with `pinAuthenticate`. */
export type MerchantDetails = {
  merchantName?: string;
  amount?: string;
  currency?: string;
};

/**
 * Outcome of a completed payment attempt, mirroring the native SDKs'
 * `TPPaymentStatus` (same fields on both platforms).
 */
export type PaymentResult = {
  responseStatus?: string;
  responseMessage?: string;
  gatewayReferenceId?: string;
  orderId?: string;
};

/** Events pushed up from the native SDK. Switch on `type`. */
export type PayByWalletEvent =
  /**
   * The SDK needs the host app to authenticate the user before charging them.
   * Show your own PIN screen, then call `processPayment` with a fresh order id.
   */
  | { type: 'pinAuthenticate'; merchant: MerchantDetails }
  | { type: 'paymentSuccess'; result: PaymentResult }
  | { type: 'paymentFailure'; result: PaymentResult }
  | { type: 'error'; code: string; message: string }
  | { type: 'cancelled'; code: string; message: string }
  /** The SDK UI was dismissed without reporting a result. */
  | { type: 'closed' };
