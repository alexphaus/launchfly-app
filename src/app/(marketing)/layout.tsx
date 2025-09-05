// Marketing layout for route group
export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="launchfly-homepage">
      {children}
    </div>
  );
}
