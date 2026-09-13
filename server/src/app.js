import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { randomBytes } from "node:crypto";
const invalidPasswordHash = bcrypt.hashSync(randomBytes(32).toString("hex"), 12);
const text = (min = 0, max = 200) => z.string().trim().min(min).max(max);
const url = z.union([
  z.literal(""),
  z
    .url()
    .max(2000)
    .refine(
      (v) => ["https:", "http:"].includes(new URL(v).protocol),
      "Use an HTTP or HTTPS URL",
    ),
]);
const profile = z
  .object({
    bio: text(0, 2000).optional(),
    skills: z.array(text(1, 60)).max(30).optional(),
    education: text(0, 3000).optional(),
    experience: text(0, 4000).optional(),
    resumeUrl: url.optional(),
    location: text().optional(),
    companyName: text(0, 100).optional(),
    description: text(0, 5000).optional(),
    website: url.optional(),
  })
  .strict();
const job = z
  .object({
    title: text(3, 120),
    description: text(30, 10000),
    location: text(2, 120),
    jobType: z.enum(["Internship", "Full-time", "Part-time", "Contract"]),
    workplaceType: z.enum(["Remote", "On-site", "Hybrid"]),
    skills: z.array(text(1, 60)).min(1).max(25),
    salary: text(0, 100),
    applicationDeadline: z.iso
      .date()
      .refine(
        (v) => v >= new Date().toISOString().slice(0, 10),
        "Deadline must be today or later",
      ),
    status: z.enum(["Open", "Closed"]).default("Open"),
  })
  .strict();
function fail(code, message) {
  const e = new Error(message);
  e.status = code;
  throw e;
}
export function createApp(
  store,
  {
    secret = process.env.JWT_SECRET || randomBytes(48).toString("hex"),
    production = false,
    origin = process.env.APP_ORIGIN || "http://127.0.0.1:3000",
  } = {},
) {
  const app = express();
  if (production) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use("/api", (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const source = req.get("origin");
      if (
        (source && source !== origin) ||
        req.get("sec-fetch-site") === "cross-site"
      )
        return res.status(403).json({ message: "Request origin not allowed" });
    }
    next();
  });
  const publicUser = (u) => u && ({
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
  });
  const cookieName = production ? "__Host-session" : "session";
  const cookie = {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: production ? "/" : "/api",
    maxAge: 7 * 24 * 3600 * 1000,
  };
  const session = (res, u) => {
    res.cookie(
      cookieName,
      jwt.sign({ sub: u._id }, secret, {
        expiresIn: "7d",
        algorithm: "HS256",
        issuer: "careerlaunch-api",
        audience: "careerlaunch-web",
      }),
      cookie,
    );
    return res.json(publicUser(u));
  };
  const auth = async (req, res, next) => {
    try {
      const claims = jwt.verify(req.cookies[cookieName] || "", secret, {
        algorithms: ["HS256"],
        issuer: "careerlaunch-api",
        audience: "careerlaunch-web",
      });
      req.user = await store.one("users", { _id: claims.sub });
      if (!req.user)
        return res.status(401).json({ message: "Please sign in to continue" });
      next();
    } catch (e) {
      if (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError")
        return res.status(401).json({ message: "Please sign in to continue" });
      next(e);
    }
  };
  const role = (r) => (req, res, next) =>
    req.user.role === r
      ? next()
      : res
          .status(403)
          .json({ message: `This action requires an ${r} account` });
  const ownJob = async (req, id) => {
    const j = await store.one("jobs", { _id: id });
    if (!j || j.status === "Deleted") fail(404, "Job not found");
    if (j.employerId !== req.user._id)
      fail(403, "You can manage only your own jobs");
    return j;
  };
  app.get("/api/health", (req, res) =>
    res.json({ ok: true, mode: store.mode }),
  );
  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  app.post("/api/auth/register", loginLimit, async (req, res) => {
    const d = z
      .object({
        name: text(2, 80),
        email: z
          .email()
          .max(200)
          .transform((x) => x.toLowerCase()),
        password: z.string().min(10).max(72),
        role: z.enum(["applicant", "employer"]),
      })
      .strict()
      .parse(req.body);
    const u = await store.insert("users", {
      name: d.name,
      email: d.email,
      passwordHash: await bcrypt.hash(d.password, 12),
      role: d.role,
      createdAt: new Date().toISOString(),
    });
    session(res, u);
  });
  app.post("/api/auth/login", loginLimit, async (req, res) => {
    const d = z
      .object({
        email: z.email().transform((x) => x.toLowerCase()),
        password: z.string().max(72),
      })
      .strict()
      .parse(req.body);
    const u = await store.oneWithSecrets("users", { email: d.email });
    const passwordMatches = await bcrypt.compare(
      d.password,
      u?.passwordHash || invalidPasswordHash,
    );
    if (!u || !passwordMatches)
      fail(401, "Incorrect email or password");
    session(res, u);
  });
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie(cookieName, {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      path: production ? "/" : "/api",
    });
    res.json({ ok: true });
  });
  app.get("/api/auth/me", auth, (req, res) => res.json(publicUser(req.user)));
  app.get("/api/profile", auth, async (req, res) =>
    res.json((await store.one("profiles", { userId: req.user._id })) || {}),
  );
  app.patch("/api/profile", auth, async (req, res) => {
    const d = profile.parse(req.body);
    const p = await store.one("profiles", { userId: req.user._id });
    res.json(
      p
        ? await store.update("profiles", p._id, d)
        : await store.insert("profiles", { ...d, userId: req.user._id }),
    );
  });
  app.get("/api/jobs", async (req, res) => {
    const q = z
      .object({
        q: text(0, 100).optional(),
        location: text().optional(),
        jobType: text().optional(),
        workplaceType: text().optional(),
        skill: text().optional(),
        sort: z.enum(["newest", "oldest"]).default("newest"),
        page: z.coerce.number().int().min(1).max(10000).default(1),
      })
      .parse(req.query);
    let rows = (await store.all("jobs", { status: "Open" })).filter(
      (j) => j.applicationDeadline >= new Date().toISOString().slice(0, 10),
    );
    const contains = (a, b) => a.toLowerCase().includes(b.toLowerCase());
    if (q.q)
      rows = rows.filter((j) =>
        contains([j.title, j.company, ...j.skills].join(" "), q.q),
      );
    if (q.location) rows = rows.filter((j) => contains(j.location, q.location));
    if (q.jobType) rows = rows.filter((j) => j.jobType === q.jobType);
    if (q.workplaceType)
      rows = rows.filter((j) => j.workplaceType === q.workplaceType);
    if (q.skill)
      rows = rows.filter((j) => j.skills.some((s) => contains(s, q.skill)));
    rows.sort((a, b) =>
      q.sort === "oldest"
        ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt),
    );
    res.json({
      jobs: rows.slice((q.page - 1) * 9, q.page * 9),
      total: rows.length,
      page: q.page,
      pages: Math.max(1, Math.ceil(rows.length / 9)),
    });
  });
  app.get("/api/jobs/:id", async (req, res) => {
    const j = await store.one("jobs", { _id: req.params.id });
    if (!j || j.status === "Deleted") fail(404, "Job not found");
    const p = await store.one("profiles", { userId: j.employerId });
    res.json({
      ...j,
      companyProfile: p
        ? {
            companyName: p.companyName,
            description: p.description,
            website: p.website,
            location: p.location,
          }
        : null,
    });
  });
  app.post("/api/jobs", auth, role("employer"), async (req, res) => {
    const d = job.parse(req.body);
    const p = await store.one("profiles", { userId: req.user._id });
    if (!p?.companyName)
      fail(400, "Complete your company profile before posting a job");
    res
      .status(201)
      .json(
        await store.insert("jobs", {
          ...d,
          company: p.companyName,
          employerId: req.user._id,
          createdAt: new Date().toISOString(),
        }),
      );
  });
  app.patch("/api/jobs/:id", auth, role("employer"), async (req, res) => {
    await ownJob(req, req.params.id);
    const d = job.partial().parse(req.body);
    res.json(await store.update("jobs", req.params.id, d));
  });
  app.delete("/api/jobs/:id", auth, role("employer"), async (req, res) => {
    await ownJob(req, req.params.id);
    await store.update("jobs", req.params.id, { status: "Deleted" });
    await store.remove("saved", { jobId: req.params.id });
    res.json({ ok: true });
  });
  app.post("/api/jobs/:id/save", auth, role("applicant"), async (req, res) => {
    const j = await store.one("jobs", { _id: req.params.id });
    if (!j || j.status === "Deleted") fail(404, "Job not found");
    res
      .status(201)
      .json(
        await store.insert("saved", {
          jobId: j._id,
          userId: req.user._id,
          createdAt: new Date().toISOString(),
        }),
      );
  });
  app.delete(
    "/api/jobs/:id/save",
    auth,
    role("applicant"),
    async (req, res) => {
      await store.remove("saved", {
        jobId: req.params.id,
        userId: req.user._id,
      });
      res.json({ ok: true });
    },
  );
  app.get("/api/saved-jobs", auth, role("applicant"), async (req, res) => {
    const saves = await store.all("saved", { userId: req.user._id });
    res.json(
      (
        await Promise.all(saves.map((s) => store.one("jobs", { _id: s.jobId })))
      ).filter((j) => j && j.status !== "Deleted"),
    );
  });
  app.post("/api/jobs/:id/apply", auth, role("applicant"), async (req, res) => {
    const j = await store.one("jobs", { _id: req.params.id });
    if (
      !j ||
      j.status !== "Open" ||
      j.applicationDeadline < new Date().toISOString().slice(0, 10)
    )
      fail(400, "This job is no longer accepting applications");
    const d = z
      .object({
        coverLetter: text(30, 5000),
        resumeUrl: url.refine(Boolean, "Please add a résumé link"),
      })
      .strict()
      .parse(req.body);
    res
      .status(201)
      .json(
        await store.insert("applications", {
          ...d,
          jobId: j._id,
          applicantId: req.user._id,
          status: "Pending",
          appliedAt: new Date().toISOString(),
        }),
      );
  });
  app.get("/api/applications/me", auth, role("applicant"), async (req, res) => {
    const rows = await store.all("applications", { applicantId: req.user._id });
    res.json(
      await Promise.all(
        rows.map(async (a) => ({
          ...a,
          job: await store.one("jobs", { _id: a.jobId }),
        })),
      ),
    );
  });
  app.patch(
    "/api/applications/:id/withdraw",
    auth,
    role("applicant"),
    async (req, res) => {
      const a = await store.one("applications", {
        _id: req.params.id,
        applicantId: req.user._id,
      });
      if (!a) fail(404, "Application not found");
      if (a.status !== "Pending")
        fail(400, "Only pending applications can be withdrawn");
      res.json(
        await store.update("applications", a._id, { status: "Withdrawn" }),
      );
    },
  );
  app.get("/api/employer/jobs", auth, role("employer"), async (req, res) => {
    const rows = (await store.all("jobs", { employerId: req.user._id })).filter(
      (j) => j.status !== "Deleted",
    );
    res.json(
      await Promise.all(
        rows.map(async (j) => ({
          ...j,
          applicationCount: (await store.all("applications", { jobId: j._id }))
            .length,
        })),
      ),
    );
  });
  app.get(
    "/api/employer/jobs/:id/applications",
    auth,
    role("employer"),
    async (req, res) => {
      await ownJob(req, req.params.id);
      const rows = await store.all("applications", { jobId: req.params.id });
      res.json(
        await Promise.all(
          rows.map(async (a) => ({
            ...a,
            applicant: publicUser(
              await store.one("users", { _id: a.applicantId }),
            ),
            profile: await store.one("profiles", { userId: a.applicantId }),
          })),
        ),
      );
    },
  );
  app.patch(
    "/api/applications/:id/status",
    auth,
    role("employer"),
    async (req, res) => {
      const d = z
        .object({ status: z.enum(["Reviewing", "Accepted", "Rejected"]) })
        .strict()
        .parse(req.body);
      const a = await store.one("applications", { _id: req.params.id });
      if (!a) fail(404, "Application not found");
      await ownJob(req, a.jobId);
      const allowed = {
        Pending: ["Reviewing", "Rejected"],
        Reviewing: ["Accepted", "Rejected"],
      };
      if (!allowed[a.status]?.includes(d.status))
        fail(400, "This status transition is not allowed");
      res.json(await store.update("applications", a._id, d));
    },
  );
  app.use("/api", (req, res) =>
    res.status(404).json({ message: "Endpoint not found" }),
  );
  app.use((e, req, res, next) => {
    if (e instanceof z.ZodError)
      return res
        .status(400)
        .json({
          message: e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        });
    if (e.code === 11000)
      return res
        .status(409)
        .json({
          message: "This email, saved job or application already exists",
        });
    if (e.status)
      return res
        .status(e.status)
        .json({ message: e.status < 500 ? e.message : "Server error" });
    console.error(e);
    res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  });
  return app;
}
