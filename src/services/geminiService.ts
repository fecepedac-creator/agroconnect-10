import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export const generateJobDescription = async (basicInfo: string): Promise<string> => {
  try {
    const fn = httpsCallable(functions, "generateJobDescription");
    const res = await fn({ basicInfo });
    const data = res.data as { ok?: boolean; text?: string };
    return data?.text || "No se pudo generar la descripción.";
  } catch (error) {
    console.error("Error generating job description:", error);
    return "No se pudo generar la descripción con IA. Revisa tu sesión o reintenta.";
  }
};

export const generateBroadcastMessage = async (
  context: string,
  campaignType?: string
): Promise<string> => {
  try {
    const fn = httpsCallable(functions, "redactarDifusion");
    const res = await fn({ context, campaignType });
    const data = res.data as { ok?: boolean; text?: string };
    return data?.text || "No se pudo generar el mensaje.";
  } catch (error) {
    console.error("Error generating broadcast:", error);
    return "No se pudo generar el mensaje con IA. Revisa tu sesión o reintenta.";
  }
};

export const analyzeSystemHealth = async (systemData: string): Promise<string> => {
  try {
    const fn = httpsCallable(functions, "aiReview");
    const res = await fn({ subject: systemData });
    const data = res.data as { ok?: boolean; output?: { summary?: string } };
    return data?.output?.summary || "Análisis no disponible.";
  } catch (error) {
    console.error("Error analyzing system:", error);
    return "Error al ejecutar el análisis de IA.";
  }
};
