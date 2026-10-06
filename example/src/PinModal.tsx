import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import type { MerchantDetails } from '@terrapay/react-native-paybywallet';
import { colors } from './theme';

/**
 * Host-app PIN screen shown when the SDK raises `pinAuthenticate`.
 *
 * The SDK never collects the PIN itself. Replace `DEMO_PIN` with your real
 * verification call.
 */
const DEMO_PIN = '1234';

type Props = {
  merchant: MerchantDetails | null;
  onVerified: () => void;
  onCancel: () => void;
  /** iOS: fires once the modal has fully closed. */
  onDismiss?: () => void;
};

export function PinModal({ merchant, onVerified, onCancel, onDismiss }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = (verified: boolean) => {
    setPin('');
    setError(null);
    verified ? onVerified() : onCancel();
  };

  const verify = () => {
    if (pin === DEMO_PIN) close(true);
    else setError(`Incorrect PIN. Try ${DEMO_PIN} for this demo.`);
  };

  return (
    <Modal
      visible={merchant != null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => close(false)}
      onDismiss={onDismiss}
    >
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Tapping anywhere outside the PIN field dismisses the keyboard. */}
          <Pressable
            style={styles.content}
            onPress={Keyboard.dismiss}
            accessible={false}
          >
            <Text style={styles.title}>Confirm payment</Text>
            <Text style={styles.merchant}>
              {merchant?.merchantName ?? 'Merchant'}
            </Text>
            <Text style={styles.amount}>
              {merchant?.currency} {merchant?.amount}
            </Text>

            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="Enter 4-digit PIN"
              autoFocus
            />
            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={[styles.button, pin.length !== 4 && styles.disabled]}
              disabled={pin.length !== 4}
              onPress={verify}
            >
              <Text style={styles.buttonText}>Pay</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => close(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700' },
  merchant: { fontSize: 16, color: '#444' },
  amount: { fontSize: 28, fontWeight: '700', color: colors.primary },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    padding: 14,
    fontSize: 20,
    letterSpacing: 8,
    textAlign: 'center',
  },
  error: { color: '#C62828' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancel: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: colors.primary, fontSize: 15 },
});
