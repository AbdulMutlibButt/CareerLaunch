"use client";
import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import {
  Search,
  ArrowUpRight,
  BriefcaseBusiness,
  MapPin,
  Bookmark,
  LayoutDashboard,
  UserRound,
  LogOut,
  Plus,
  ArrowLeft,
  Check,
  Building2,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
const api = axios.create({ baseURL: "/api", withCredentials: true });
const message = (e) =>
  e.response?.data?.message || "Unable to connect. Please try again.";
const date = (v) =>
  new Date(v).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const blankJob = {
  title: "",
  description: "",
  location: "",
  jobType: "Internship",
  workplaceType: "Remote",
  skills: "",
  salary: "",
  applicationDeadline: "",
  status: "Open",
};
function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  options,
  wide = false,
  minLength,
  maxLength,
}) {
  return (
    <label className={wide ? "full" : ""}>
      {label}
      {options ? (
        <select
          name={name}
          value={value || ""}
          onChange={onChange}
          required={required}
        >
          {options.map((x) => (
            <option key={x} value={x}>
              {x || "Any"}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          name={name}
          value={value || ""}
          onChange={onChange}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
        />
      ) : (
        <input
          name={name}
          type={type}
          value={value || ""}
          onChange={onChange}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
        />
      )}
    </label>
  );
}
export default function CareerLaunch() {
  const path = usePathname(),
    router = useRouter();
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [mode, setMode] = useState(""),
    [loaded, setLoaded] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [revision, setRevision] = useState(0),
    [saved, setSaved] = useState([]),
    [query, setQuery] = useState({}),
    [form, setForm] = useState({}),
    [statusFilter, setStatusFilter] = useState("All"),
    [confirm, setConfirm] = useState(null);
  const dialog = useRef(null);
  const data = loaded?.path === path ? loaded.value : null;
  const setData = (value) => setLoaded({ path, value });
  const notify = (t) => setToast(t);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    Promise.all([
      api
        .get("/auth/me")
        .then((r) => setUser(r.data))
        .catch(() => {}),
      api
        .get("/health")
        .then((r) => setMode(r.data.mode))
        .catch(() => {}),
    ]).finally(() => setReady(true));
  }, []);
  const employer = user?.role === "employer",
    dashboard = `/dashboard/${user?.role || "applicant"}`;
  const isBrowse = path === "/" || path === "/jobs",
    isAuth = path === "/login" || path === "/register",
    isDetail = /^\/jobs\/[^/]+$/.test(path),
    isProfile = path.endsWith("/profile") || path.endsWith("/company"),
    isSaved = path.endsWith("/saved"),
    isEdit = path.endsWith("/edit") || path.endsWith("/new"),
    isEmployerApps = /^\/dashboard\/employer\/jobs\/[^/]+\/applications$/.test(
      path,
    ),
    isApps = path === "/dashboard/applicant/applications",
    isEmployerJobs = path === "/dashboard/employer/jobs",
    isDashboard =
      path === "/dashboard/applicant" || path === "/dashboard/employer";
  useEffect(() => {
    const sync = () =>
      setQuery(Object.fromEntries(new URLSearchParams(window.location.search)));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [path]);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setError("");
    setData(null);
    setForm({});
    setStatusFilter("All");
    if (path.startsWith("/dashboard") && !user) {
      router.replace("/login");
      return;
    }
    if (
      path.startsWith("/dashboard") &&
      user &&
      !path.startsWith(`/dashboard/${user.role}`)
    ) {
      router.replace(dashboard);
      return;
    }
    const load = async () => {
      let r;
      if (isBrowse) r = await api.get("/jobs", { params: query });
      else if (isDetail) {
        r = await api.get(path);
        if (user?.role === "applicant") {
          const p = await api.get("/profile");
          if (active)
            setForm({ resumeUrl: p.data.resumeUrl || "", coverLetter: "" });
        }
      } else if (isProfile) {
        r = await api.get("/profile");
        if (active)
          setForm({ ...r.data, skills: (r.data.skills || []).join(", ") });
      } else if (isSaved) r = await api.get("/saved-jobs");
      else if (isApps || (isDashboard && !employer))
        r = await api.get("/applications/me");
      else if (isEmployerApps)
        r = await api.get(`/employer/jobs/${path.split("/")[4]}/applications`);
      else if (isEdit) {
        if (path.endsWith("/new")) {
          r = { data: {} };
          if (active) setForm(blankJob);
        } else {
          r = await api.get(`/jobs/${path.split("/")[4]}`);
          if (active)
            setForm(
              Object.fromEntries(
                Object.keys(blankJob).map((k) => [
                  k,
                  k === "skills" ? r.data.skills.join(", ") : r.data[k],
                ]),
              ),
            );
        }
      } else if (isEmployerJobs || (isDashboard && employer))
        r = await api.get("/employer/jobs");
      else r = { data: {} };
      if (active) setData(r.data);
    };
    load().catch((e) => {
      if (active) setError(message(e));
    });
    if (user?.role === "applicant")
      api
        .get("/saved-jobs")
        .then((r) => {
          if (active) setSaved(r.data.map((j) => j._id));
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [path, ready, user, query, revision]);
  useEffect(() => {
    if (confirm) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirm]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: "search_careerlaunch_jobs",
          description: "Search public CareerLaunch jobs and show the results.",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string", maxLength: 100 } },
            required: ["query"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          async execute(input) {
            if (
              !input ||
              typeof input.query !== "string" ||
              input.query.length > 100
            )
              throw new Error("Invalid query");
            const params = { q: input.query };
            const response = await api.get("/jobs", { params });
            router.push(`/jobs?q=${encodeURIComponent(input.query)}`);
            setQuery(params);
            return response.data;
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, [router]);
  const change = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const action = async (fn, success) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      if (success) notify(success);
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const refresh = () => setRevision((v) => v + 1);
  const save = (j) => {
    if (!user) {
      router.push("/login");
      return;
    }
    action(
      async () => {
        if (saved.includes(j._id)) {
          await api.delete(`/jobs/${j._id}/save`);
          setSaved((s) => s.filter((id) => id !== j._id));
          if (isSaved) refresh();
        } else {
          await api.post(`/jobs/${j._id}/save`);
          setSaved((s) => [...s, j._id]);
        }
      },
      saved.includes(j._id) ? "Job removed from saved" : "Job saved",
    );
  };
  const filter = (key, value) => {
    const next = { ...query, [key]: value, page: key === "page" ? value : 1 };
    Object.keys(next).forEach((k) => {
      if (!next[k]) delete next[k];
    });
    window.history.replaceState(
      null,
      "",
      `${path}?${new URLSearchParams(next)}`,
    );
    setQuery(next);
  };
  const card = (j) => (
    <article className="job-card" key={j._id}>
      <div className="row between">
        <div className="company-mark">{j.company?.[0] || "C"}</div>
        {!employer && (
          <button
            className="icon-button"
            aria-label={
              saved.includes(j._id) ? `Unsave ${j.title}` : `Save ${j.title}`
            }
            onClick={() => save(j)}
            disabled={busy}
          >
            <Bookmark
              size={20}
              fill={saved.includes(j._id) ? "currentColor" : "none"}
            />
          </button>
        )}
        {employer && j.status && <span className="tag">{j.status}</span>}
      </div>
      <p className="muted spacer">{j.company}</p>
      <h3>
        <Link href={`/jobs/${j._id}`}>{j.title}</Link>
      </h3>
      <p className="muted">
        <MapPin size={14} />
        {j.location}
        <span>·</span>
        {j.workplaceType}
      </p>
      <div className="row spacer">
        <span className="tag green">{j.jobType}</span>
        {j.skills.slice(0, 3).map((s) => (
          <span className="tag" key={s}>
            {s}
          </span>
        ))}
      </div>
      <div className="card-footer">
        <span>{j.salary || "Salary not listed"}</span>
        <Link
          className="text-link"
          href={`/jobs/${j._id}`}
          aria-label={`View ${j.title}`}
        >
          View role
          <ArrowUpRight size={16} />
        </Link>
      </div>
      {(isEmployerJobs || (isDashboard && employer)) && (
        <div className="row spacer">
          <Link
            className="text-link"
            href={`/dashboard/employer/jobs/${j._id}/applications`}
          >
            {j.applicationCount} applications
          </Link>
          <Link
            className="text-link"
            href={`/dashboard/employer/jobs/${j._id}/edit`}
          >
            Edit
          </Link>
          <button
            className="icon-button"
            disabled={busy}
            onClick={() =>
              action(async () => {
                await api.patch(`/jobs/${j._id}`, {
                  status: j.status === "Open" ? "Closed" : "Open",
                });
                refresh();
              }, "Listing updated")
            }
          >
            {j.status === "Open" ? "Close" : "Reopen"}
          </button>
          <button
            className="icon-button"
            onClick={() =>
              setConfirm({
                title: "Delete this job?",
                body: "The listing will be removed. Existing application history will be retained.",
                run: async () => {
                  await api.delete(`/jobs/${j._id}`);
                  refresh();
                },
              })
            }
          >
            Delete
          </button>
        </div>
      )}
    </article>
  );
  const empty = (text) => (
    <div className="panel empty">
      <BriefcaseBusiness size={32} style={{ margin: "0 auto 14px" }} />
      <h3>{text}</h3>
      <Link href="/jobs" className="text-link">
        Explore opportunities
        <ArrowUpRight size={16} />
      </Link>
    </div>
  );
  const applications = () =>
    data?.length ? (
      <div className="stack">
        {data.map((a) => (
          <article className="panel" key={a._id}>
            <div className="row between">
              <div>
                <h3>{a.job?.title || "Removed listing"}</h3>
                <p className="muted">
                  {a.job?.company} · Applied {date(a.appliedAt)}
                </p>
              </div>
              <span
                className={`tag ${a.status === "Accepted" ? "green" : "blue"}`}
              >
                {a.status}
              </span>
            </div>
            <div className="row spacer">
              {a.job && a.job.status !== "Deleted" && (
                <Link className="text-link" href={`/jobs/${a.jobId}`}>
                  View role
                  <ArrowUpRight size={16} />
                </Link>
              )}
              {a.status === "Pending" && (
                <button
                  className="icon-button"
                  onClick={() =>
                    setConfirm({
                      title: "Withdraw your application?",
                      body: "You cannot apply again to this listing after withdrawing.",
                      run: async () => {
                        await api.patch(`/applications/${a._id}/withdraw`);
                        refresh();
                      },
                    })
                  }
                >
                  Withdraw application
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    ) : (
      empty("Your next chapter is waiting")
    );
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-icon">↗</span>CareerLaunch
          <span className="brand-dot">.</span>
        </Link>
        <p className="nav-label">YOUR NEXT CHAPTER</p>
        {[
          [Search, "Discover jobs", "/jobs"],
          ...(user
            ? [
                [LayoutDashboard, "Overview", dashboard],
                ...(employer
                  ? [
                      [
                        BriefcaseBusiness,
                        "My job listings",
                        dashboard + "/jobs",
                      ],
                      [Building2, "Company profile", dashboard + "/company"],
                    ]
                  : [
                      [Bookmark, "Saved jobs", dashboard + "/saved"],
                      [
                        FileText,
                        "My applications",
                        dashboard + "/applications",
                      ],
                      [UserRound, "My profile", dashboard + "/profile"],
                    ]),
              ]
            : []),
        ].map(([Icon, label, href]) => (
          <Link
            className={`nav-item ${(href === "/jobs" ? isBrowse : path === href) ? "active" : ""}`}
            href={href}
            key={href}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
        <div className="sidebar-bottom">
          <p>
            Good things start with
            <br />
            <strong>a little ambition.</strong>
          </p>
          {mode === "local-demo" && (
            <p className="demo spacer">Local demo · Fictional listings</p>
          )}
          {user && (
            <button
              className="icon-button"
              onClick={() =>
                action(async () => {
                  await api.post("/auth/logout");
                  setUser(null);
                  setSaved([]);
                  router.push("/jobs");
                }, "Signed out")
              }
            >
              <LogOut size={16} />
              Sign out
            </button>
          )}
        </div>
      </aside>
      <main>
        <header>
          <span>
            {isBrowse
              ? "Opportunities / Discover"
              : isAuth
                ? "Your CareerLaunch account"
                : employer
                  ? "Workspace / Employer"
                  : "Workspace / Applicant"}
          </span>
          {user ? (
            <div className="user-chip">
              <div className="avatar">{user.name[0]}</div>
              <span>{user.name}</span>
              <span className="tag blue">{user.role}</span>
            </div>
          ) : (
            <div className="row">
              <Link className="text-link" href="/login">
                Sign in
              </Link>
              <Link className="button" href="/register">
                Join now
                <ArrowUpRight size={16} />
              </Link>
            </div>
          )}
        </header>
        <div className="content">
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {isBrowse && (
            <>
              <div className="eyebrow">
                A LITTLE AMBITION. A WORLD OF POSSIBILITY.
              </div>
              <h1>
                Find your next <em>big beginning.</em>
              </h1>
              <p className="intro">
                Internships and early-career roles. Your first step, or your
                next one.
              </p>
              <form
                className="searchbar"
                onSubmit={(e) => {
                  e.preventDefault();
                  filter("q", new FormData(e.currentTarget).get("q"));
                }}
              >
                <Search size={22} />
                <input
                  key={query.q || ""}
                  name="q"
                  defaultValue={query.q || ""}
                  maxLength={100}
                  aria-label="Search jobs"
                  placeholder="Job title, skill or company"
                />
                <button>
                  Find opportunities
                  <ArrowUpRight size={17} />
                </button>
              </form>
              <div className="browse">
                <aside className="filters">
                  <h3 className="row">
                    <SlidersHorizontal size={18} />
                    Filter your search
                  </h3>
                  {[
                    ["Location", "location", null],
                    [
                      "Job type",
                      "jobType",
                      ["", "Internship", "Full-time", "Part-time", "Contract"],
                    ],
                    [
                      "Workplace",
                      "workplaceType",
                      ["", "Remote", "Hybrid", "On-site"],
                    ],
                    ["Skill", "skill", null],
                  ].map(([label, name, options]) => (
                    <Field
                      key={name}
                      label={label}
                      name={name}
                      value={query[name] || ""}
                      options={options}
                      onChange={(e) => filter(name, e.target.value)}
                    />
                  ))}
                  <button
                    className="text-link icon-button"
                    onClick={() => {
                      window.history.replaceState(null, "", path);
                      setQuery({});
                    }}
                  >
                    Clear filters
                  </button>
                </aside>
                <section className="results">
                  <div className="row between" style={{ marginBottom: 18 }}>
                    <h2 style={{ margin: 0 }}>
                      All opportunities{" "}
                      <span className="tag blue">{data?.total ?? "…"}</span>
                    </h2>
                    <select
                      aria-label="Sort jobs"
                      style={{ width: 150 }}
                      value={query.sort || "newest"}
                      onChange={(e) => filter("sort", e.target.value)}
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                    </select>
                  </div>
                  {data?.jobs?.length ? (
                    <>
                      <div className="job-grid">{data.jobs.map(card)}</div>
                      <div className="pagination">
                        <button
                          className="secondary"
                          disabled={data.page <= 1}
                          onClick={() => filter("page", data.page - 1)}
                        >
                          Previous
                        </button>
                        <span>
                          {data.page} / {data.pages}
                        </span>
                        <button
                          className="secondary"
                          disabled={data.page >= data.pages}
                          onClick={() => filter("page", data.page + 1)}
                        >
                          Next
                        </button>
                      </div>
                    </>
                  ) : data ? (
                    empty("No matching opportunities")
                  ) : (
                    !error && (
                      <div className="job-grid">
                        {[1, 2, 3, 4].map((n) => (
                          <div className="loading" key={n} />
                        ))}
                      </div>
                    )
                  )}
                </section>
              </div>
            </>
          )}
          {isAuth && (
            <section className="auth">
              <div className="eyebrow">MAKE YOUR NEXT MOVE</div>
              <h1>
                {path === "/login" ? "Welcome back." : "A fresh start awaits."}
              </h1>
              <p className="intro">
                {path === "/login"
                  ? "Sign in to pick up where you left off."
                  : "Create an account and take the next step."}
              </p>
              <form
                className="panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  action(async () => {
                    const r = await api.post(
                      path === "/login" ? "/auth/login" : "/auth/register",
                      path === "/login"
                        ? { email: form.email, password: form.password }
                        : {
                            name: form.name,
                            email: form.email,
                            password: form.password,
                            role: form.role || "applicant",
                          },
                    );
                    setUser(r.data);
                    router.push(`/dashboard/${r.data.role}`);
                  }, "You’re signed in");
                }}
              >
                {path === "/register" && (
                  <>
                    <Field
                      label="Full name"
                      name="name"
                      value={form.name}
                      onChange={change}
                      required
                      minLength={2}
                    />
                    <Field
                      label="I am joining as"
                      name="role"
                      value={form.role || "applicant"}
                      onChange={change}
                      options={["applicant", "employer"]}
                    />
                  </>
                )}
                <Field
                  label="Email address"
                  name="email"
                  value={form.email}
                  type="email"
                  onChange={change}
                  required
                />
                <Field
                  label="Password"
                  name="password"
                  value={form.password}
                  type="password"
                  onChange={change}
                  required
                  minLength={path === "/register" ? 10 : undefined}
                  maxLength={72}
                />
                {path === "/register" && (
                  <span className="muted">Use at least 10 characters.</span>
                )}
                <button disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : path === "/login"
                      ? "Sign in"
                      : "Create account"}
                  <ArrowUpRight size={17} />
                </button>
                <Link
                  className="text-link"
                  href={path === "/login" ? "/register" : "/login"}
                >
                  {path === "/login"
                    ? "New here? Create an account"
                    : "Already have an account? Sign in"}
                </Link>
              </form>
            </section>
          )}
          {isDetail && data && (
            <section className="detail">
              <Link className="text-link" href="/jobs">
                <ArrowLeft size={16} />
                Back to opportunities
              </Link>
              <div className="panel spacer">
                <div className="row between">
                  <div className="company-mark">{data.company[0]}</div>
                  <span className="tag green">{data.jobType}</span>
                </div>
                <p className="muted spacer">{data.company}</p>
                <h1>{data.title}</h1>
                <p className="muted">
                  <MapPin size={16} />
                  {data.location} · {data.workplaceType}
                </p>
                <div className="row spacer">
                  {data.skills.map((s) => (
                    <span className="tag" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
                <div className="card-footer">
                  <strong>{data.salary || "Salary not listed"}</strong>
                  <span>Apply by {date(data.applicationDeadline)}</span>
                </div>
                <h2>About the opportunity</h2>
                <div className="prose">{data.description}</div>
                {data.companyProfile?.description && (
                  <>
                    <h2>About {data.company}</h2>
                    <p className="prose">{data.companyProfile.description}</p>
                  </>
                )}
              </div>
              {!employer && (
                <div className="panel spacer">
                  <h2>Your next step</h2>
                  {data.status !== "Open" ||
                  data.applicationDeadline <
                    new Date().toISOString().slice(0, 10) ? (
                    <p>This role is no longer accepting applications.</p>
                  ) : !user ? (
                    <Link href="/login" className="button">
                      Sign in to apply
                      <ArrowUpRight size={16} />
                    </Link>
                  ) : (
                    <form
                      className="stack"
                      onSubmit={(e) => {
                        e.preventDefault();
                        action(async () => {
                          await api.post(`/jobs/${data._id}/apply`, form);
                          router.push("/dashboard/applicant/applications");
                        }, "Application submitted");
                      }}
                    >
                      <Field
                        label="Résumé link (a shareable PDF or document URL)"
                        name="resumeUrl"
                        type="url"
                        value={form.resumeUrl}
                        onChange={change}
                        required
                      />
                      <Field
                        label="Cover letter — tell the team why you’re interested"
                        name="coverLetter"
                        type="textarea"
                        value={form.coverLetter}
                        onChange={change}
                        required
                        minLength={30}
                        maxLength={5000}
                      />
                      <div className="row">
                        <button disabled={busy}>
                          Submit application
                          <ArrowUpRight size={16} />
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={() => save(data)}
                        >
                          <Bookmark size={16} />
                          {saved.includes(data._id)
                            ? "Saved"
                            : "Save for later"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </section>
          )}
          {isProfile && user && data && (
            <>
              <div className="eyebrow">
                {employer ? "YOUR COMPANY" : "YOUR STORY"}
              </div>
              <h1>
                {employer
                  ? "Introduce your company."
                  : "Put your best self forward."}
              </h1>
              <p className="intro">
                {employer
                  ? "Help applicants understand who they could be working with."
                  : "Keep your details ready for your next application."}
              </p>
              <form
                className="panel fields"
                onSubmit={(e) => {
                  e.preventDefault();
                  action(async () => {
                    const keys = employer
                      ? ["companyName", "description", "website", "location"]
                      : [
                          "bio",
                          "skills",
                          "education",
                          "experience",
                          "resumeUrl",
                          "location",
                        ];
                    const payload = Object.fromEntries(
                      keys.map((k) => [
                        k,
                        k === "skills"
                          ? (form.skills || "")
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                          : form[k] || "",
                      ]),
                    );
                    await api.patch("/profile", payload);
                  }, "Profile saved");
                }}
              >
                {(employer
                  ? [
                      ["Company name", "companyName", "text", true],
                      ["Location", "location"],
                      ["Website", "website", "url"],
                      ["About your company", "description", "textarea"],
                    ]
                  : [
                      ["Location", "location"],
                      ["Skills (comma separated)", "skills"],
                      ["Short bio", "bio", "textarea"],
                      ["Education", "education", "textarea"],
                      ["Experience", "experience", "textarea"],
                      ["Résumé link", "resumeUrl", "url"],
                    ]
                ).map(([label, name, type, required]) => (
                  <Field
                    key={name}
                    label={label}
                    name={name}
                    value={form[name]}
                    type={type}
                    required={required}
                    onChange={change}
                    wide={type === "textarea"}
                  />
                ))}
                <div className="full">
                  <button disabled={busy}>
                    <Check size={17} />
                    Save profile
                  </button>
                </div>
              </form>
            </>
          )}
          {(isSaved || isEmployerJobs || isDashboard) && user && (
            <>
              <div className="row between">
                <div>
                  <div className="eyebrow">
                    {isSaved
                      ? "KEEP THE POSSIBILITIES CLOSE"
                      : isEmployerJobs
                        ? "BUILD YOUR NEXT GREAT TEAM"
                        : "YOUR WORKSPACE"}
                  </div>
                  <h1>
                    {isSaved
                      ? "Your saved opportunities."
                      : isEmployerJobs
                        ? "Find your next teammate."
                        : `Hello, ${user.name.split(" ")[0]}.`}
                  </h1>
                  <p className="intro">
                    {isSaved
                      ? "The roles that caught your eye, all in one place."
                      : employer
                        ? "Manage your listings and meet your next hire."
                        : "Every application is a step forward. Keep yours in view."}
                  </p>
                </div>
                {employer && (
                  <Link href="/dashboard/employer/jobs/new" className="button">
                    <Plus size={18} />
                    Post a job
                  </Link>
                )}
              </div>
              {isDashboard && data && (
                <div className="stats">
                  {(employer
                    ? [
                        [
                          data.filter((j) => j.status === "Open").length,
                          "Open listings",
                        ],
                        [
                          data.reduce((n, j) => n + j.applicationCount, 0),
                          "Applications",
                        ],
                        [
                          data.filter((j) => j.status === "Closed").length,
                          "Closed listings",
                        ],
                      ]
                    : [
                        [data.length, "Applications"],
                        [
                          data.filter((a) => a.status === "Reviewing").length,
                          "In review",
                        ],
                        [saved.length, "Saved jobs"],
                      ]
                  ).map(([value, label]) => (
                    <div className="panel stat" key={label}>
                      <strong>{value}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              )}
              {(isSaved || isEmployerJobs || (isDashboard && employer)) &&
                data &&
                (data.length ? (
                  <div className="job-grid">{data.map(card)}</div>
                ) : (
                  empty(isSaved ? "No saved jobs yet" : "No job listings yet")
                ))}
              {isDashboard && !employer && data && (
                <>
                  <h2>Recent applications</h2>
                  {applications()}
                </>
              )}
            </>
          )}
          {isApps && user && data && (
            <>
              <h1>Your applications.</h1>
              <p className="intro">Follow every step of your journey.</p>
              {applications()}
            </>
          )}
          {isEdit && employer && data && (
            <>
              <Link className="text-link" href="/dashboard/employer/jobs">
                <ArrowLeft size={16} />
                Your listings
              </Link>
              <h1>
                {path.endsWith("/new")
                  ? "Make room for new talent."
                  : "Refine your opportunity."}
              </h1>
              <p className="intro">
                Be clear about the work, expectations and what applicants can
                learn.
              </p>
              <form
                className="panel fields"
                onSubmit={(e) => {
                  e.preventDefault();
                  action(async () => {
                    const payload = {
                      ...form,
                      skills: form.skills
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    };
                    if (path.endsWith("/new")) await api.post("/jobs", payload);
                    else
                      await api.patch(`/jobs/${path.split("/")[4]}`, payload);
                    router.push("/dashboard/employer/jobs");
                  }, "Job listing saved");
                }}
              >
                {[
                  ["Job title", "title", "text", null, true],
                  ["Location", "location", "text", null, true],
                  [
                    "Job type",
                    "jobType",
                    "text",
                    ["Internship", "Full-time", "Part-time", "Contract"],
                  ],
                  [
                    "Workplace",
                    "workplaceType",
                    "text",
                    ["Remote", "Hybrid", "On-site"],
                  ],
                  ["Skills (comma separated)", "skills", "text", null, true],
                  ["Salary / stipend", "salary"],
                  [
                    "Application deadline",
                    "applicationDeadline",
                    "date",
                    null,
                    true,
                  ],
                  ["Listing status", "status", "text", ["Open", "Closed"]],
                  [
                    "Description, responsibilities and requirements",
                    "description",
                    "textarea",
                    null,
                    true,
                  ],
                ].map(([label, name, type, options, required]) => (
                  <Field
                    key={name}
                    label={label}
                    name={name}
                    value={form[name]}
                    type={type}
                    options={options}
                    required={required}
                    onChange={change}
                    wide={type === "textarea"}
                    minLength={name === "description" ? 30 : undefined}
                  />
                ))}
                <div className="row full">
                  <button disabled={busy}>
                    Save listing
                    <Check size={16} />
                  </button>
                  <Link
                    className="button secondary"
                    href="/dashboard/employer/jobs"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            </>
          )}
          {isEmployerApps && employer && data && (
            <>
              <Link className="text-link" href="/dashboard/employer/jobs">
                <ArrowLeft size={16} />
                Your listings
              </Link>
              <h1>Meet the applicants.</h1>
              <div className="row between">
                <p className="intro">
                  Review their experience and keep them updated.
                </p>
                <select
                  style={{ width: 180 }}
                  aria-label="Filter applications by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {[
                    "All",
                    "Pending",
                    "Reviewing",
                    "Accepted",
                    "Rejected",
                    "Withdrawn",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="stack">
                {data
                  .filter(
                    (a) => statusFilter === "All" || a.status === statusFilter,
                  )
                  .map((a) => (
                    <article className="panel" key={a._id}>
                      <div className="row between">
                        <div>
                          <h3>{a.applicant.name}</h3>
                          <p className="muted">
                            {a.applicant.email} · {a.profile?.location}
                          </p>
                        </div>
                        <span className="tag blue">{a.status}</span>
                      </div>
                      <p className="prose spacer">{a.coverLetter}</p>
                      {a.profile && (
                        <details className="spacer">
                          <summary>Profile and experience</summary>
                          <p className="prose spacer">{a.profile.bio}</p>
                          <p className="prose">{a.profile.education}</p>
                          <p className="prose">{a.profile.experience}</p>
                          <div className="row spacer">
                            {a.profile.skills?.map((s) => (
                              <span className="tag" key={s}>
                                {s}
                              </span>
                            ))}
                          </div>
                        </details>
                      )}
                      <div className="row spacer">
                        <a
                          className="text-link"
                          href={a.resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open résumé
                          <ArrowUpRight size={16} />
                        </a>
                        {(
                          {
                            Pending: ["Reviewing", "Rejected"],
                            Reviewing: ["Accepted", "Rejected"],
                          }[a.status] || []
                        ).map((s) => (
                          <button
                            key={s}
                            className={s === "Rejected" ? "secondary" : ""}
                            disabled={busy}
                            onClick={() =>
                              action(async () => {
                                await api.patch(
                                  `/applications/${a._id}/status`,
                                  { status: s },
                                );
                                refresh();
                              }, "Application status updated")
                            }
                          >
                            {s === "Reviewing"
                              ? "Start review"
                              : s === "Accepted"
                                ? "Accept"
                                : "Reject"}
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
              </div>
              {!data.filter(
                (a) => statusFilter === "All" || a.status === statusFilter,
              ).length && empty("No applications in this view")}
            </>
          )}
          {!isBrowse && !isAuth && !data && !error && (
            <div className="loading spacer" />
          )}
          {data &&
            !isBrowse &&
            !isAuth &&
            !isDetail &&
            !isProfile &&
            !isSaved &&
            !isEdit &&
            !isEmployerApps &&
            !isApps &&
            !isEmployerJobs &&
            !isDashboard && (
              <div className="empty">
                <h1>Page not found.</h1>
                <Link href="/jobs" className="button">
                  Discover jobs
                </Link>
              </div>
            )}
          <footer className="row between">
            <span>© {new Date().getFullYear()} CareerLaunch</span>
            <span>
              {mode === "local-demo"
                ? "Demo environment · All companies and opportunities are fictional."
                : "Your next chapter starts here."}
            </span>
          </footer>
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <dialog ref={dialog} onCancel={() => setConfirm(null)}>
        <h2>{confirm?.title}</h2>
        <p>{confirm?.body}</p>
        <div className="row spacer">
          <button className="secondary" onClick={() => setConfirm(null)}>
            Cancel
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={async () => {
              const ok = await action(confirm.run, "Done");
              if (ok) setConfirm(null);
            }}
          >
            Confirm
          </button>
        </div>
      </dialog>
    </div>
  );
}
