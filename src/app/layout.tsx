import type { Metadata } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import CoachDrawer from "@/components/coach/CoachDrawer";

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "The Big Board — Draft, Compete, Learn",
  description: "A family stock market competition for future investors.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${baloo.variable} ${nunito.variable} antialiased`}>
        <Header />
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6">
          {children}
        </main>
        <CoachDrawer />
      </body>
    </html>
  );
}
