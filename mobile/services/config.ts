const FALLBACK_API_URL = 'http://localhost:3000';

function requirePublicUrl(name: string, value: string | undefined) {
  const isProduction = process.env.NODE_ENV === 'production';
  const resolved = value || FALLBACK_API_URL;
  const isPlaceholder = resolved.includes('yourreplaydomain.com');
  const isLocalhost = resolved.includes('localhost') || resolved.includes('127.0.0.1');

  if (isProduction && (!value || isPlaceholder || isLocalhost)) {
    throw new Error(`${name} must be configured for production builds`);
  }

  return resolved;
}

export const API_URL = requirePublicUrl('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL);
export const WS_URL = requirePublicUrl('EXPO_PUBLIC_WS_URL', process.env.EXPO_PUBLIC_WS_URL);
