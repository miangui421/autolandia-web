import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone output: genera un build optimizado para Docker
  // con solo las dependencias necesarias en .next/standalone
  output: 'standalone',
};

export default nextConfig;
