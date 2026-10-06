import type { PayByWalletConfig, PayByWalletEvent } from './types.js';
/** Web / other-platform stub; the real implementation is `PayByWallet.native.ts`. */
export declare const PayByWallet: {
    launch(_config: PayByWalletConfig): Promise<void>;
    processPayment(_transactionId: string): Promise<void>;
    addListener(_listener: (event: PayByWalletEvent) => void): {
        remove(): void;
    };
};
//# sourceMappingURL=PayByWallet.d.ts.map