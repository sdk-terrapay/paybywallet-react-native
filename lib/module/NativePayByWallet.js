"use strict";

import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec for the native bridge. Keep this file free of anything Codegen
 * cannot parse (unions, generics beyond the RN ones) -- the friendly, typed API
 * lives in `PayByWallet.ts`.
 */

/**
 * Flat payload for every SDK callback. `type` says which fields are set:
 *
 * - `onPinAuthenticate`: merchantName, subscriberAmount, subscriberCurrency
 * - `onPaymentSuccess` / `onPaymentFailure`: responseStatus, responseMessage,
 *   gatewayReferenceId, orderId
 * - `onError` / `onCancelled`: code, message
 * - `onClosed`: nothing
 */

export default TurboModuleRegistry.getEnforcing('PayByWallet');
//# sourceMappingURL=NativePayByWallet.js.map