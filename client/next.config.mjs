const production = process.env.NODE_ENV === "production";
const apiUrl = process.env.API_URL || "http://127.0.0.1:4000";
const parsedApiUrl = new URL(apiUrl);
if (!["http:", "https:"].includes(parsedApiUrl.protocol))
  throw new Error("API_URL must use HTTP or HTTPS.");
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${production ? "" : " ws: http:"}`,
  ...(production ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig = {
  poweredByHeader: false,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${parsedApiUrl.origin}/api/:path*`,
      },
    ];
  },
};
export default nextConfig;
