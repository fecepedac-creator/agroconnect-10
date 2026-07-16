import {useEffect, useState} from "react";
import {collection, onSnapshot, query, where} from "firebase/firestore";
import {httpsCallable} from "firebase/functions";
import {Award, CheckCircle2, Clock3, ExternalLink, XCircle} from "lucide-react";
import {db, functions} from "../firebase";
import type {EmploymentSector} from "../sectorExperience";
import {getSectorTheme} from "../sectorTheme";

type Credential = {
  id: string;
  title?: string;
  credentialType?: string;
  status?: string;
  evidenceReference?: string | null;
  expiresAt?: {toDate?: () => Date} | null;
};

const credentialTypes: Record<string, string> = {
  os10: "Curso OS10",
  sence: "Curso SENCE",
  license: "Licencia o permiso",
  training: "Capacitacion",
  other: "Otro antecedente",
};

const statusPresentation: Record<string, {label: string; className: string}> = {
  pending: {label: "Declarada, pendiente de revision", className: "bg-amber-50 text-amber-800"},
  active: {label: "Documento revisado por una empresa", className: "bg-emerald-50 text-emerald-800"},
  rejected: {label: "No validada", className: "bg-red-50 text-red-800"},
};

const isSafeLink = (value?: string | null) => Boolean(value && /^https:\/\//i.test(value));

export default function WorkerCredentialsPanel({uid, sector = "agriculture"}: {uid: string; sector?: EmploymentSector}) {
  const theme = getSectorTheme(sector);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [title, setTitle] = useState("");
  const [credentialType, setCredentialType] = useState("training");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const credentialsQuery = query(
      collection(db, "worker_credentials"),
      where("workerId", "==", uid)
    );
    return onSnapshot(credentialsQuery, (snapshot) => {
      setCredentials(snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<Credential, "id">),
      })));
    }, () => setMessage("No fue posible cargar tus antecedentes."));
  }, [uid]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);
    try {
      await httpsCallable(functions, "submitWorkerCredentialEvidence")({
        title,
        credentialType,
        evidenceReference,
        expiresAt,
      });
      setTitle("");
      setEvidenceReference("");
      setExpiresAt("");
      setMessage("Antecedente agregado. Una empresa podra revisarlo despues de hacer match contigo.");
    } catch (error: any) {
      setMessage(error?.message || "No fue posible agregar el antecedente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`rounded-2xl p-3 ${theme.buttonMuted}`}><Award size={24} /></div>
        <div>
          <h3 className="text-lg font-extrabold text-gray-900">Cursos y certificaciones</h3>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            Agrega tus antecedentes. Solo una empresa con la que hagas match podra revisar el respaldo.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-4">
        <label className="grid gap-2 text-sm font-bold text-gray-800">
          Nombre del curso o certificado
          <input required value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className="min-h-12 rounded-xl border border-gray-300 bg-white px-4 text-base font-normal" placeholder="Ejemplo: Curso OS10 vigente" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-gray-800">
            Tipo
            <select value={credentialType} onChange={(event) => setCredentialType(event.target.value)} className="min-h-12 rounded-xl border border-gray-300 bg-white px-4 text-base font-normal">
              {Object.entries(credentialTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-gray-800">
            Vencimiento (opcional)
            <input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="min-h-12 rounded-xl border border-gray-300 bg-white px-4 text-base font-normal" />
          </label>
        </div>
        <label className="grid gap-2 text-sm font-bold text-gray-800">
          Numero, enlace o referencia del respaldo (opcional)
          <input value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} maxLength={300} className="min-h-12 rounded-xl border border-gray-300 bg-white px-4 text-base font-normal" placeholder="Ejemplo: codigo del certificado o enlace https://..." />
        </label>
        <button disabled={submitting} className={`min-h-12 rounded-xl px-5 text-base font-extrabold disabled:opacity-50 ${theme.button}`}>
          {submitting ? "Agregando..." : "Agregar antecedente"}
        </button>
      </form>

      {message && <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-900">{message}</div>}

      <div className="mt-6 grid gap-3">
        {credentials.map((credential) => {
          const status = statusPresentation[credential.status || "pending"] || statusPresentation.pending;
          return (
            <article key={credential.id} className="rounded-2xl border border-gray-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-extrabold text-gray-900">{credential.title || "Antecedente"}</div>
                  <div className="mt-1 text-sm text-gray-500">{credentialTypes[credential.credentialType || "other"] || "Otro antecedente"}</div>
                </div>
                <span className={`inline-flex min-h-8 items-center gap-1 self-start rounded-full px-3 text-xs font-bold ${status.className}`}>
                  {credential.status === "active" ? <CheckCircle2 size={14} /> : credential.status === "rejected" ? <XCircle size={14} /> : <Clock3 size={14} />}
                  {status.label}
                </span>
              </div>
              {credential.evidenceReference && (
                <div className="mt-3 break-all text-sm text-gray-600">
                  {isSafeLink(credential.evidenceReference) ? (
                    <a href={credential.evidenceReference} target="_blank" rel="noreferrer" className={`inline-flex min-h-11 items-center gap-2 font-bold underline ${theme.accentText}`}>
                      Ver respaldo <ExternalLink size={15} />
                    </a>
                  ) : `Referencia: ${credential.evidenceReference}`}
                </div>
              )}
            </article>
          );
        })}
        {credentials.length === 0 && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-gray-500">Aun no has agregado cursos o certificaciones.</div>}
      </div>
      <p className="mt-5 text-xs leading-5 text-gray-500">AgroConnect organiza la informacion y registra quien la reviso. No reemplaza al organismo que emitio el certificado.</p>
    </section>
  );
}
