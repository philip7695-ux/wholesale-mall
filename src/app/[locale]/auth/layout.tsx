export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left: Fashion hero image */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <img
          src="/images/login-hero.jpg"
          alt="Fashion"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/20" />
        {/* Overlay brand text */}
        <div className="absolute bottom-12 left-12 right-12">
          <p className="text-white/70 text-sm tracking-[0.3em] uppercase font-light">
            Members Only
          </p>
          <h2 className="text-white text-4xl font-light mt-2 leading-tight tracking-tight">
            Wholesale<br />Fashion Platform
          </h2>
        </div>
      </div>

      {/* Right: Auth form */}
      <div className="relative flex w-full items-center justify-center bg-white px-6 lg:w-1/2">
        {children}
      </div>
    </div>
  )
}
