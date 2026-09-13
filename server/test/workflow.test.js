import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createStore } from "../src/store.js";
import { createApp } from "../src/app.js";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { loadConfig } from "../src/config.js";
const testPassword = randomBytes(24).toString("base64url");
test("complete hiring workflow enforces roles, ownership, duplicates and status rules", async () => {
  const store = await createStore({ file: null });
  const app = createApp(store, {
    secret: "test-secret-that-is-only-used-for-tests",
  });
  const employer = request.agent(app),
    other = request.agent(app),
    applicant = request.agent(app);
  async function register(agent, email, role) {
    return agent
      .post("/api/auth/register")
      .send({
        name: "Test Person",
        email,
        password: testPassword,
        role,
      })
      .expect(200);
  }
  const er = await register(employer, "employer@example.com", "employer");
  assert.ok(er.headers["set-cookie"][0].includes("HttpOnly"));
  assert.equal(er.headers["cache-control"], "no-store");
  assert.equal(er.body.passwordHash, undefined);
  await register(other, "other@example.com", "employer");
  await register(applicant, "applicant@example.com", "applicant");
  await request(app).get("/api/profile").expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({
      email: "missing@example.com",
      password: testPassword,
      unexpected: true,
    })
    .expect(400);
  await applicant
    .patch("/api/profile")
    .send({ skills: ["React"], resumeUrl: "javascript:alert(1)" })
    .expect(400);
  await employer
    .patch("/api/profile")
    .send({
      companyName: "Test Company",
      description: "A test employer",
      location: "Lahore",
    })
    .expect(200);
  const body = {
    title: "React Developer",
    description:
      "Work with a small team to build useful applications and learn good engineering.",
    location: "Lahore",
    jobType: "Internship",
    workplaceType: "Remote",
    skills: ["React"],
    salary: "PKR 40,000",
    applicationDeadline: "2099-12-31",
  };
  await applicant.post("/api/jobs").send(body).expect(403);
  await employer
    .post("/api/jobs")
    .send({ ...body, employerId: "forged" })
    .expect(400);
  const j = (await employer.post("/api/jobs").send(body).expect(201)).body;
  await other.patch(`/api/jobs/${j._id}`).send({ title: "Stolen" }).expect(403);
  await other.delete(`/api/jobs/${j._id}`).expect(403);
  await applicant.post(`/api/jobs/${j._id}/save`).expect(201);
  await applicant.post(`/api/jobs/${j._id}/save`).expect(409);
  assert.equal((await applicant.get("/api/saved-jobs")).body.length, 1);
  await applicant.delete(`/api/jobs/${j._id}/save`).expect(200);
  const application = {
    coverLetter:
      "I enjoy React and would love to work on thoughtful web applications.",
    resumeUrl: "https://example.com/resume.pdf",
  };
  const a = (
    await applicant
      .post(`/api/jobs/${j._id}/apply`)
      .send(application)
      .expect(201)
  ).body;
  const duplicate = await Promise.all([
    applicant.post(`/api/jobs/${j._id}/apply`).send(application),
    applicant.post(`/api/jobs/${j._id}/apply`).send(application),
  ]);
  assert.deepEqual(
    duplicate.map((x) => x.status),
    [409, 409],
  );
  await other.get(`/api/employer/jobs/${j._id}/applications`).expect(403);
  await other
    .patch(`/api/applications/${a._id}/status`)
    .send({ status: "Reviewing" })
    .expect(403);
  await employer
    .patch(`/api/applications/${a._id}/status`)
    .send({ status: "Accepted" })
    .expect(400);
  await employer
    .patch(`/api/applications/${a._id}/status`)
    .send({ status: "Reviewing" })
    .expect(200);
  await applicant.patch(`/api/applications/${a._id}/withdraw`).expect(400);
  await employer
    .patch(`/api/applications/${a._id}/status`)
    .send({ status: "Accepted" })
    .expect(200);
  assert.equal(
    (await applicant.get("/api/applications/me")).body[0].status,
    "Accepted",
  );
  assert.equal(
    (await request(app).get("/api/jobs?q=React&workplaceType=Remote")).body
      .total,
    1,
  );
  await request(app).get("/api/jobs?page=-1").expect(400);
  await employer
    .patch(`/api/jobs/${j._id}`)
    .send({ status: "Closed" })
    .expect(200);
  await applicant
    .post(`/api/jobs/${j._id}/apply`)
    .send(application)
    .expect(400);
  await employer
    .patch(`/api/jobs/${j._id}`)
    .send({ status: "Open" })
    .expect(200);
  await employer.delete(`/api/jobs/${j._id}`).expect(200);
  await request(app).get(`/api/jobs/${j._id}`).expect(404);
  assert.equal((await applicant.get("/api/applications/me")).body.length, 1);
  await applicant
    .patch("/api/profile")
    .set("Origin", "https://evil.example")
    .send({ bio: "forged" })
    .expect(403);
  await applicant.post("/api/auth/logout").expect(200);
  await applicant.get("/api/auth/me").expect(401);
  await store.close();
});
test("local demo data survives reopening the store", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "careerlaunch-test-"));
  try {
    const file = path.join(dir, "demo.json");
    const s = await createStore({ file });
    await s.insert("users", {
      email: "persist@example.com",
      name: "Persistent User",
      passwordHash: "not-a-real-password-hash",
    });
    assert.equal(
      (await s.one("users", { email: "persist@example.com" })).passwordHash,
      undefined,
    );
    assert.equal(
      (
        await s.oneWithSecrets("users", { email: "persist@example.com" })
      ).passwordHash,
      "not-a-real-password-hash",
    );
    await s.close();
    const reopened = await createStore({ file });
    assert.equal(
      (await reopened.one("users", { email: "persist@example.com" })).name,
      "Persistent User",
    );
    await reopened.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("production sessions use a host-only secure cookie", async () => {
  const store = await createStore({ file: null });
  const app = createApp(store, {
    production: true,
    origin: "https://careerlaunch.example",
    secret: "a-production-test-secret-with-more-than-32-characters",
  });
  const response = await request(app)
    .post("/api/auth/register")
    .set("Origin", "https://careerlaunch.example")
    .send({
      name: "Secure User",
      email: "secure@example.com",
      password: testPassword,
      role: "applicant",
    })
    .expect(200);
  const sessionCookie = response.headers["set-cookie"][0];
  assert.match(sessionCookie, /^__Host-session=/);
  assert.match(sessionCookie, /HttpOnly/);
  assert.match(sessionCookie, /Secure/);
  assert.match(sessionCookie, /Path=\//);
  assert.match(sessionCookie, /SameSite=Lax/);
  await store.close();
});

test("configuration validates security-critical production settings", () => {
  const development = loadConfig({
    NODE_ENV: "development",
    PORT: "",
    JWT_SECRET: "",
  });
  assert.equal(development.port, 4000);
  assert.equal(development.jwtSecret, undefined);
  assert.throws(
    () => loadConfig({ NODE_ENV: "production" }),
    /Production requires MONGODB_URI/,
  );
  assert.throws(
    () =>
      loadConfig({
        NODE_ENV: "production",
        MONGODB_URI: "mongodb://127.0.0.1/careerlaunch",
        JWT_SECRET: "short",
        APP_ORIGIN: "https://careerlaunch.example",
      }),
    /JWT_SECRET must contain at least 32 characters/,
  );
  assert.throws(
    () =>
      loadConfig({
        NODE_ENV: "production",
        MONGODB_URI: "mongodb://127.0.0.1/careerlaunch",
        JWT_SECRET: "a-production-secret-with-more-than-32-characters",
        APP_ORIGIN: "http://careerlaunch.example",
      }),
    /HTTPS APP_ORIGIN/,
  );
  assert.throws(
    () => loadConfig({ NODE_ENV: "development", PORT: "70000" }),
    /Too big|less than or equal to 65535/i,
  );
});
