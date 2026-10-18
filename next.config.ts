import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/projects", destination: "/ideas", permanent: true },
      { source: "/submit-project", destination: "/submit", permanent: true },
      { source: "/submit-project/:path*", destination: "/submit/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
