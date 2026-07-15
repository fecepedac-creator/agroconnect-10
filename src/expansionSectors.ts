export type ExpansionSectorSlug =
  | "construccion"
  | "salud"
  | "transporte"
  | "forestal"
  | "retail"
  | "logistica"
  | "servicios"
  | "turismo"
  | "industria";

export type ExpansionSectorIconName =
  | "construction"
  | "health"
  | "transport"
  | "forestry"
  | "retail"
  | "logistics"
  | "services"
  | "tourism"
  | "industry";

export type ExpansionSector = {
  slug: ExpansionSectorSlug;
  brand: string;
  shortName: string;
  icon: ExpansionSectorIconName;
  eyebrow: string;
  headline: string;
  description: string;
  roles: string[];
  companyFocus: string;
  credentialNote: string;
  accent: string;
  accentText: string;
  glow: string;
  gradient: string;
};

export const EXPANSION_SECTORS: ExpansionSector[] = [
  {
    slug: "construccion",
    brand: "ConstrucciónConnect",
    shortName: "Construcción",
    icon: "construction",
    eyebrow: "Oficios y obras cerca de ti",
    headline: "Cuadrillas y oficios que llegan cuando la obra los necesita.",
    description: "Conecta empresas, contratistas y trabajadores de obra con funciones, duración y condiciones claras.",
    roles: ["Jornal y ayudante", "Maestro de obra", "Soldadura", "Operación de maquinaria"],
    companyFocus: "Faena, duración, jornada, elementos de protección y punto de encuentro.",
    credentialNote: "Las especialidades y licencias de maquinaria deberán poder verificarse.",
    accent: "#fbbf24",
    accentText: "#1c1917",
    glow: "rgba(251,191,36,0.2)",
    gradient: "linear-gradient(135deg, #0f172a 0%, #292524 55%, #78350f 100%)",
  },
  {
    slug: "transporte",
    brand: "TransporteConnect",
    shortName: "Transporte",
    icon: "transport",
    eyebrow: "Rutas, turnos y licencias visibles",
    headline: "Personas confiables para mantener Chile en movimiento.",
    description: "Una experiencia para conductores, peonetas, despachadores y empresas de transporte de pasajeros o carga.",
    roles: ["Conducción profesional", "Peoneta", "Despacho", "Control de flota"],
    companyFocus: "Tipo de vehículo, ruta, licencia requerida, turnos y lugar de inicio.",
    credentialNote: "La licencia de conducir y certificaciones obligatorias deben validarse antes del match.",
    accent: "#38bdf8",
    accentText: "#082f49",
    glow: "rgba(56,189,248,0.2)",
    gradient: "linear-gradient(135deg, #020617 0%, #0c4a6e 58%, #075985 100%)",
  },
  {
    slug: "retail",
    brand: "RetailConnect",
    shortName: "Retail",
    icon: "retail",
    eyebrow: "Comercio y atención local",
    headline: "Refuerzos rápidos para tiendas que no pueden detenerse.",
    description: "Acerca oportunidades en supermercados, tiendas, farmacias y comercio a trabajadores de cada comuna.",
    roles: ["Reposición", "Caja", "Ventas", "Inventario"],
    companyFocus: "Sucursal, horario, uniforme, experiencia y duración del reemplazo.",
    credentialNote: "La experiencia en caja, inventario o atención podrá respaldarse con evaluaciones.",
    accent: "#fb7185",
    accentText: "#4c0519",
    glow: "rgba(251,113,133,0.2)",
    gradient: "linear-gradient(135deg, #0f172a 0%, #4c0519 58%, #881337 100%)",
  },
  {
    slug: "logistica",
    brand: "LogísticaConnect",
    shortName: "Logística",
    icon: "logistics",
    eyebrow: "Bodegas y distribución",
    headline: "El equipo correcto para preparar, mover y entregar.",
    description: "Conecta centros de distribución y bodegas con personas disponibles para operaciones de alta demanda.",
    roles: ["Bodega", "Picking y packing", "Carga y descarga", "Grúa horquilla"],
    companyFocus: "Centro de trabajo, turno, exigencia física, transporte y elementos de seguridad.",
    credentialNote: "La operación de equipos requiere licencia o acreditación verificable.",
    accent: "#a3e635",
    accentText: "#1a2e05",
    glow: "rgba(163,230,53,0.2)",
    gradient: "linear-gradient(135deg, #020617 0%, #1a2e05 58%, #365314 100%)",
  },
  {
    slug: "servicios",
    brand: "ServiciosConnect",
    shortName: "Servicios",
    icon: "services",
    eyebrow: "Apoyo que hace funcionar cada lugar",
    headline: "Equipos de apoyo confiables, disponibles en tu zona.",
    description: "Para empresas de aseo, mantención, áreas verdes, conserjería y servicios operativos.",
    roles: ["Aseo", "Mantención", "Áreas verdes", "Apoyo operativo"],
    companyFocus: "Lugar, funciones, insumos, jornada y protocolos de seguridad.",
    credentialNote: "Las evaluaciones de cumplimiento y asistencia serán especialmente relevantes.",
    accent: "#2dd4bf",
    accentText: "#042f2e",
    glow: "rgba(45,212,191,0.2)",
    gradient: "linear-gradient(135deg, #020617 0%, #134e4a 58%, #115e59 100%)",
  },
  {
    slug: "turismo",
    brand: "TurismoConnect",
    shortName: "Turismo y gastronomía",
    icon: "tourism",
    eyebrow: "Hospitalidad y temporadas",
    headline: "Refuerzos para recibir, atender y servir mejor.",
    description: "Acerca hoteles, restaurantes, eventos y destinos turísticos a personas disponibles en temporada o turnos.",
    roles: ["Garzón y atención", "Cocina", "Aseo de habitaciones", "Eventos"],
    companyFocus: "Turno, propinas, alimentación, uniforme y transporte de salida.",
    credentialNote: "La manipulación de alimentos y otras exigencias sanitarias deberán acreditarse.",
    accent: "#fb923c",
    accentText: "#431407",
    glow: "rgba(251,146,60,0.2)",
    gradient: "linear-gradient(135deg, #111827 0%, #7c2d12 58%, #9a3412 100%)",
  },
  {
    slug: "industria",
    brand: "IndustriaConnect",
    shortName: "Industria",
    icon: "industry",
    eyebrow: "Producción y manufactura",
    headline: "Personas preparadas para líneas que deben seguir produciendo.",
    description: "Conecta plantas y talleres con operarios, ayudantes y personal de producción disponible.",
    roles: ["Producción", "Envasado", "Control visual", "Mantención básica"],
    companyFocus: "Planta, turno, riesgos, implementos, transporte y experiencia requerida.",
    credentialNote: "Las funciones técnicas y de riesgo requerirán acreditaciones específicas.",
    accent: "#c4b5fd",
    accentText: "#2e1065",
    glow: "rgba(196,181,253,0.2)",
    gradient: "linear-gradient(135deg, #020617 0%, #312e81 58%, #4c1d95 100%)",
  },
  {
    slug: "salud",
    brand: "SaludConnect",
    shortName: "Salud y apoyo",
    icon: "health",
    eyebrow: "Cuidado con identidad verificada",
    headline: "Confianza y acreditación para apoyar a quienes cuidan.",
    description: "Una futura red para centros de salud, residencias y servicios de apoyo, con controles reforzados.",
    roles: ["Cuidados y acompañamiento", "TENS acreditado", "Apoyo de alimentación", "Aseo clínico"],
    companyFocus: "Centro, función exacta, turno, supervisión y acreditaciones obligatorias.",
    credentialNote: "Los cargos clínicos o regulados no podrán publicarse sin validación profesional y sanitaria.",
    accent: "#67e8f9",
    accentText: "#083344",
    glow: "rgba(103,232,249,0.2)",
    gradient: "linear-gradient(135deg, #020617 0%, #164e63 58%, #155e75 100%)",
  },
  {
    slug: "forestal",
    brand: "ForestalConnect",
    shortName: "Forestal",
    icon: "forestry",
    eyebrow: "Bosques, viveros y plantas",
    headline: "Trabajo territorial para una industria esencial del sur de Chile.",
    description: "Conecta viveros, faenas, aserraderos y plantas con trabajadores locales y condiciones de traslado claras.",
    roles: ["Vivero y plantación", "Operación de aserradero", "Apoyo de faena", "Prevención y brigadas"],
    companyFocus: "Faena, transporte, temporada, riesgos, implementos y certificaciones.",
    credentialNote: "Las funciones de alto riesgo y brigadas requerirán formación y aptitud verificadas.",
    accent: "#86efac",
    accentText: "#052e16",
    glow: "rgba(134,239,172,0.2)",
    gradient: "linear-gradient(135deg, #020617 0%, #14532d 58%, #166534 100%)",
  },
];

export function getExpansionSector(pathname: string): ExpansionSector | undefined {
  const slug = pathname.replace(/^\//, "").replace(/\/$/, "");
  return EXPANSION_SECTORS.find((sector) => sector.slug === slug);
}
