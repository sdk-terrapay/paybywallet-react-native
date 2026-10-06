import type { PayByWalletConfig, PayByWalletEvent } from './types.js';
/**
 * Drives the native TerraPay PayByWallet SDK (`TerraPayClient` on Android,
 * `TerraPayWalletClient` on iOS).
 *
 * Calls go down through `launch` / `processPayment`; the SDK's callbacks come
 * back up as `PayByWalletEvent`s delivered to `addListener` subscribers.
 */
export declare const PayByWallet: {
    /**
     * Validates `config` natively and presents the SDK's payment UI.
     *
     * Rejects (with `code` / `message`) if the SDK refuses the configuration.
     */
    launch(config: PayByWalletConfig): Promise<void>;
    /**
     * Completes the payment after your own PIN screen has authenticated the
     * user. `transactionId` must be a unique alphanumeric order id.
     */
    processPayment(transactionId: string): Promise<void>;
    /**
     * Subscribes to SDK callbacks. Subscribe before calling `launch`, and call
     * `remove()` on the returned subscription when done.
     */
    addListener(listener: (event: PayByWalletEvent) => void): {
        remove(): void;
    };
};
//# sourceMappingURL=PayByWallet.native.d.ts.map