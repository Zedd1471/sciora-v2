import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { HomeButton } from "@/components/ui/HomeButton";
import CustomCursor from "@/components/ui/CustomCursor";
import InteractiveBackground from "@/components/ui/InteractiveBackground";
import { KeyboardNavDetector } from "@/components/ui/KeyboardNavDetector";
import { ToastProvider } from "@/components/ui/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sciora — E-Learning Redefined",
    template: "%s | Sciora",
  },
  description:
    "A premium e-learning platform for lecture notes and secure, distraction-free testing. Designed for focus.",
  metadataBase: new URL("https://sciora.app"),
  openGraph: {
    title: "Sciora — E-Learning Redefined",
    description:
      "Access lecture notes and take secure tests in a premium, distraction-free environment.",
    type: "website",
  },
  icons: {
    icon: "/sciora.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground transition-colors duration-500 overflow-x-hidden`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {/* Skip to main content — keyboard a11y */}
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <KeyboardNavDetector />
          <CustomCursor />
          <InteractiveBackground />
          <ThemeToggle />
          <HomeButton />
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
