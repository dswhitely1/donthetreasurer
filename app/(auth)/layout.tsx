export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Treasurer
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Nonprofit financial management
        </p>
      </div>
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}
