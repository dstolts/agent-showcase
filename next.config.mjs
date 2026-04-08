/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  skipTrailingSlashRedirect: true,
  serverExternalPackages: ['pg'],
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
