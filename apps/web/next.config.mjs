/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone solo en Docker/CI (Linux); en Windows los symlinks fallan.
  output: process.env.NEXT_STANDALONE === '1' ? 'standalone' : undefined,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  },
};

export default nextConfig;
