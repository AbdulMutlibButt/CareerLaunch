const localApiOrigin = "http://127.0.0.1:4000";

function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    !host.includes(".") ||
    host.includes(":")
  )
    return true;
  const octets = host.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  )
    return false;
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

export function resolveApiOrigin({
  value = process.env.API_URL,
  production = process.env.NODE_ENV === "production",
} = {}) {
  const configured = value?.trim();
  if (!configured) {
    if (production)
      throw new Error(
        "API_URL is required in production and must be the public HTTPS backend origin.",
      );
    return localApiOrigin;
  }
  let parsed;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error("API_URL must be a valid absolute URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error("API_URL must use HTTP or HTTPS.");
  if (parsed.username || parsed.password)
    throw new Error("API_URL must not contain credentials.");
  if (parsed.pathname !== "/" || parsed.search || parsed.hash)
    throw new Error("API_URL must contain only an origin, without a path or query.");
  if (production && parsed.protocol !== "https:")
    throw new Error("API_URL must use HTTPS in production.");
  if (production && isPrivateHostname(parsed.hostname))
    throw new Error("API_URL must use a publicly reachable hostname in production.");
  return parsed.origin;
}
