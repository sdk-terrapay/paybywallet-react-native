import {
  TurboModuleRegistry,
  type CodegenTypes,
  type TurboModule,
} from 'react-native';

/**
 * Codegen spec for the native bridge. Keep this file free of anything Codegen
 * cannot parse (unions, generics beyond the RN ones) -- the friendly, typed API
 * lives in `PayByWallet.ts`.
 */

export type NativeConfig = {
  accessToken: string;
  refreshToken: string;
  subscriberDialCode: string;
  subscriberCountry: string;
  subscriberCountryName: string;
  subscriberName: string;
  subscriberMSISDN: string;
  subscriberCurrency: string;
  walletBalance: CodegenTypes.Double;
  primaryColor: string;
  secondaryColor: string;
  /** `sandbox` | `production` */
  environment: string;
};

/**
 * Flat payload for every SDK callback. `type` says which fields are set:
 *
 * - `onPinAuthenticate`: merchantName, subscriberAmount, subscriberCurrency
 * - `onPaymentSuccess` / `onPaymentFailure`: responseStatus, responseMessage,
 *   gatewayReferenceId, orderId
 * - `onError` / `onCancelled`: code, message
 * - `onClosed`: nothing
 */
export type NativeEvent = {
  type: string;
  merchantName?: string;
  subscriberAmount?: string;
  subscriberCurrency?: string;
  responseStatus?: string;
  responseMessage?: string;
  gatewayReferenceId?: string;
  orderId?: string;
  code?: string;
  message?: string;
};

export interface Spec extends TurboModule {
  launch(config: NativeConfig): Promise<void>;
  processPayment(transactionId: string): Promise<void>;

  readonly onEvent: CodegenTypes.EventEmitter<NativeEvent>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('PayByWallet');
