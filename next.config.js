/** @type {import('next').NextConfig} */
const nextConfig = {
  // 避免 Windows 上 webpack cache rename 造成的 ENOENT
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
