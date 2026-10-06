"use strict";

const unsupported = () => new Error("'@terrapay/react-native-paybywallet' is only supported on Android and iOS.");

/** Web / other-platform stub; the real implementation is `PayByWallet.native.ts`. */
export const PayByWallet = {
  launch(_config) {
    return Promise.reject(unsupported());
  },
  processPayment(_transactionId) {
    return Promise.reject(unsupported());
  },
  addListener(_listener) {
    return {
      remove() {}
    };
  }
};
//# sourceMappingURL=PayByWallet.js.map