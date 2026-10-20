import "./globals.css";
import "pdfjs-dist/web/pdf_viewer.css";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Verso · Bilingual resume workspace",
  description:
    "Shape your career story in English and Portuguese, with browser-based LaTeX PDFs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
              const root = document.documentElement;
              let preference = "system";
              try {
                const saved = localStorage.getItem("verso-theme");
                if (saved === "light" || saved === "dark") preference = saved;
              } catch {}
              root.dataset.themePreference = preference;
              root.classList.toggle("dark", preference === "dark" ||
                (preference === "system" && matchMedia("(prefers-color-scheme: dark)").matches));
            })();`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
