import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
mongoose.set("sanitizeFilter", true);
const defaultMongoCache = (globalThis[Symbol.for("careerlaunch.mongo")] ??= {
  connection: null,
  promise: null,
  uri: null,
});

export async function connectMongo(
  uri,
  {
    cache = defaultMongoCache,
    connector = (connectionUri) => mongoose.connect(connectionUri),
  } = {},
) {
  if (cache.uri === uri && cache.connection?.connection?.readyState === 1)
    return cache.connection;
  if (cache.uri !== uri) {
    cache.connection = null;
    cache.promise = null;
    cache.uri = uri;
  }
  if (!cache.promise)
    cache.promise = Promise.resolve().then(() => connector(uri));
  const pending = cache.promise;
  try {
    const connection = await pending;
    if (cache.promise === pending && cache.uri === uri) {
      cache.connection = connection;
      cache.promise = null;
    }
    return connection;
  } catch (error) {
    if (cache.promise === pending) {
      cache.connection = null;
      cache.promise = null;
      cache.uri = null;
    }
    throw error;
  }
}
const definitions = {
  users: {
    name: String,
    email: { type: String, unique: true },
    passwordHash: { type: String, select: false },
    role: String,
    createdAt: String,
  },
  profiles: {
    userId: { type: String, unique: true },
    bio: String,
    skills: [String],
    education: String,
    experience: String,
    resumeUrl: String,
    location: String,
    companyName: String,
    description: String,
    website: String,
  },
  jobs: {
    employerId: String,
    title: String,
    description: String,
    company: String,
    location: String,
    jobType: String,
    workplaceType: String,
    skills: [String],
    salary: String,
    applicationDeadline: String,
    status: String,
    createdAt: String,
  },
  applications: {
    jobId: String,
    applicantId: String,
    coverLetter: String,
    resumeUrl: String,
    status: String,
    appliedAt: String,
  },
  saved: { jobId: String, userId: String, createdAt: String },
};
export async function createStore({
  uri = "",
  file = path.resolve("data/demo.json"),
  disconnectOnClose = true,
} = {}) {
  if (uri) {
    await connectMongo(uri);
    const models = {};
    for (const [name, fields] of Object.entries(definitions)) {
      const schema = new mongoose.Schema(
        { _id: { type: String, default: randomUUID }, ...fields },
        { versionKey: false },
      );
      if (name === "applications")
        schema.index({ jobId: 1, applicantId: 1 }, { unique: true });
      if (name === "saved")
        schema.index({ jobId: 1, userId: 1 }, { unique: true });
      models[name] = mongoose.models[name] || mongoose.model(name, schema);
      await models[name].init();
    }
    const safe = (name, value) => {
      if (!value) return value;
      const document = value.toObject ? value.toObject() : value;
      if (name === "users") delete document.passwordHash;
      return document;
    };
    return {
      mode: "mongodb",
      all: (n, q = {}) => models[n].find(q).lean(),
      one: (n, q) => models[n].findOne(q).lean(),
      oneWithSecrets: (n, q) => {
        if (n !== "users") throw new Error("Secret reads are limited to users");
        return models[n].findOne(q).select("+passwordHash").lean();
      },
      insert: (n, d) => models[n].create(d).then((x) => safe(n, x)),
      update: (n, id, d) =>
        models[n]
          .findByIdAndUpdate(
            id,
            { $set: d },
            { new: true, runValidators: true },
          )
          .lean()
          .then((x) => safe(n, x)),
      remove: (n, q) => models[n].deleteMany(q),
      close: () =>
        disconnectOnClose ? mongoose.disconnect() : Promise.resolve(),
    };
  }
  let data = Object.fromEntries(Object.keys(definitions).map((n) => [n, []]));
  if (file) {
    await mkdir(path.dirname(file), { recursive: true });
    try {
      data = JSON.parse(await readFile(file, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  let queue = Promise.resolve();
  const persist = () => {
    const snapshot = JSON.stringify(data, null, 2);
    queue = queue.then(async () => {
      if (file) {
        await writeFile(file + ".tmp", snapshot);
        await rename(file + ".tmp", file);
      }
    });
    return queue;
  };
  const match = (x, q) => Object.entries(q).every(([k, v]) => x[k] === v);
  const copy = (n, x, includeSecrets = false) => {
    if (!x) return null;
    const value = structuredClone(x);
    if (n === "users" && !includeSecrets) delete value.passwordHash;
    return value;
  };
  return {
    mode: "local-demo",
    async all(n, q = {}) {
      return data[n].filter((x) => match(x, q)).map((x) => copy(n, x));
    },
    async one(n, q) {
      return copy(n, data[n].find((x) => match(x, q)));
    },
    async oneWithSecrets(n, q) {
      if (n !== "users") throw new Error("Secret reads are limited to users");
      return copy(n, data[n].find((x) => match(x, q)), true);
    },
    async insert(n, d) {
      const unique =
        n === "users"
          ? ["email"]
          : n === "profiles"
            ? ["userId"]
            : n === "applications"
              ? ["jobId", "applicantId"]
              : n === "saved"
                ? ["jobId", "userId"]
                : [];
      if (
        unique.length &&
        data[n].some((x) => unique.every((k) => x[k] === d[k]))
      ) {
        const e = new Error("Already exists");
        e.code = 11000;
        throw e;
      }
      const row = { ...d, _id: randomUUID() };
      data[n].push(row);
      await persist();
      return copy(n, row);
    },
    async update(n, id, d) {
      const row = data[n].find((x) => x._id === id);
      if (!row) return null;
      Object.assign(row, d);
      await persist();
      return copy(n, row);
    },
    async remove(n, q) {
      data[n] = data[n].filter((x) => !match(x, q));
      await persist();
    },
    async close() {
      await queue;
    },
  };
}
