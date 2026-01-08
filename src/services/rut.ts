// src/services/rut.ts

// Valida un RUT chileno
export const validateRut = (rut: string): boolean => {
  if (!/^[0-9]{1,2}.[0-9]{3}.[0-9]{3}-[0-9kK]{1}$/.test(rut)) {
    return false;
  }

  const cleanRut = rut.replace(/[^0-9kK]/g, "");
  let t = parseInt(cleanRut.slice(0, -1), 10);
  let m = 0;
  let s = 1;

  while (t > 0) {
    s = (s + (t % 10) * (9 - (m++ % 6))) % 11;
    t = Math.floor(t / 10);
  }

  const v = s > 0 ? "" + (s - 1) : "k";
  return v === cleanRut.slice(-1);
};

// Formatea un RUT chileno mientras se escribe
export const formatRut = (rut: string): string => {
  const cleanRut = rut.replace(/[^0-9kK]/g, "");
  const len = cleanRut.length;
  let result = cleanRut;

  if (len > 1) {
    const body = cleanRut.slice(0, len - 1);
    const dv = cleanRut.slice(len - 1);
    result = `${body}-${dv}`;
  }

  if (len > 4) {
    const p1 = result.slice(0, result.length - 5);
    const p2 = result.slice(result.length - 5, result.length - 2);
    const p3 = result.slice(result.length - 2);
    result = `${p1}.${p2}${p3}`;
  }

  if (len > 7) {
    const p1 = result.slice(0, result.length - 9);
    const p2 = result.slice(result.length - 9, result.length - 6);
    const p3 = result.slice(result.length - 6);
    result = `${p1}.${p2}${p3}`;
  }

  return result;
};

// Elimina puntos y guión para almacenamiento
export const normalizeRut = (rut: string): string => {
  return rut.replace(/[^0-9kK]/g, "").toLowerCase();
};

// Convierte un RUT a un email interno para Firebase Auth
export const rutToInternalEmail = (rut: string): string => {
  const normalized = normalizeRut(rut);
  return `${normalized}@agroconnect.cl`;
};
