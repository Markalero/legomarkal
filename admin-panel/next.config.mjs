// Configuración de Next.js 14 para el panel de administración LegoMarkal
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    // Permite imágenes desde Supabase Storage
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "img.bricklink.com",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;
