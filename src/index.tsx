/**
 * React Native bindings for the TerraPay PayByWallet SDKs.
 *
 * One Turbo Module fronts both native SDKs:
 *
 * ```text
 *              React Native (this package)
 *                         |
 *              +----------+----------+
 *              |                     |
 *        iOS bridge            Android bridge
 *              |                     |
 *   TerraPayWalletClient        TerraPayClient
 *   (TerraPayWalletSDK)         (payByWallet .aar)
 * ```
 *
 * Your app fetches the OAuth2 token pair (`GET /eig/getToken`) and passes it
 * in; this package deliberately does not talk to the gateway itself.
 */
export { PayByWallet } from './PayByWallet';
export type * from './types';
