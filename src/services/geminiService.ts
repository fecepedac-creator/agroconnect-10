import { GoogleGenerativeAI } from "@google/generative-ai";

// Lee la clave de API desde las variables de entorno de Vite
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// Inicialización del cliente API
// Se mostrará un error en la consola si la clave no está, y las funciones devolverán un mensaje amigable.
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const getErrorMessage = "Error: La clave de API para el servicio de IA no está configurada. Agrega VITE_GEMINI_API_KEY a tus variables de entorno.";

export const generateJobDescription = async (basicInfo: string): Promise<string> => {
  if (!genAI) return getErrorMessage;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});
    const prompt = `Actúa como un experto en Reclutamiento Agrícola para el mercado chileno. Redacta una oferta laboral para: ${basicInfo}`;
    const result = await model.generateContent(prompt);
    return result.response.text() || "No se pudo generar la descripción.";
  } catch (error) {
    console.error("Error generating job description:", error);
    return "Error al conectar con la IA. Verifica tu clave de API y la conexión a internet.";
  }
};

export const generateBroadcastMessage = async (context: string): Promise<string> => {
  if (!genAI) return getErrorMessage;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});
    const prompt = `Redacta un mensaje de difusión masiva para WhatsApp: "${context}"`;
    const result = await model.generateContent(prompt);
    return result.response.text() || "No se pudo generar el mensaje.";
  } catch (error) {
    console.error("Error generating broadcast:", error);
    return "Error al conectar con la IA. Verifica tu clave de API y la conexión a internet.";
  }
};

export const analyzeSystemHealth = async (systemData: string): Promise<string> => {
  if (!genAI) return getErrorMessage;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest"});
    const prompt = `Analiza la salud operativa basándote en: ${systemData}`;
    const result = await model.generateContent(prompt);
    return result.response.text() || "Análisis no disponible.";
  } catch (error) {
    console.error("Error analyzing system:", error);
    return "Error al ejecutar el análisis de IA.";
  }
};
