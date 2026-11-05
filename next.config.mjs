/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only used when developing against a local file database
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
