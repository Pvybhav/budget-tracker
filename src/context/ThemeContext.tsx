import React, { useLayoutEffect, useState } from "react";
import { ThemeContext } from "./ThemeContextCore";

export type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const saved = window.localStorage.getItem("budget-tracker-theme") as Theme | null;
  if (saved === "light" || saved === "dark") {
    return saved;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    window.localStorage.setItem("budget-tracker-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
