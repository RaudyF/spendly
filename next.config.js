/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  allowedDevOrigins: [
    'ais-dev-fbvps6jkq6pwvflq4isms6-436691551663.us-west2.run.app',
  ],
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', '*.run.app', '*.google.com'],
    },
  },
};

module.exports = nextConfig;
