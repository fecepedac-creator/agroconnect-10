import {useEffect, useState} from "react";
import {CheckCircle2, Save} from "lucide-react";
import {httpsCallable} from "firebase/functions";
import {updateWorkerProfile, updateWorkerRut} from "../services/workerAuth";
import {functions} from "../firebase";
import {formatRut, isValidRut} from "../utils/rut";
import type {EmploymentSector} from "../sectorExperience";
import {getSectorTheme} from "../sectorTheme";

type Mobility = "needs_transport" | "public_transport" | "own_transport";
type Os10Status = "none" | "in_process" | "valid" | "expired";
type PreferredShift = "day" | "night" | "rotating" | "any";

export type EditableWorkerProfile = {
  fullName?: string;
  rut?: string;
  phone?: string;
  commune?: string;
  primaryTrade?: string;
  sectors?: EmploymentSector[];
  mobility?: Mobility;
  available?: boolean;
  os10Status?: Os10Status;
  preferredShift?: PreferredShift;
};

type Props = {
  uid: string;
  email: string;
  profile: EditableWorkerProfile | null;
  sector?: EmploymentSector;
};

export default function WorkerProfileEditor({uid, email, profile, sector = "agriculture"}: Props) {
  const theme = getSectorTheme(sector);
  const [fullName, setFullName] = useState("");
  const [rut, setRut] = useState("");
  const [phone, setPhone] = useState("");
  const [commune, setCommune] = useState("");
  const [primaryTrade, setPrimaryTrade] = useState("");
  const [sectors, setSectors] = useState<EmploymentSector[]>([]);
  const [mobility, setMobility] = useState<Mobility>("public_transport");
  const [available, setAvailable] = useState(true);
  const [os10Status, setOs10Status] = useState<Os10Status>("none");
  const [preferredShift, setPreferredShift] = useState<PreferredShift>("any");
  const [saving, setSaving] = useState(false);
  const [requestingDeletion, setRequestingDeletion] = useState(false);
  const [notice, setNotice] = useState<{type: "success" | "error"; text: string} | null>(null);

  useEffect(() => {
    setFullName(profile?.fullName || "");
    setRut(profile?.rut ? formatRut(profile.rut) : "");
    setPhone((profile?.phone || "").replace(/^\+?569/, ""));
    setCommune(profile?.commune || "");
    setPrimaryTrade(profile?.primaryTrade || "");
    setSectors(profile?.sectors || []);
    setMobility(profile?.mobility || "public_transport");
    setAvailable(profile?.available !== false);
    setOs10Status(profile?.os10Status || "none");
    setPreferredShift(profile?.preferredShift || "any");
  }, [profile]);

  const toggleSector = (sector: EmploymentSector) => {
    setSectors((current) => current.includes(sector)
      ? current.filter((item) => item !== sector)
      : [...current, sector]);
  };

  const save = async () => {
    setNotice(null);
    if (!fullName.trim() || !commune.trim() || !primaryTrade.trim()) {
      setNotice({type: "error", text: "Completa nombre, comuna y oficio principal."});
      return;
    }
    if (sectors.length === 0) {
      setNotice({type: "error", text: "Selecciona al menos un tipo de trabajo."});
      return;
    }
    if (phone && phone.length !== 8) {
      setNotice({type: "error", text: "El teléfono debe tener 8 dígitos."});
      return;
    }
    if (rut && !isValidRut(rut)) {
      setNotice({type: "error", text: "El RUT ingresado no es válido."});
      return;
    }

    setSaving(true);
    try {
      await updateWorkerProfile(uid, {
        fullName,
        phone,
        commune,
        primaryTrade,
        sectors,
        mobility,
        available,
        os10Status,
        preferredShift,
      });
      if (rut && rut.replace(/[^0-9kK]/g, "").toLowerCase() !== (profile?.rut || "").replace(/[^0-9kK]/g, "").toLowerCase()) {
        await updateWorkerRut(uid, rut, email);
      }
      setNotice({type: "success", text: "Tu perfil quedó actualizado."});
    } catch (error: any) {
      setNotice({type: "error", text: error?.message || "No se pudo guardar el perfil."});
    } finally {
      setSaving(false);
    }
  };

  const inputClass = `min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base outline-none focus:ring-2 ${theme.focus}`;

  const requestDeletion = async () => {
    if (!window.confirm("Ocultaremos tu perfil y enviaremos una solicitud de eliminación. ¿Deseas continuar?")) return;
    setRequestingDeletion(true);
    setNotice(null);
    try {
      const requestWorkerDataDeletion = httpsCallable(functions, "requestWorkerDataDeletion");
      await requestWorkerDataDeletion({});
      setAvailable(false);
      setNotice({type: "success", text: "Tu perfil quedó oculto y la solicitud de eliminación fue registrada."});
    } catch (error: any) {
      setNotice({type: "error", text: error?.message || "No se pudo registrar la solicitud de eliminación."});
    } finally {
      setRequestingDeletion(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900">Mi perfil laboral</h2>
            <p className="mt-2 text-base text-gray-600">Una sola cuenta para todas tus oportunidades.</p>
          </div>
          <label className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 text-base font-black ${theme.soft}`}>
            <input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} className={`h-5 w-5 ${theme.accent}`} />
            Disponible para trabajar
          </label>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-black text-gray-700">
            Nombre y apellido
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} />
          </label>
          <label className="space-y-2 text-sm font-black text-gray-700">
            Comuna donde vives
            <input value={commune} onChange={(event) => setCommune(event.target.value)} className={inputClass} />
          </label>
          <label className="space-y-2 text-sm font-black text-gray-700">
            Oficio o trabajo principal
            <input value={primaryTrade} onChange={(event) => setPrimaryTrade(event.target.value)} className={inputClass} placeholder="Ejemplo: poda o guardia" />
          </label>
          <label className="space-y-2 text-sm font-black text-gray-700">
            Teléfono
            <div className="flex gap-2">
              <span className="flex min-h-12 items-center rounded-xl border border-gray-300 bg-gray-50 px-3 text-sm font-bold text-gray-500">+569</span>
              <input value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^0-9]/g, "").slice(0, 8))} className={inputClass} inputMode="numeric" />
            </div>
          </label>
        </div>

        <fieldset className="mt-7">
          <legend className="text-base font-black text-gray-900">Tipos de trabajo que te interesan</legend>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {(["agriculture", "security"] as EmploymentSector[]).map((sector) => (
              <button key={sector} type="button" onClick={() => toggleSector(sector)} className={`min-h-14 rounded-2xl border-2 text-base font-black ${sectors.includes(sector) ? theme.selected : "border-gray-200 text-gray-600"}`}>
                {sector === "agriculture" ? "Agricultura" : "Seguridad"}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
        <h3 className="text-xl font-black text-gray-900">Movilidad y turnos</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-black text-gray-700">
            Cómo te trasladas
            <select value={mobility} onChange={(event) => setMobility(event.target.value as Mobility)} className={inputClass}>
              <option value="needs_transport">Necesito transporte</option>
              <option value="public_transport">Uso locomoción pública</option>
              <option value="own_transport">Tengo transporte propio</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-black text-gray-700">
            Turno preferido
            <select value={preferredShift} onChange={(event) => setPreferredShift(event.target.value as PreferredShift)} className={inputClass}>
              <option value="any">Cualquier turno</option>
              <option value="day">Día</option>
              <option value="night">Noche</option>
              <option value="rotating">Rotativo</option>
            </select>
          </label>
          {sectors.includes("security") && (
            <label className="space-y-2 text-sm font-black text-gray-700 sm:col-span-2">
              Estado de tu OS10
              <select value={os10Status} onChange={(event) => setOs10Status(event.target.value as Os10Status)} className={inputClass}>
                <option value="none">No tengo OS10</option>
                <option value="in_process">En proceso</option>
                <option value="valid">Vigente</option>
                <option value="expired">Vencido</option>
              </select>
            </label>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-7">
        <h3 className="text-lg font-black text-amber-950">Verificación de identidad</h3>
        <p className="mt-2 text-sm leading-relaxed text-amber-900">El RUT ayuda a evitar perfiles duplicados. No se muestra públicamente.</p>
        <input value={rut} onChange={(event) => setRut(formatRut(event.target.value))} className={`${inputClass} mt-4`} placeholder="RUT (opcional por ahora)" inputMode="numeric" />
      </section>

      {notice && (
        <div className={`rounded-2xl border p-4 text-sm font-bold ${notice.type === "success" ? theme.soft : "border-red-200 bg-red-50 text-red-800"}`}>
          {notice.type === "success" && <CheckCircle2 size={18} className="mr-2 inline" />}
          {notice.text}
        </div>
      )}

      <button onClick={save} disabled={saving} className={`flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl text-base font-black shadow-lg disabled:opacity-60 ${theme.button}`}>
        <Save size={20} /> {saving ? "Guardando..." : "Guardar mi perfil"}
      </button>
      <section className="rounded-3xl border border-red-200 bg-white p-5 sm:p-7">
        <h3 className="text-lg font-black text-slate-900">Privacidad y eliminación</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Puedes ocultar inmediatamente tu perfil y solicitar la eliminación de tus datos. El equipo revisará los registros que deban conservarse por obligación legal o seguridad.</p>
        <button onClick={requestDeletion} disabled={requestingDeletion} className="mt-4 min-h-12 w-full rounded-2xl border-2 border-red-300 px-4 font-black text-red-800 disabled:opacity-60">
          {requestingDeletion ? "Registrando solicitud..." : "Solicitar eliminación de mis datos"}
        </button>
      </section>
    </div>
  );
}
