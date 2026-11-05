import { cookies } from "next/headers";

export type Theme = "dark" | "light";
export const THEME_COOKIE = "qe_theme";

export async function getTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return value === "light" ? "light" : "dark";
}
