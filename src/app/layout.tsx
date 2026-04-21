import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Username Tool",
  description:
    "Search Fragment for available Telegram usernames. Powered by Fragment API.",
  icons: {
    icon: "https://fragment.com/img/fragment.ico",
    shortcut: "https://fragment.com/img/fragment.ico",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="https://fragment.com/img/fragment.ico" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
