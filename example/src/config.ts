import type { PayByWalletEnvironment } from '@terrapay/react-native-paybywallet';
import { credentials } from './credentials';

/**
 * Static configuration for the PayByWallet example app.
 *
 * Gateway credentials live in `credentials.ts` (git-ignored; copy
 * `credentials.example.ts`). In production the partner *backend* calls
 * `getToken` and the app never holds this pair at all -- anything shipped in
 * the binary is extractable.
 */
export const AppConfig = {
  tokenBaseUrl: 'https://uat-connect.terrapay.com:27211',
  tokenPath: '/eig/getToken',
  tokenUser: credentials.user,
  tokenPassword: credentials.password,

  /** Which backend the *SDK* talks to, alongside `tokenBaseUrl`. */
  environment: 'sandbox' as PayByWalletEnvironment,

  // ---- Demo subscriber ----------------------------------------------------
  subscriberDialCode: '+254',
  subscriberMsisdn: '476864812',
  subscriberName: 'Giri Babu',
  subscriberCountry: 'KE',
  subscriberCountryName: 'Kenya',
  subscriberCurrency: 'KES',
  walletBalance: 9999654.5,

  // ---- SDK branding -------------------------------------------------------
  primaryColor: '01377D',
  secondaryColor: 'FFFFFF',
} as const;

/** The `subscriberid` query value expected by `getToken`, e.g. `+254476864812`. */
export const subscriberId = `${AppConfig.subscriberDialCode}${AppConfig.subscriberMsisdn}`;
