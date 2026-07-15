export const LEGAL_VERSION = "2026-07-15";

export const LEGAL_OPERATOR = {
  name: import.meta.env.VITE_LEGAL_OPERATOR_NAME || "MundoConnect",
  rut: import.meta.env.VITE_LEGAL_OPERATOR_RUT || "Pendiente de configurar",
  address: import.meta.env.VITE_LEGAL_OPERATOR_ADDRESS || "Pendiente de configurar",
  email: import.meta.env.VITE_LEGAL_CONTACT_EMAIL || "soporte@mundoconnect.cl",
};

export const LEGAL_DOCUMENTS = {
  terms: {
    title: "Términos de uso",
    summary: "MundoConnect facilita el contacto entre personas y empresas. No contrata trabajadores ni decide las condiciones laborales.",
  },
  privacy: {
    title: "Privacidad y datos personales",
    summary: "Usamos solo la información necesaria para mostrar oportunidades, administrar el perfil y habilitar contacto con consentimiento.",
  },
};

