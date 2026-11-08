export type TerminalTheme = "obsidian" | "amber-crt" | "matrix-emerald" | "paper-light";

const THEME_KEY = "crystal_heimdall_terminal_theme";

export function getActiveTheme(): TerminalTheme {
  if (typeof window === "undefined") return "obsidian";
  const saved = localStorage.getItem(THEME_KEY) as TerminalTheme;
  if (saved && ["obsidian", "amber-crt", "matrix-emerald", "paper-light"].includes(saved)) {
    return saved;
  }
  return "obsidian";
}

export function setActiveTheme(theme: TerminalTheme): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
  applyThemeToDom(theme);
}

export function applyThemeToDom(theme?: TerminalTheme): void {
  if (typeof document === "undefined") return;
  const targetTheme = theme || getActiveTheme();
  document.documentElement.setAttribute("data-theme", targetTheme);
  
  if (targetTheme === "paper-light") {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }
}
