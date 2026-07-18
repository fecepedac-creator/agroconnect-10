import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  limit,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  Briefcase,
  Image as ImageIcon,
  Sparkles,
  MapPin,
  DollarSign,
  Users,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  Bus,
  ShieldCheck,
} from "lucide-react";
import { db, functions } from "../firebase";
import { AppView, Company, JobOffer } from "../types";

type PosterFormat = "post" | "story";

type PosterDoc = {
  id: string;
  state: "queued" | "running" | "ready" | "error";
  format: PosterFormat;
  version: number;
  editInstruction?: string;
  assets?: {
    postUrl?: string;
    storyUrl?: string;
    thumbUrl?: string;
  };
  createdAt?: any;
  updatedAt?: any;
  errorMessage?: string;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatCLP(value: string) {
  const n = Number(String(value).replace(/[^0-9]/g, ""));
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat("es-CL").format(n);
}

/**
 * PublishOffer
 * - Guarda borrador y publica en: companies/{companyId}/jobs/{jobId}
 * - Solicita texto IA escribiendo aiRequest en el job (backend lo resuelve y escribe aiGeneratedText)
 * - Solicita afiche RRSS creando docs en: companies/{companyId}/jobs/{jobId}/posters (backend genera URLs en assets)
 *
 * Importante:
 * - No hace cálculos complejos ni queries pesadas en UI
 * - Firestore es la fuente de verdad
 */
export default function PublishOffer({
  company,
  onNavigate,
}: {
  company: Company;
  onNavigate: (view: AppView) => void;
}) {
  const companyId = company.id;

  // Datos mínimos
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [payMode, setPayMode] = useState<JobOffer["payMode"]>("Al Día");
  const [payAmount, setPayAmount] = useState("");
  const [payDetail, setPayDetail] = useState("");
  const [startDate, setStartDate] = useState("");
  const [duration, setDuration] = useState("");
  const [workersNeeded, setWorkersNeeded] = useState<number>(8);
  const [sector, setSector] = useState<JobOffer["sector"]>("agriculture");
  const [category, setCategory] = useState("Cosecha");
  const [transportMode, setTransportMode] = useState<JobOffer["transportMode"]>("pending");
  const [pickupPoints, setPickupPoints] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [shiftType, setShiftType] = useState<JobOffer["shiftType"]>("day");
  const [shiftPattern, setShiftPattern] = useState("");
  const [requiresOs10, setRequiresOs10] = useState(true);
  const [facilityType, setFacilityType] = useState("");

  // Aptitudes (chips)
  const [skillsInput, setSkillsInput] = useState("");
  const [skillsRequired, setSkillsRequired] = useState<string[]>([]);

  // IA (texto)
  const [aiSeedNotes, setAiSeedNotes] = useState("");
  const [aiGeneratedText, setAiGeneratedText] = useState("");

  // Firestore (job)
  const [jobId, setJobId] = useState<string | null>(null);
  const jobRef = useMemo(() => (jobId ? doc(db, "companies", companyId, "jobs", jobId) : null), [companyId, jobId]);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Posters
  const [posters, setPosters] = useState<PosterDoc[]>([]);
  const [activePosterId, setActivePosterId] = useState<string | null>(null);
  const activePoster = useMemo(
    () => posters.find((p) => p.id === activePosterId) || posters[0] || null,
    [posters, activePosterId]
  );
  const [posterBusy, setPosterBusy] = useState(false);
  const [posterEditInstruction, setPosterEditInstruction] = useState("");

  const canSave = useMemo(() => title.trim().length >= 3 && location.trim().length >= 2 && workersNeeded > 0, [
    title,
    location,
    workersNeeded,
  ]);

  // Listen job: trae aiGeneratedText y poster.activePosterId si backend actualiza
  useEffect(() => {
    if (!jobRef) return;
    const unsub = onSnapshot(jobRef, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as any;
      if (typeof d.aiGeneratedText === "string" && d.aiGeneratedText !== aiGeneratedText) {
        setAiGeneratedText(d.aiGeneratedText);
      }
      if (d.poster?.activePosterId && d.poster?.activePosterId !== activePosterId) {
        setActivePosterId(d.poster.activePosterId);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobRef]);

  // Posters listener (light): top 8 versions
  useEffect(() => {
    if (!jobId) return;
    const q = query(
      collection(db, "companies", companyId, "jobs", jobId, "posters"),
      orderBy("version", "desc"),
      limit(8)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: PosterDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setPosters(list);
      if (!activePosterId && list.length) setActivePosterId(list[0].id);
    });
    return () => unsub();
  }, [companyId, jobId, activePosterId]);

  const addSkills = () => {
    const raw = skillsInput.trim();
    if (!raw) return;
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    setSkillsRequired((prev) => Array.from(new Set([...prev, ...parts])));
    setSkillsInput("");
  };

  const removeSkill = (s: string) => setSkillsRequired((prev) => prev.filter((x) => x !== s));

  const buildPayload = (): Partial<JobOffer> => {
    const parsedPayAmount = payAmount ? Number(String(payAmount).replace(/[^0-9]/g, "")) : undefined;
    return {
      title: title.trim(),
      location: location.trim(),
      description: aiGeneratedText?.trim() || "",
      workersNeeded: Number(workersNeeded) || 0,
      workersFilled: 0,
      startDate: startDate || new Date().toISOString().slice(0, 10),
      isActive: false,
      jobStatus: "future",
      isDraft: true,
      payMode: payMode || "Al Día",
      payAmount: Number.isFinite(parsedPayAmount as any) ? parsedPayAmount : undefined,
      payDetail: payDetail?.trim() || undefined,
      skillsRequired,
      aiSeedNotes: aiSeedNotes?.trim() || undefined,
      aiGeneratedText: aiGeneratedText?.trim() || undefined,
      sector,
      category,
      transportMode: sector === "agriculture" ? transportMode : undefined,
      pickupPoints: sector === "agriculture" ? pickupPoints.trim() : undefined,
      departureTime: sector === "agriculture" ? departureTime : undefined,
      benefits: { transport: sector === "agriculture" && transportMode === "employer_transport" },
      shiftType: sector === "security" ? shiftType : undefined,
      shiftPattern: sector === "security" ? shiftPattern.trim() : undefined,
      requiresOs10: sector === "security" ? requiresOs10 : undefined,
      facilityType: sector === "security" ? facilityType.trim() : undefined,
      otherBenefits: duration.trim() ? `Duración: ${duration.trim()}` : undefined,
      publishPublic: false,
      // Sin geocoding en frontend en esta etapa (evita cálculos/queries)
      coordinates: { lat: -35.426, lng: -71.666 },
    } as any;
  };

  const saveDraft = async () => {
    setError(null);
    setSavedOk(false);
    if (!canSave) {
      setError("Completa al menos: Puesto de trabajo, Lugar y Cupos.");
      return;
    }

    setSaving(true);
    try {
      if (!jobId) {
        const newRef = doc(collection(db, "companies", companyId, "jobs"));
        await setDoc(
          newRef,
          {
            ...buildPayload(),
            companyId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          } as any,
          { merge: true }
        );
        setJobId(newRef.id);
      } else if (jobRef) {
        await updateDoc(jobRef, { ...buildPayload(), updatedAt: serverTimestamp() } as any);
      }
      setSavedOk(true);
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar el borrador.");
    } finally {
      setSaving(false);
    }
  };

  const publishOffer = async () => {
    setError(null);
    setSavedOk(false);
    if (!canSave) {
      setError("Completa al menos: Puesto de trabajo, Lugar y Cupos.");
      return;
    }

    setSaving(true);
    try {
      const targetRef = jobId
        ? doc(db, "companies", companyId, "jobs", jobId)
        : doc(collection(db, "companies", companyId, "jobs"));
      await setDoc(targetRef, {
        ...buildPayload(),
        companyId,
        isDraft: false,
        isActive: true,
        jobStatus: "active",
        publishPublic: true,
        publishedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
        ...(!jobId ? {createdAt: serverTimestamp()} : {}),
      } as any, {merge: true});
      if (!jobId) setJobId(targetRef.id);
      setSavedOk(true);
    } catch (e: any) {
      setError(e?.message || "No se pudo publicar la oferta.");
    } finally {
      setSaving(false);
    }
  };

  const requestTextIA = async () => {
    setError(null);
    if (!canSave) {
      setError("Completa datos mínimos antes de pedir IA.");
      return;
    }
    
    // Save draft first
    await saveDraft();
    
    setAiGeneratedText("Generando texto con IA…");
    
    try {
      const generateFn = httpsCallable(functions, "generateJobDescription");
      const context = `
        Puesto: ${title}
        Ubicación: ${location}
        Pago: ${payMode} ${payAmount ? `$${payAmount}` : ""}
        Cupos: ${workersNeeded}
        Notas adicionales: ${aiSeedNotes || "ninguna"}
      `;
      
      const result = await generateFn({ basicInfo: context });
      const data = result.data as { ok?: boolean; text?: string };
      
      if (data?.text) {
        setAiGeneratedText(data.text);
        
        // Also save to Firestore
        if (jobRef) {
          await updateDoc(jobRef, {
            aiGeneratedText: data.text,
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        setError("La IA no generó texto. Intenta de nuevo.");
        setAiGeneratedText("");
      }
    } catch (e: any) {
      console.error("AI generation error:", e);
      if (e?.code === "functions/failed-precondition") {
        setError("La IA no está configurada. Contacta al administrador.");
      } else if (e?.code === "functions/permission-denied") {
        setError("No tienes permisos para usar esta función.");
      } else {
        setError(e?.message || "No se pudo generar texto con IA.");
      }
      setAiGeneratedText("");
    }
  };

  const nextPosterVersion = useMemo(() => posters.reduce((m, p) => Math.max(m, p.version || 0), 0) + 1, [posters]);

  const requestPoster = async (format: PosterFormat, editInstruction?: string, makeActive = true) => {
    setError(null);
    if (!canSave) {
      setError("Completa datos mínimos y guarda el borrador antes de generar afiche.");
      return;
    }
    await saveDraft();
    if (!jobId) return;

    setPosterBusy(true);
    try {
      const postersCol = collection(db, "companies", companyId, "jobs", jobId, "posters");
      const ref = await addDoc(postersCol, {
        state: "queued",
        format,
        version: nextPosterVersion,
        editInstruction: editInstruction?.trim() || undefined,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } as any);

      if (makeActive) {
        await updateDoc(doc(db, "companies", companyId, "jobs", jobId), {
          poster: { activePosterId: ref.id, status: "generating", updatedAt: serverTimestamp() },
        } as any);
        setActivePosterId(ref.id);
      }
    } catch (e: any) {
      console.error("Poster generation error:", e);
      // Provide user-friendly error messages based on error type
      if (e?.code === "permission-denied") {
        setError("No tienes permisos para generar afiches. Contacta al administrador.");
      } else if (e?.code === "unavailable") {
        setError("Servicio de generación de afiches temporalmente no disponible. Intenta más tarde.");
      } else if (e?.message) {
        setError(`Error al generar afiche: ${e.message}`);
      } else {
        setError("No se pudo solicitar el afiche. Intenta de nuevo.");
      }
    } finally {
      setPosterBusy(false);
    }
  };

  const posterPreviewUrl = useMemo(() => {
    if (!activePoster) return null;
    return activePoster.assets?.thumbUrl || activePoster.assets?.postUrl || activePoster.assets?.storyUrl || null;
  }, [activePoster]);

  const posterStateLabel = useMemo(() => {
    if (!activePoster) return "Sin afiche";
    if (activePoster.state === "queued" || activePoster.state === "running") return "Generando…";
    if (activePoster.state === "ready") return "Listo";
    return "Error";
  }, [activePoster]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold text-gray-500">Gestión de ofertas</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">Crear oferta de trabajo</div>
          <div className="mt-2 text-sm text-gray-600">
            Completa las condiciones del trabajo, revisa la información y luego publica.
          </div>
        </div>
        <button
          onClick={() => onNavigate(AppView.JOBS)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-extrabold text-gray-800 hover:bg-gray-50"
        >
          Volver a ofertas
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Briefcase size={18} className="text-emerald-600" />
                <div className="text-sm font-extrabold text-gray-900">1) Datos mínimos</div>
              </div>
              <div className="text-xs font-bold text-gray-500">{jobId ? `Borrador: ${jobId}` : "Aún no guardado"}</div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <div className="text-xs font-extrabold text-gray-500">Área de trabajo</div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => { setSector("agriculture"); setCategory("Cosecha"); }} className={`min-h-12 rounded-xl border-2 text-sm font-extrabold ${sector === "agriculture" ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-gray-200 text-gray-600"}`}>Agricultura</button>
                  <button type="button" onClick={() => { setSector("security"); setCategory("Guardia de seguridad"); }} className={`min-h-12 rounded-xl border-2 text-sm font-extrabold ${sector === "security" ? "border-blue-800 bg-blue-50 text-blue-950" : "border-gray-200 text-gray-600"}`}>Seguridad</button>
                </div>
              </div>

              <div>
                <div className="text-xs font-extrabold text-gray-500">Tipo de labor</div>
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold">
                  {(sector === "security" ? ["Guardia de seguridad", "Control de acceso", "Rondín", "Supervisor", "Otros"] : ["Cosecha", "Packing", "Poda", "Maquinaria", "Otros"]).map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>

              <div>
                <div className="text-xs font-extrabold text-gray-500">Puesto de trabajo</div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Cosechero de arándanos"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div>
                <div className="text-xs font-extrabold text-gray-500">Lugar / faena</div>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <MapPin size={16} className="text-gray-500" />
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ej: Fundo Santa Elena (Talca)"
                    className="w-full bg-transparent text-sm font-semibold text-gray-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs font-extrabold text-gray-500">Remuneración</div>
                <select
                  value={(payMode as any) || "Al Día"}
                  onChange={(e) => setPayMode(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <option>Al Día</option>
                  <option>Semanal</option>
                  <option>Quincenal</option>
                  <option>Mensual</option>
                  <option>Por Kilo</option>
                  <option>Por Hora</option>
                  <option>Por Turno</option>
                  <option>Otro</option>
                </select>
              </div>

              <div>
                <div className="text-xs font-extrabold text-gray-500">Monto</div>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <DollarSign size={16} className="text-gray-500" />
                  <input
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Ej: 35000"
                    className="w-full bg-transparent text-sm font-semibold text-gray-900 outline-none"
                  />
                </div>
                <div className="mt-1 text-xs font-semibold text-gray-500">
                  {payAmount ? `Vista: $${formatCLP(payAmount)} CLP` : "Ej: 35000 → $35.000 CLP"}
                </div>
              </div>

              <div>
                <div className="text-xs font-extrabold text-gray-500">Detalle (opcional)</div>
                <input
                  value={payDetail}
                  onChange={(e) => setPayDetail(e.target.value)}
                  placeholder="Ej: $150/kg, bono asistencia, etc."
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div>
                <div className="text-xs font-extrabold text-gray-500">Fecha inicio</div>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <CalendarDays size={16} className="text-gray-500" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-transparent text-sm font-semibold text-gray-900 outline-none"
                  />
                </div>
              </div>

              <div className="md:col-span-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Guardar borrador mantiene la oferta privada. Al presionar Publicar oferta será visible para trabajadores.
              </div>

              <div>
                <div className="text-xs font-extrabold text-gray-500">Duración (opcional)</div>
                <input
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="Ej: 10 días"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              {sector === "agriculture" ? (
                <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 md:col-span-2">
                  <h3 className="flex items-center gap-2 font-extrabold text-emerald-950"><Bus size={18} /> Transporte</h3>
                  <label className="block text-xs font-bold text-emerald-900">¿Cómo llegan los trabajadores?<select value={transportMode} onChange={(event) => setTransportMode(event.target.value as JobOffer["transportMode"])} className="mt-1 min-h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm"><option value="pending">Por confirmar</option><option value="employer_transport">La empresa proporciona transporte</option><option value="transport_allowance">Asignación de movilización</option><option value="worker_own">Cada trabajador llega por sus medios</option></select></label>
                  {transportMode === "employer_transport" && <div className="grid gap-3 md:grid-cols-2"><input value={pickupPoints} onChange={(event) => setPickupPoints(event.target.value)} placeholder="Puntos de encuentro o recorrido" className="min-h-11 rounded-xl border border-emerald-200 px-3 text-sm md:col-span-2" /><label className="text-xs font-bold text-emerald-900">Hora de salida<input type="time" value={departureTime} onChange={(event) => setDepartureTime(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-emerald-200 px-3" /></label></div>}
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 md:col-span-2">
                  <h3 className="flex items-center gap-2 font-extrabold text-blue-950"><ShieldCheck size={18} /> Condiciones de seguridad</h3>
                  <div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-bold text-blue-950">Turno<select value={shiftType} onChange={(event) => setShiftType(event.target.value as JobOffer["shiftType"])} className="mt-1 min-h-11 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm"><option value="day">Día</option><option value="night">Noche</option><option value="rotating">Rotativo</option></select></label><label className="text-xs font-bold text-blue-950">Modalidad<input value={shiftPattern} onChange={(event) => setShiftPattern(event.target.value)} placeholder="Ej: 4x4" className="mt-1 min-h-11 w-full rounded-xl border border-blue-200 px-3 text-sm" /></label><label className="text-xs font-bold text-blue-950 md:col-span-2">Tipo de instalación<input value={facilityType} onChange={(event) => setFacilityType(event.target.value)} placeholder="Ej: condominio, bodega o planta" className="mt-1 min-h-11 w-full rounded-xl border border-blue-200 px-3 text-sm" /></label><label className="flex min-h-11 items-center gap-3 rounded-xl bg-white px-3 text-sm font-bold text-blue-950 md:col-span-2"><input type="checkbox" checked={requiresOs10} onChange={(event) => setRequiresOs10(event.target.checked)} className="h-5 w-5 accent-blue-900" /> Requiere OS10 vigente</label></div>
                </div>
              )}

              <div>
                <div className="text-xs font-extrabold text-gray-500">Cupos</div>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <Users size={16} className="text-gray-500" />
                  <input
                    type="number"
                    min={1}
                    value={workersNeeded}
                    onChange={(e) => setWorkersNeeded(Number(e.target.value))}
                    className="w-full bg-transparent text-sm font-semibold text-gray-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs font-extrabold text-gray-500">Aptitudes requeridas (chips)</div>
                <div className="mt-1 flex gap-2">
                  <input
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    placeholder="Ej: Cosecha, Packing"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-200"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkills();
                      }
                    }}
                  />
                  <button
                    onClick={addSkills}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-emerald-700"
                  >
                    Agregar
                  </button>
                </div>

                {skillsRequired.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {skillsRequired.map((s) => (
                      <button
                        key={s}
                        onClick={() => removeSkill(s)}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-extrabold text-gray-800 hover:bg-gray-50"
                        title="Quitar"
                      >
                        {s} ✕
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={saveDraft}
                disabled={!canSave || saving}
                className={cx(
                  "rounded-xl px-4 py-2 text-sm font-extrabold",
                  !canSave || saving ? "bg-gray-200 text-gray-500" : "bg-emerald-600 text-white hover:bg-emerald-700"
                )}
              >
                Guardar borrador
              </button>

              <button
                onClick={publishOffer}
                disabled={!canSave || saving}
                className={cx(
                  "rounded-xl px-4 py-2 text-sm font-extrabold",
                  !canSave || saving ? "bg-gray-200 text-gray-500" : "bg-gray-900 text-white hover:bg-gray-950"
                )}
              >
                Publicar oferta
              </button>

              {savedOk && (
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-800">
                  <CheckCircle2 size={14} /> Guardado
                </div>
              )}

              {error && (
                <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-extrabold text-rose-800">
                  <AlertTriangle size={14} /> {error}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-emerald-600" />
              <div className="text-sm font-extrabold text-gray-900">2) IA: redactar oferta (opcional)</div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div>
                <div className="text-xs font-extrabold text-gray-500">Ideas o frases (opcional)</div>
                <textarea
                  value={aiSeedNotes}
                  onChange={(e) => setAiSeedNotes(e.target.value)}
                  rows={3}
                  placeholder='Ej: "Pago diario, inicio lunes, salida 06:00, cupos limitados"'
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={requestTextIA}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-emerald-700"
                >
                  <Wand2 size={16} /> Generar texto con IA
                </button>
                <div className="text-xs font-semibold text-gray-500">
                  Se procesa en backend y se guarda en Firestore (fuente de verdad).
                </div>
              </div>

              <div>
                <div className="text-xs font-extrabold text-gray-500">Texto final (editable)</div>
                <textarea
                  value={aiGeneratedText}
                  onChange={(e) => setAiGeneratedText(e.target.value)}
                  rows={8}
                  placeholder="Aquí aparecerá el texto generado, o puedes escribirlo manualmente."
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-extrabold text-gray-900">Vista previa</div>
            <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-base font-extrabold text-gray-900">{title || "Puesto de trabajo"}</div>
              <div className="mt-1 text-sm font-semibold text-gray-700">{location || "Lugar / faena"}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-extrabold">
                <span className="rounded-full bg-white px-3 py-1 border border-gray-200 text-gray-800">
                  Pago: {payMode}{payAmount ? ` · $${formatCLP(payAmount)} CLP` : ""}
                </span>
                <span className="rounded-full bg-white px-3 py-1 border border-gray-200 text-gray-800">Cupos: {workersNeeded}</span>
                {startDate ? (
                  <span className="rounded-full bg-white px-3 py-1 border border-gray-200 text-gray-800">Inicio: {startDate}</span>
                ) : null}
              </div>
              {aiGeneratedText ? (
                <div className="mt-3 text-sm text-gray-800 whitespace-pre-line">
                  {aiGeneratedText.length > 260 ? aiGeneratedText.slice(0, 260) + "…" : aiGeneratedText}
                </div>
              ) : (
                <div className="mt-3 text-sm text-gray-500">Texto aún no definido.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ImageIcon size={18} className="text-emerald-600" />
              <div className="text-sm font-extrabold text-gray-900">3) Afiche para RRSS</div>
            </div>
            <div className="mt-2 text-sm text-gray-600">Incluye logo empresa + logo AgroConnect + datos básicos. Tú publicas.</div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-extrabold text-gray-500">Vista previa ({posterStateLabel})</div>
                {activePoster ? <div className="text-xs font-bold text-gray-500">v{activePoster.version}</div> : null}
              </div>

              <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white">
                {posterPreviewUrl ? (
                  <img src={posterPreviewUrl} alt="Afiche RRSS" className="w-full h-auto" />
                ) : (
                  <div className="flex h-48 items-center justify-center text-sm font-semibold text-gray-500">Aún no hay afiche generado</div>
                )}
              </div>

              {activePoster?.state === "error" && activePoster.errorMessage ? (
                <div className="mt-2 text-xs font-bold text-rose-700">Error: {activePoster.errorMessage}</div>
              ) : null}

              <div className="mt-3 grid grid-cols-1 gap-2">
                <button
                  onClick={() => requestPoster("post")}
                  disabled={posterBusy}
                  className={cx("rounded-xl px-4 py-2 text-sm font-extrabold text-white", posterBusy ? "bg-gray-300" : "bg-emerald-600 hover:bg-emerald-700")}
                >
                  Generar afiche (Post · Facebook)
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => requestPoster("post")}
                    disabled={posterBusy}
                    className={cx("rounded-xl border px-3 py-2 text-sm font-extrabold", posterBusy ? "border-gray-200 bg-gray-100 text-gray-500" : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50")}
                  >
                    Generar otra versión
                  </button>
                  <button
                    onClick={() => requestPoster("story", undefined, false)}
                    disabled={!jobId || posterBusy}
                    className={cx("rounded-xl border px-3 py-2 text-sm font-extrabold", !jobId || posterBusy ? "border-gray-200 bg-gray-100 text-gray-500" : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50")}
                    title={!jobId ? "Guarda el borrador primero" : ""}
                  >
                    Generar también Story (Instagram)
                  </button>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="text-xs font-extrabold text-gray-500">Ajustar con IA (opcional)</div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={posterEditInstruction}
                      onChange={(e) => setPosterEditInstruction(e.target.value)}
                      placeholder='Ej: "Más formal", "Más verde", "Destacar cupos limitados"'
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                    <button
                      onClick={() => {
                        const instr = posterEditInstruction.trim();
                        if (!instr) return;
                        requestPoster("post", instr);
                        setPosterEditInstruction("");
                      }}
                      disabled={posterBusy || !posterEditInstruction.trim()}
                      className={cx("rounded-xl px-3 py-2 text-sm font-extrabold text-white", posterBusy || !posterEditInstruction.trim() ? "bg-gray-300" : "bg-gray-900 hover:bg-gray-950")}
                    >
                      Ajustar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {activePoster?.assets?.postUrl && <a
                    href={activePoster.assets.postUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-xs font-extrabold text-gray-800 hover:bg-gray-50"
                  >
                    Descargar Post
                  </a>}
                  {activePoster?.assets?.storyUrl && <a
                    href={activePoster.assets.storyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-xs font-extrabold text-gray-800 hover:bg-gray-50"
                  >
                    Descargar Story
                  </a>}
                  {jobId && <button
                    onClick={() => {
                      const link = `${window.location.origin}/trabajos/${jobId}?sector=${sector === "security" ? "security" : "agriculture"}`;
                      navigator.clipboard?.writeText(link);
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-xs font-extrabold text-gray-800 hover:bg-gray-50"
                  >
                    Copiar enlace
                  </button>}
                </div>

                {posters.length > 0 ? (
                  <div className="mt-2">
                    <div className="text-xs font-extrabold text-gray-500">Versiones</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {posters
                        .slice()
                        .sort((a, b) => (b.version || 0) - (a.version || 0))
                        .map((p) => (
                          <button
                            key={p.id}
                            onClick={async () => {
                              setActivePosterId(p.id);
                              if (jobId) {
                                await updateDoc(doc(db, "companies", companyId, "jobs", jobId), {
                                  poster: { activePosterId: p.id, status: p.state === "ready" ? "ready" : "generating", updatedAt: serverTimestamp() },
                                } as any);
                              }
                            }}
                            className={cx(
                              "rounded-full px-3 py-1 text-xs font-extrabold border",
                              p.id === activePosterId ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                            )}
                            title={p.state}
                          >
                            v{p.version} · {p.format}
                          </button>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {jobId && <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="text-sm font-extrabold text-gray-900">Difusión opcional</div><p className="mt-2 text-sm text-gray-600">Después de publicar, prepara un mensaje y compártelo manualmente desde la sección Difundir oferta.</p><button type="button" onClick={() => onNavigate(AppView.BROADCASTS)} className="mt-4 min-h-11 w-full rounded-xl border border-emerald-300 px-4 text-sm font-extrabold text-emerald-800 hover:bg-emerald-50">Ir a difusión</button></div>}
        </div>
      </div>
    </div>
  );
}
