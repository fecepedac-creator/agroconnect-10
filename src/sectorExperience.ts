export type EmploymentSector = "agriculture" | "security";

export type SectorExperience = {
  id: EmploymentSector;
  brand: string;
  eyebrow: string;
  headline: string;
  description: string;
  workerCta: string;
  companyCta: string;
  jobsTitle: string;
  jobsDescription: string;
  highlights: Array<{ title: string; description: string }>;
};

export const SECTOR_EXPERIENCES: Record<EmploymentSector, SectorExperience> = {
  agriculture: {
    id: "agriculture",
    brand: "AgroConnect",
    eyebrow: "Empleo agrícola en el Maule",
    headline: "Trabajo cerca de ti, con el transporte claro desde el comienzo.",
    description:
      "Revisa faenas reales, conoce el pago, el punto de encuentro y el horario antes de decir que te interesa.",
    workerCta: "Ver trabajos agrícolas",
    companyCta: "Necesito trabajadores",
    jobsTitle: "Trabajos agrícolas disponibles",
    jobsDescription: "Ofertas con ubicación, pago y condiciones de traslado explicadas sin letra chica.",
    highlights: [
      { title: "Transporte visible", description: "Sabrás dónde te recogen, a qué hora y si tiene costo." },
      { title: "Pago y jornada claros", description: "Compara las condiciones antes de postular." },
      { title: "Empresas identificadas", description: "Conoce quién publica cada oportunidad." },
    ],
  },
  security: {
    id: "security",
    brand: "SeguridadConnect",
    eyebrow: "Oportunidades de seguridad en tu zona",
    headline: "Encuentra un turno que calce con tu vida.",
    description:
      "Compara ubicación, modalidad de turno, sueldo y requisitos OS10 antes de manifestar tu interés.",
    workerCta: "Ver trabajos de seguridad",
    companyCta: "Necesito guardias",
    jobsTitle: "Trabajos de seguridad disponibles",
    jobsDescription: "Turnos, instalaciones y requisitos presentados de manera directa y fácil de comparar.",
    highlights: [
      { title: "Turnos comprensibles", description: "Día, noche o rotativo, con horarios visibles." },
      { title: "Ubicación primero", description: "Evalúa cómo llegar antes de postular." },
      { title: "Requisitos transparentes", description: "OS10 y experiencia aparecen sin sorpresas." },
    ],
  },
};

export function sectorFromSearch(search = window.location.search): EmploymentSector {
  return new URLSearchParams(search).get("sector") === "security" ? "security" : "agriculture";
}

export function sectorQuery(sector: EmploymentSector) {
  return `?sector=${sector}`;
}
