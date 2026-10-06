import { AppConfig } from './config';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
};

/** Fetches the OAuth2 access/refresh token pair the SDK needs before launch. */
export async function fetchToken(subscriberId: string): Promise<TokenPair> {
  if (!AppConfig.tokenUser || !AppConfig.tokenPassword) {
    throw new Error(
      'Gateway credentials missing. Copy example/src/credentials.example.ts to credentials.ts.'
    );
  }

  // encodeURIComponent turns the leading '+' into %2B, which the gateway
  // requires -- a raw '+' would arrive as a space.
  const url =
    `${AppConfig.tokenBaseUrl}${AppConfig.tokenPath}` +
    `?subscriberid=${encodeURIComponent(subscriberId)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        user: AppConfig.tokenUser,
        password: AppConfig.tokenPassword,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error(`Could not reach the token service: ${String(e)}`);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status !== 200) {
    throw new Error(`Token request failed (HTTP ${response.status}).`);
  }

  const body = await response.json().catch(() => {
    throw new Error('Token service returned an unreadable response.');
  });

  const accessToken: string = body.access_token ?? '';
  if (!accessToken) {
    const reason = body.subStatus ?? body.status ?? 'missing access_token';
    throw new Error(`Token service rejected the request: ${reason}`);
  }

  // `expiry` arrives as a string ("300"), so coerce rather than trust the type.
  const expiry = Number.parseInt(String(body.expiry), 10);

  return {
    accessToken,
    refreshToken: body.refresh_token ?? '',
    expiresInSeconds: Number.isFinite(expiry) ? expiry : 300,
  };
}
