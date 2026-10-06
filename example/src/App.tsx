import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  PayByWallet,
  type MerchantDetails,
  type PayByWalletEvent,
} from '@terrapay/react-native-paybywallet';
import { AppConfig, subscriberId } from './config';
import { PinModal } from './PinModal';
import { colors } from './theme';
import { fetchToken, type TokenPair } from './tokenService';

type Status = { kind: 'info' | 'success' | 'error'; text: string } | null;

/** Unique alphanumeric order id per transaction, e.g. `TXN123456789012`. */
function generateOrderId() {
  let digits = '';
  for (let i = 0; i < 12; i++) digits += Math.floor(Math.random() * 10);
  return `TXN${digits}`;
}

export default function App() {
  const [token, setToken] = useState<TokenPair | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [pinMerchant, setPinMerchant] = useState<MerchantDetails | null>(null);
  const paymentPending = useRef(false);

  const loadToken = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      setToken(await fetchToken(subscriberId));
    } catch (e) {
      setToken(null);
      setStatus({ kind: 'error', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadToken();
  }, [loadToken]);

  // Subscribe before calling launch().
  useEffect(() => {
    const sub = PayByWallet.addListener((event: PayByWalletEvent) => {
      switch (event.type) {
        case 'pinAuthenticate':
          // Authenticate the user with your own PIN screen, then processPayment.
          setPinMerchant(event.merchant);
          break;
        case 'paymentSuccess':
          setStatus({ kind: 'success', text: describe(event.result) });
          break;
        case 'paymentFailure':
          setStatus({ kind: 'error', text: describe(event.result) });
          break;
        case 'error':
          setStatus({ kind: 'error', text: `${event.code}: ${event.message}` });
          break;
        case 'cancelled':
          setStatus({ kind: 'info', text: event.message });
          break;
        case 'closed':
          setStatus({ kind: 'info', text: 'Payment screen closed.' });
          break;
      }
    });
    return () => sub.remove();
  }, []);

  const launch = async () => {
    if (!token) return;
    setStatus(null);
    try {
      await PayByWallet.launch({
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        subscriberDialCode: AppConfig.subscriberDialCode,
        subscriberCountry: AppConfig.subscriberCountry,
        subscriberCountryName: AppConfig.subscriberCountryName,
        subscriberName: AppConfig.subscriberName,
        subscriberMsisdn: AppConfig.subscriberMsisdn,
        subscriberCurrency: AppConfig.subscriberCurrency,
        walletBalance: AppConfig.walletBalance,
        primaryColor: AppConfig.primaryColor,
        secondaryColor: AppConfig.secondaryColor,
        environment: AppConfig.environment,
      });
    } catch (e: any) {
      setStatus({ kind: 'error', text: `${e.code ?? 'ERROR'}: ${e.message}` });
    }
  };

  const processPayment = async () => {
    try {
      await PayByWallet.processPayment(generateOrderId());
    } catch (e: any) {
      setStatus({ kind: 'error', text: `${e.code ?? 'ERROR'}: ${e.message}` });
    }
  };

  // On iOS the SDK presents its processing/receipt screens on top of whatever
  // is showing. If the PIN modal is still closing, those screens get detached
  // with it and the receipt's Done button can no longer dismiss them, so wait
  // for the modal's onDismiss before calling processPayment.
  const onPinVerified = () => {
    setPinMerchant(null);
    if (Platform.OS === 'ios') paymentPending.current = true;
    else processPayment();
  };

  const onPinDismissed = () => {
    if (!paymentPending.current) return;
    paymentPending.current = false;
    processPayment();
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TP Wallet</Text>
        <Text style={styles.headerSub}>React Native sample</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.label}>Subscriber</Text>
          <Text style={styles.value}>{AppConfig.subscriberName}</Text>
          <Text style={styles.muted}>{subscriberId}</Text>
          <Text style={[styles.label, styles.spaced]}>Balance</Text>
          <Text style={styles.balance}>
            {AppConfig.subscriberCurrency}{' '}
            {AppConfig.walletBalance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>

        <View style={styles.tokenRow}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.muted}>
              {token
                ? `Token ready (expires in ${token.expiresInSeconds}s)`
                : 'No token'}
            </Text>
          )}
          <Pressable onPress={loadToken} disabled={loading}>
            <Text style={styles.link}>Refresh token</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.button, !token && styles.disabled]}
          disabled={!token}
          onPress={launch}
        >
          <Text style={styles.buttonText}>PayByWallet Services</Text>
        </Pressable>

        {status && (
          <View style={[styles.status, styles[status.kind]]}>
            <Text style={styles.statusText}>{status.text}</Text>
          </View>
        )}
      </ScrollView>

      <PinModal
        merchant={pinMerchant}
        onVerified={onPinVerified}
        onDismiss={onPinDismissed}
        onCancel={() => {
          setPinMerchant(null);
          setStatus({ kind: 'info', text: 'PIN entry cancelled.' });
        }}
      />
    </SafeAreaView>
  );
}

function describe(r: {
  responseMessage?: string;
  responseStatus?: string;
  orderId?: string;
  gatewayReferenceId?: string;
}) {
  return [
    r.responseMessage,
    r.responseStatus && `status: ${r.responseStatus}`,
    r.orderId && `order: ${r.orderId}`,
    r.gatewayReferenceId && `ref: ${r.gatewayReferenceId}`,
  ]
    .filter(Boolean)
    .join(' • ');
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6FA' },
  header: { backgroundColor: colors.primary, padding: 24, paddingTop: 32 },
  headerTitle: { color: colors.onPrimary, fontSize: 24, fontWeight: '700' },
  headerSub: { color: colors.onPrimary, opacity: 0.8, marginTop: 4 },
  body: { padding: 20, gap: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  label: { color: '#777', fontSize: 13, textTransform: 'uppercase' },
  spaced: { marginTop: 16 },
  value: { fontSize: 18, fontWeight: '600', marginTop: 4 },
  balance: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 4,
  },
  muted: { color: '#666' },
  tokenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: { color: colors.primary, fontWeight: '600' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  disabled: { opacity: 0.4 },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  status: { borderRadius: 12, padding: 14 },
  statusText: { color: '#1b1b1b' },
  info: { backgroundColor: '#E3EAF5' },
  success: { backgroundColor: '#DFF3E0' },
  error: { backgroundColor: '#FBE3E3' },
});
