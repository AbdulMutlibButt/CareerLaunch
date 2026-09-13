import { z } from "zod";

const blankToUndefined = (value) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(
  blankToUndefined,
  z.string().trim().min(1).optional(),
);

const origin = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .default("http://127.0.0.1:3000")
    .transform((value, context) => {
      try {
        const parsed = new URL(value);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
        return parsed.origin;
      } catch {
        context.addIssue({
          code: "custom",
          message: "APP_ORIGIN must be an HTTP or HTTPS origin",
        });
        return z.NEVER;
      }
    }),
);

const mongoUri = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .optional()
    .refine((value) => {
      if (!value) return true;
      try {
        return ["mongodb:", "mongodb+srv:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    }, "MONGODB_URI must be a valid MongoDB connection string"),
);

const environment = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.preprocess(
      blankToUndefined,
      z.coerce.number().int().min(1).max(65535).default(4000),
    ),
    HOST: z.preprocess(blankToUndefined, z.string().trim().min(1).default("127.0.0.1")),
    APP_ORIGIN: origin,
    MONGODB_URI: mongoUri,
    JWT_SECRET: z.preprocess(
      blankToUndefined,
      z.string().min(32, "JWT_SECRET must contain at least 32 characters").optional(),
    ),
    DEMO_PASSWORD: z.preprocess(
      blankToUndefined,
      z.string().min(10).max(72).optional(),
    ),
  })
  .passthrough();

export function loadConfig(values = process.env) {
  const parsed = environment.parse(values);
  const production = parsed.NODE_ENV === "production";
  if (production && !parsed.MONGODB_URI)
    throw new Error("Production requires MONGODB_URI.");
  if (production && !parsed.JWT_SECRET)
    throw new Error("Production requires JWT_SECRET (32+ characters).");
  if (production && !parsed.APP_ORIGIN.startsWith("https://"))
    throw new Error("Production requires an HTTPS APP_ORIGIN.");
  return Object.freeze({
    environment: parsed.NODE_ENV,
    production,
    port: parsed.PORT,
    host: parsed.HOST,
    origin: parsed.APP_ORIGIN,
    mongoUri: parsed.MONGODB_URI || "",
    jwtSecret: parsed.JWT_SECRET,
    demoPassword: parsed.DEMO_PASSWORD,
  });
}
