export function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    const { origin } = window.location;
    return `${origin}/backend-api`;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
}
