/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    /**
     * 遠端圖（R2／CDN 公開 URL）讓瀏覽器直連，不經 Vercel `/_next/image` 轉檔，避免 Image Optimization Transformations 配額。
     */
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.taiwannamer.com",
        pathname: "/**",
      },
    ],
  },
  // Next 14: 不打包 svg-captcha，改由 runtime 從 node_modules 載入，否則建置時 __dirname 會指向 .next/server/... 導致字型 ENOENT
  experimental: {
    serverComponentsExternalPackages: ["svg-captcha"],
  },
  // 避免 Windows 上 webpack cache rename 造成的 ENOENT
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
