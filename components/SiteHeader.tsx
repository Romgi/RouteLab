"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { BrandMark } from "./BrandMark";

const links = [
  { href: "/", label: "Story" },
  { href: "/lab", label: "Lab" },
  { href: "/compare", label: "Compare" },
  { href: "/code", label: "Code" },
  { href: "/docs", label: "Docs" },
];

type Theme = "dark" | "light";
const themeEvent = "routelab-theme-change";

function getThemeSnapshot(): Theme {
  const saved = window.localStorage.getItem("routelab-theme");
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
}

function getServerThemeSnapshot(): Theme {
  return "dark";
}

function subscribeToTheme(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const onStorage = (event: StorageEvent) => {
    if (event.key === "routelab-theme") callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(themeEvent, callback);
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(themeEvent, callback);
    media.removeEventListener("change", callback);
  };
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem("routelab-theme", nextTheme);
    window.dispatchEvent(new Event(themeEvent));
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand-link" href="/" aria-label="RouteLab home">
          <BrandMark />
        </Link>
        <nav
          id="primary-navigation"
          className={menuOpen ? "primary-nav is-open" : "primary-nav"}
          aria-label="Primary"
        >
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="header-actions">
          <span className="status-pill">
            <span aria-hidden="true" /> deterministic
          </span>
          <button
            className="icon-button"
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            <span aria-hidden="true">{theme === "dark" ? "☼" : "◐"}</span>
          </button>
          <button
            className="menu-button"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span aria-hidden="true">{menuOpen ? "×" : "≡"}</span>
            <span className="sr-only">Toggle navigation</span>
          </button>
        </div>
      </div>
    </header>
  );
}
