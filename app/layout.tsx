export const metadata = {
  title: "Domestique",
  description: "Peace Partners Collective — internal tooling",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
