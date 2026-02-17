/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.output.chunkLoadTimeout = 300000;
    }
    return config;
  },
};

export default nextConfig;
