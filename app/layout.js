import { Syne } from "next/font/google";
import "./globals.css";
import "./apple-light.css";

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

export const metadata = {
  title: "Java Coffee Cart | Java Times Caffé",
  description: "Cotiza, aparta y paga tu evento con Java Coffee Cart.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={syne.variable}>
      <body>{children}</body>
    </html>
  );
}
