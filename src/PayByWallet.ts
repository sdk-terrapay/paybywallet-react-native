import type { PayByWalletConfig, PayByWalletEvent } from './types';

const unsupported = () =>
  new Error(
    "'@terrapay/react-native-paybywallet' is only supported on Android and iOS."
  );

/** Web / other-platform stub; the real implementation is `PayByWallet.native.ts`. */
export const PayByWallet = {
  launch(_config: PayByWalletConfig): Promise<void> {
    return Promise.reject(unsupported());
  },
  processPayment(_transactionId: string): Promise<void> {
    return Promise.reject(unsupported());
  },
  addListener(_listener: (event: PayByWalletEvent) => void): {
    remove(): void;
  } {
    return { remove() {} };
  },
};
