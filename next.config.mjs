/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  skipTrailingSlashRedirect: true,
  assetPrefix: process.env.NODE_ENV === 'production' ? 'https://showcase.jitai.co' : undefined,
  serverExternalPackages: ['pg'],
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
