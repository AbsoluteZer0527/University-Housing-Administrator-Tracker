export function Footer() {
  return (
    <footer className="border-t w-full py-6">
      <div className="mx-auto max-w-screen-2xl px-4 text-center">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} University Housing Admin Tracker. All rights reserved.
        </p>
      </div>
    </footer>
  );
}