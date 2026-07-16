import React, {useEffect, useState} from "react";
import {collection, onSnapshot, orderBy, query, where} from "firebase/firestore";
import {httpsCallable} from "firebase/functions";
import {Award, Briefcase, CheckCircle2, ExternalLink, Lock, Mail, Phone, Star, UserCheck, XCircle} from "lucide-react";
import {auth, db, functions} from "../firebase";
import type {Company} from "../types";

type MatchRecord = {
  id: string;
  jobTitle?: string;
  workerName?: string;
  state?: string;
  workerDecision?: string;
  companyDecision?: string;
};

type Contact = {phone?: string | null; email?: string | null};

type WorkerCredential = {
  id: string;
  title: string;
  credentialType: string;
  status: string;
  evidenceReference?: string | null;
  expiresAt?: string | null;
};

type ReviewState = "loading" | "not-reviewed" | "reviewed" | "error";

const labels: Record<string, string> = {
  worker_interested: "Postulación recibida",
  company_interested: "Invitación enviada",
  matched: "Ambos están interesados",
  declined: "Proceso finalizado",
  hired: "Contratado",
  closed: "Cerrado",
};

const credentialLabels: Record<string, string> = {
  os10: "Curso OS10",
  sence: "Curso SENCE",
  license: "Licencia o permiso",
  training: "Capacitacion",
  other: "Otro antecedente",
  platform_course: "Curso de la plataforma",
  company_training: "Capacitacion de empresa",
  external_verified: "Certificacion externa",
};

const CompanyMatches: React.FC<{company: Company}> = ({company}) => {
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [credentials, setCredentials] = useState<Record<string, WorkerCredential[]>>({});
  const [openCredentials, setOpenCredentials] = useState<Record<string, boolean>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [reviewStates, setReviewStates] = useState<Record<string, ReviewState>>({});
  const [reviewErrors, setReviewErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const matchesQuery = query(collection(db, "matches"), where("companyId", "==", company.id), orderBy("updatedAt", "desc"));
    return onSnapshot(matchesQuery, (snapshot) => {
      setMatches(snapshot.docs.map((item) => ({id: item.id, ...(item.data() as Omit<MatchRecord, "id">)})));
    });
  }, [company.id]);

  useEffect(() => {
    const reviewableMatches = matches.filter((match) => ["hired", "closed"].includes(match.state || ""));
    const reviewableIds = new Set(reviewableMatches.map((match) => match.id));

    setReviewStates((current) => {
      const next: Record<string, ReviewState> = {};
      reviewableMatches.forEach((match) => {
        next[match.id] = current[match.id] === "reviewed" ? "reviewed" : "loading";
      });
      return next;
    });
    setReviewErrors((current) => Object.fromEntries(
      Object.entries(current).filter(([matchId]) => reviewableIds.has(matchId))
    ));

    if (!auth.currentUser?.uid || reviewableMatches.length === 0) return;

    const reviewsQuery = query(
      collection(db, "match_reviews"),
      where("companyId", "==", company.id),
      where("side", "==", "company_to_worker")
    );
    return onSnapshot(reviewsQuery, (snapshot) => {
      const reviewedIds = new Set(snapshot.docs
        .map((review) => review.data())
        .map((review) => String(review.matchId || "")));
      setReviewStates(Object.fromEntries(reviewableMatches.map((match) => [
        match.id,
        reviewedIds.has(match.id) ? "reviewed" : "not-reviewed",
      ])));
      setReviewErrors({});
    }, () => {
      setReviewStates(Object.fromEntries(reviewableMatches.map((match) => [match.id, "error"])));
      setReviewErrors(Object.fromEntries(reviewableMatches.map((match) => [
        match.id,
        "No pudimos comprobar si esta evaluacion ya fue enviada. Intenta recargar la pagina.",
      ])));
    });
  }, [company.id, matches]);

  const runAction = async (key: string, action: () => Promise<void>) => {
    setMessage("");
    setBusy(key);
    try {
      await action();
    } catch (error: any) {
      setMessage(error?.message || "No fue posible completar la accion.");
    } finally {
      setBusy("");
    }
  };

  const respond = (matchId: string, decision: "interested" | "declined") => runAction(`respond-${matchId}`, async () => {
    await httpsCallable(functions, "respondToMatch")({matchId, decision});
  });

  const revealContact = (matchId: string) => runAction(`contact-${matchId}`, async () => {
    const result = await httpsCallable(functions, "getMatchContact")({matchId});
    const data = result.data as {contact?: Contact};
    setContacts((current) => ({...current, [matchId]: data.contact || {}}));
  });

  const markHired = (matchId: string) => runAction(`hired-${matchId}`, async () => {
    await httpsCallable(functions, "markMatchHired")({matchId});
  });

  const loadCredentials = (matchId: string) => runAction(`credentials-${matchId}`, async () => {
    if (openCredentials[matchId]) {
      setOpenCredentials((current) => ({...current, [matchId]: false}));
      return;
    }
    const result = await httpsCallable(functions, "listMatchWorkerCredentials")({matchId});
    const data = result.data as {credentials?: WorkerCredential[]};
    setCredentials((current) => ({...current, [matchId]: data.credentials || []}));
    setOpenCredentials((current) => ({...current, [matchId]: true}));
  });

  const reviewCredential = (matchId: string, credentialId: string, decision: "verified" | "rejected") => runAction(`credential-${credentialId}`, async () => {
    await httpsCallable(functions, "reviewWorkerCredential")({matchId, credentialId, decision});
    const result = await httpsCallable(functions, "listMatchWorkerCredentials")({matchId});
    const data = result.data as {credentials?: WorkerCredential[]};
    setCredentials((current) => ({...current, [matchId]: data.credentials || []}));
  });

  const submitReview = (matchId: string) => runAction(`review-${matchId}`, async () => {
    const overall = scores[matchId] || 0;
    if (overall < 1) throw new Error("Selecciona entre 1 y 5 estrellas.");
    await httpsCallable(functions, "submitMatchReview")({matchId, overall});
    setReviewStates((current) => ({...current, [matchId]: "reviewed"}));
  });

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-gray-900">Procesos de selección</h2>
        <p className="mt-1 text-sm text-gray-600">Revisa cada candidato. El contacto se habilita solamente cuando ambas partes están interesadas.</p>
      </div>
      {message && <div role="alert" aria-live="assertive" className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{message}</div>}
      <div className="grid gap-4">
        {matches.length === 0 && <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center"><Briefcase className="mx-auto text-gray-400" /><h3 className="mt-3 font-bold text-gray-900">Todavía no hay procesos de selección</h3><p className="mt-1 text-sm text-gray-500">Las postulaciones e invitaciones aparecerán aquí.</p></div>}
        {matches.map((match) => {
          const contact = contacts[match.id];
          const matchCredentials = credentials[match.id] || [];
          const canSeePrivateDetails = ["matched", "hired", "closed"].includes(match.state || "");
          return (
            <article key={match.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-extrabold text-gray-900"><Briefcase size={18} className="text-emerald-600" />{match.jobTitle || "Oferta de trabajo"}</div>
                  {match.workerName && <div className="mt-1 text-sm text-gray-600">{match.workerName}</div>}
                  <div className="mt-2 text-sm font-semibold text-emerald-700">{labels[match.state || ""] || match.state || "En revision"}</div>
                </div>
                {match.state === "worker_interested" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button disabled={Boolean(busy)} onClick={() => respond(match.id, "declined")} className="min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-50"><XCircle size={16} className="mr-1 inline" /> Descartar</button>
                    <button disabled={Boolean(busy)} onClick={() => respond(match.id, "interested")} className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-50"><UserCheck size={16} className="mr-1 inline" /> Me interesa</button>
                  </div>
                )}
              </div>

              {canSeePrivateDetails && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button disabled={Boolean(busy)} onClick={() => revealContact(match.id)} className="min-h-11 rounded-xl bg-gray-900 px-4 text-sm font-bold text-white disabled:opacity-50"><Lock size={16} className="mr-1 inline" /> Ver contacto</button>
                  <button disabled={Boolean(busy)} onClick={() => loadCredentials(match.id)} className="min-h-11 rounded-xl border border-emerald-300 px-4 text-sm font-bold text-emerald-800 disabled:opacity-50"><Award size={16} className="mr-1 inline" /> {openCredentials[match.id] ? "Ocultar antecedentes" : "Ver antecedentes"}</button>
                </div>
              )}

              {contact && (
                <div className="mt-4 grid gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-gray-800">
                  {contact.phone && <a href={`tel:${contact.phone}`} className="inline-flex min-h-11 items-center gap-2 font-bold text-emerald-800"><Phone size={17} /> {contact.phone}</a>}
                  {contact.email && <a href={`mailto:${contact.email}`} className="inline-flex min-h-11 items-center gap-2 break-all font-bold text-emerald-800"><Mail size={17} /> {contact.email}</a>}
                  {!contact.phone && !contact.email && "Sin contacto registrado"}
                </div>
              )}

              {openCredentials[match.id] && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-extrabold text-gray-900">Antecedentes declarados</h3>
                  <p className="mt-1 text-xs leading-5 text-gray-500">Revisa el respaldo antes de validarlo. AgroConnect registra tu decision, pero no emite el documento original.</p>
                  <div className="mt-4 grid gap-3">
                    {matchCredentials.map((credential) => (
                      <div key={credential.id} className="rounded-xl bg-white p-4">
                        <div className="font-bold text-gray-900">{credential.title}</div>
                        <div className="mt-1 text-xs text-gray-500">{credentialLabels[credential.credentialType] || "Otro antecedente"} · Estado: {credential.status === "active" ? "revisado" : credential.status === "rejected" ? "no validado" : "pendiente"}</div>
                        {credential.expiresAt && <div className="mt-1 text-xs text-gray-500">Vence: {new Date(credential.expiresAt).toLocaleDateString("es-CL")}</div>}
                        {credential.evidenceReference && (/^https:\/\//i.test(credential.evidenceReference) ? <a href={credential.evidenceReference} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 break-all text-sm font-bold text-emerald-700 underline">Abrir respaldo <ExternalLink size={15} /></a> : <div className="mt-2 break-all text-sm text-gray-700">Referencia: {credential.evidenceReference}</div>)}
                        {credential.status === "pending" && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button disabled={Boolean(busy)} onClick={() => reviewCredential(match.id, credential.id, "rejected")} className="min-h-11 rounded-xl border text-sm font-bold text-red-700 disabled:opacity-50">No validar</button>
                            <button disabled={Boolean(busy)} onClick={() => reviewCredential(match.id, credential.id, "verified")} className="min-h-11 rounded-xl bg-emerald-700 text-sm font-bold text-white disabled:opacity-50">Validar respaldo</button>
                          </div>
                        )}
                      </div>
                    ))}
                    {matchCredentials.length === 0 && <div className="rounded-xl border border-dashed p-5 text-center text-sm text-gray-500">Este trabajador aun no ha declarado antecedentes.</div>}
                  </div>
                </div>
              )}

              {match.state === "matched" && <button disabled={Boolean(busy)} onClick={() => markHired(match.id)} className="mt-4 min-h-11 w-full rounded-xl border border-emerald-300 text-sm font-bold text-emerald-800 disabled:opacity-50"><CheckCircle2 size={16} className="mr-1 inline" /> Marcar como contratado</button>}

              {["hired", "closed"].includes(match.state || "") && reviewStates[match.id] === "loading" && (
                <div role="status" aria-live="polite" className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">Comprobando evaluacion...</div>
              )}
              {["hired", "closed"].includes(match.state || "") && reviewStates[match.id] === "error" && (
                <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{reviewErrors[match.id]}</div>
              )}
              {["hired", "closed"].includes(match.state || "") && reviewStates[match.id] === "not-reviewed" && (
                <div className="mt-4 rounded-2xl bg-blue-50 p-4">
                  <div className="font-extrabold text-blue-950">¿Como fue el trabajo?</div>
                  <p className="mt-1 text-xs text-blue-900">La evaluacion se publica cuando ambas partes hayan evaluado.</p>
                  <div className="mt-3 flex gap-1" aria-label="Evaluacion de 1 a 5 estrellas">
                    {[1, 2, 3, 4, 5].map((score) => <button key={score} onClick={() => setScores((current) => ({...current, [match.id]: score}))} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white" aria-label={`${score} estrellas`}><Star size={24} className={score <= (scores[match.id] || 0) ? "fill-amber-400 text-amber-400" : "text-gray-300"} /></button>)}
                  </div>
                  <button disabled={Boolean(busy) || !scores[match.id]} aria-busy={busy === `review-${match.id}`} onClick={() => submitReview(match.id)} className="mt-3 min-h-11 w-full rounded-xl bg-blue-950 text-sm font-bold text-white disabled:opacity-50">{busy === `review-${match.id}` ? "Enviando evaluacion..." : "Enviar evaluacion"}</button>
                </div>
              )}
              {reviewStates[match.id] === "reviewed" && <div role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">Evaluacion registrada.</div>}
            </article>
          );
        })}
        {matches.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-gray-500">Todavia no hay matches para esta empresa.</div>}
      </div>
    </section>
  );
};

export default CompanyMatches;
