import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContextCore";

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg transition-all duration-300 hover:scale-110 active:scale-95"
      style={{
        backgroundColor: theme === "dark" ? "rgb(30, 41, 59)" : "rgb(241, 245, 249)",
        color: theme === "dark" ? "rgb(148, 163, 184)" : "rgb(71, 85, 105)",
        border: theme === "dark" ? "1px solid rgb(15, 23, 42)" : "1px solid rgb(226, 232, 240)",
      }}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      aria-label="Toggle theme"
    >
      {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
    </button>
  );
}
