import "./globals.css";
export const metadata = {
  title: "CareerLaunch | Your next chapter starts here",
  description:
    "Discover internships and early-career opportunities. Build your profile, apply and track your next step.",
};
export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
