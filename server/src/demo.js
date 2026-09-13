import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
export async function seedDemo(store, { password } = {}) {
  if (await store.one("users", { email: "employer@careerlaunch.demo" })) return;
  const passwordHash = await bcrypt.hash(
    password || randomBytes(32).toString("base64url"),
    12,
  );
  const now = new Date().toISOString();
  const employer = await store.insert("users", {
    name: "Alex Morgan",
    email: "employer@careerlaunch.demo",
    role: "employer",
    passwordHash,
    createdAt: now,
  });
  const applicant = await store.insert("users", {
    name: "Sam Taylor",
    email: "applicant@careerlaunch.demo",
    role: "applicant",
    passwordHash,
    createdAt: now,
  });
  await store.insert("profiles", {
    userId: employer._id,
    companyName: "Northstar Labs",
    description:
      "A fictional product studio used to demonstrate CareerLaunch. We build thoughtful digital tools with small, collaborative teams.",
    website: "",
    location: "Lahore",
  });
  await store.insert("profiles", {
    userId: applicant._id,
    bio: "Computer science graduate interested in thoughtful web products.",
    skills: ["React", "JavaScript", "Node.js"],
    location: "Lahore",
    education: "BS Computer Science",
    experience: "Personal projects and university coursework",
    resumeUrl: "",
  });
  const titles = [
    "Frontend Developer Intern",
    "Junior Product Designer",
    "Graduate Software Engineer",
    "Backend Developer Intern",
    "Junior QA Engineer",
    "Marketing & Content Intern",
    "Associate Data Analyst",
    "React Developer",
    "Product Management Intern",
  ];
  for (let i = 0; i < titles.length; i++)
    await store.insert("jobs", {
      employerId: employer._id,
      title: titles[i],
      company: "Northstar Labs",
      description: `Join our ${titles[i].toLowerCase()} programme and work alongside an experienced team on useful digital products. This is a fictional listing for the CareerLaunch demo.\n\nWhat you will do\n• Collaborate with designers and engineers on real product workflows.\n• Own small, well-defined tasks from planning to delivery.\n• Share your work, receive feedback and document what you learn.\n\nWhat we are looking for\n• Curiosity, clear communication and a willingness to learn.\n• Relevant coursework or personal projects.\n• A thoughtful approach to solving problems.\n\nWhat you can expect\nMentorship, regular feedback, flexible collaboration and a supportive team.`,
      location: ["Lahore", "Karachi", "Islamabad"][i % 3],
      jobType: i % 2 === 0 ? "Internship" : "Full-time",
      workplaceType: ["Remote", "Hybrid", "On-site"][i % 3],
      skills: [
        ["React", "JavaScript", "Tailwind"],
        ["Figma", "UX", "Prototyping"],
        ["Node.js", "MongoDB", "Git"],
      ][i % 3],
      salary:
        i % 2 === 0
          ? "PKR 30,000–50,000 / month"
          : "PKR 80,000–120,000 / month",
      applicationDeadline: new Date(Date.now() + 60 * 86400000)
        .toISOString()
        .slice(0, 10),
      status: "Open",
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    });
}
