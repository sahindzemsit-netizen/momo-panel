import type {NextConfig} from 'next';
import withSerwistInit from '@serwist/next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true, // Speeds up build and reduces memory usage
  },
  productionBrowserSourceMaps: false,
  allowedDevOrigins: [
    'ais-dev-ltdorbowaap35pryga23s7-765714300509.europe-west2.run.app',
    'ais-pre-ltdorbowaap35pryga23s7-765714300509.europe-west2.run.app',
    '*.run.app',
    'localhost:3000'
  ],
  // Allow access to remote image placeholder.
  images: {
    unoptimized: true, // Speeds up build and reduces memory/CPU usage for images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  transpilePackages: ['motion', 'lucide-react'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
  turbopack: {},
  experimental: {
    serverActions: {
      allowedOrigins: [
        'ais-dev-ltdorbowaap35pryga23s7-765714300509.europe-west2.run.app',
        'ais-pre-ltdorbowaap35pryga23s7-765714300509.europe-west2.run.app',
        '*.run.app',
        'localhost:3000'
      ],
    },
  },
  webpack: (config, { dev }) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  register: process.env.NODE_ENV !== 'development',
  disable: process.env.NODE_ENV === 'development',
});

export default withSerwist(nextConfig);
