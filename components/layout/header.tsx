import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto w-full max-w-screen-2xl px-4 flex h-16 items-center justify-between">
        {/* Left side: Title and Home */}
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight hover:opacity-80 transition">
            Housing Admin Tracker
          </Link>
          <ThemeSwitcher />
          <Link href="/">
            <Button variant="ghost" className="bg-muted">Home</Button>
          </Link>
        </div>

        {/* Right side: Auth controls */}
        <div className="flex items-center gap-4">
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
