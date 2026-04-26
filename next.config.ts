import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone output: genera un build optimizado para Docker
  // con solo las dependencias necesarias en .next/standalone
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/bot',
        destination:
          '/?utm_source=whatsapp&utm_medium=organic&utm_campaign=bot_redirect',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
