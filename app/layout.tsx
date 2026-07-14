import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "KÖNA | Kofferverwaltung", description: "Digitale Übergabe und Verwaltung von Einsatzkoffern." };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="de"><body>{children}</body></html>}
