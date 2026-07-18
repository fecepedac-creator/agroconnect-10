import type {EmploymentSector} from "./sectorExperience";

export function getSectorTheme(sector: EmploymentSector) {
  const security = sector === "security";
  return {
    page: security ? "bg-slate-100" : "bg-gray-50",
    text: security ? "text-blue-950" : "text-emerald-900",
    accentText: security ? "text-blue-900" : "text-emerald-700",
    mutedText: security ? "text-blue-800" : "text-emerald-700",
    soft: security ? "border-blue-200 bg-blue-50 text-blue-950" : "border-emerald-200 bg-emerald-50 text-emerald-900",
    softBackground: security ? "bg-blue-50" : "bg-emerald-50",
    softBorder: security ? "border-blue-200" : "border-emerald-200",
    button: security ? "bg-blue-950 text-white hover:bg-blue-900" : "bg-emerald-700 text-white hover:bg-emerald-800",
    buttonMuted: security ? "bg-blue-100 text-blue-950" : "bg-emerald-100 text-emerald-800",
    selected: security ? "border-blue-900 bg-blue-50 text-blue-950" : "border-emerald-600 bg-emerald-50 text-emerald-900",
    focus: security ? "focus:ring-blue-300" : "focus:ring-emerald-300",
    accent: security ? "accent-blue-950" : "accent-emerald-600",
    hoverBorder: security ? "hover:border-blue-400" : "hover:border-emerald-300",
  };
}
