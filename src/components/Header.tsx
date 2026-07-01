import Link from "next/link";
import MarketChip from "./MarketChip";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-edge/80 bg-night/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">📈</span>
          <span className="display text-lg font-extrabold tracking-tight text-ink sm:text-xl">
            The&nbsp;Big&nbsp;Board
          </span>
        </Link>
        <nav className="ml-2 hidden items-center gap-1 sm:flex">
          <NavLink href="/">Scoreboard</NavLink>
          <NavLink href="/draft">Draft Day</NavLink>
          <NavLink href="/stocks">Stocks</NavLink>
          <NavLink href="/admin">Parents</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <MarketChip />
        </div>
      </div>
      <nav className="flex items-center justify-around border-t border-edge/60 px-2 py-1.5 sm:hidden">
        <NavLink href="/">Scoreboard</NavLink>
        <NavLink href="/draft">Draft</NavLink>
        <NavLink href="/stocks">Stocks</NavLink>
        <NavLink href="/admin">Parents</NavLink>
      </nav>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3 py-1.5 text-sm font-bold text-ink-dim transition-colors hover:bg-panel2 hover:text-ink"
    >
      {children}
    </Link>
  );
}
