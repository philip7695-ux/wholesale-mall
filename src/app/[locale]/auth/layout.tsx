export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-secondary to-background px-4">
      {children}
    </div>
  )
}
