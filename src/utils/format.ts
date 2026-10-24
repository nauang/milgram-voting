import { DISPLAY_TIME_ZONE } from "@/lib/constants";

/** 1 -> "No.01" */
export function formatPrisonerNumber(prisonerNumber: number): string {
  return `No.${String(prisonerNumber).padStart(2, "0")}`;
}

/** "haruka" -> "Haruka" (usado no alt das imagens) */
export function getPrisonerDisplayName(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** Data no formato brasileiro, sempre no fuso de Brasília. */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: DISPLAY_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
