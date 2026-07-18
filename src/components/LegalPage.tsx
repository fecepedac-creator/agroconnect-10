import {ArrowLeft, FileCheck2, ShieldCheck} from "lucide-react";
import {LEGAL_DOCUMENTS, LEGAL_OPERATOR, LEGAL_VERSION} from "../legalContent";

type Props = {document: "terms" | "privacy"};

export default function LegalPage({document}: Props) {
  const isTerms = document === "terms";
  const content = LEGAL_DOCUMENTS[document];

  return (
    <div className="min-h-screen bg-[#f4f1e8] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-20 max-w-4xl items-center justify-between px-5">
          <button onClick={() => window.history.back()} className="flex min-h-11 items-center gap-2 font-black text-emerald-900">
            <ArrowLeft size={19} /> Volver
          </button>
          <span className="text-sm font-black">MundoConnect</span>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950 text-lime-300">
          {isTerms ? <FileCheck2 size={28} /> : <ShieldCheck size={28} />}
        </div>
        <p className="mt-7 text-xs font-black uppercase tracking-[0.16em] text-emerald-800">Versión {LEGAL_VERSION}</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{content.title}</h1>
        <p className="mt-5 text-lg font-semibold leading-relaxed text-slate-600">{content.summary}</p>

        <div className="mt-10 space-y-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          {isTerms ? (
            <>
              <section><h2 className="text-xl font-black">1. Naturaleza del servicio</h2><p className="mt-3 leading-relaxed text-slate-700">MundoConnect es una plataforma de intermediación tecnológica. La empresa publica la oportunidad, define remuneración, jornada, traslado y requisitos, selecciona a las personas y celebra directamente cualquier contrato laboral.</p></section>
              <section><h2 className="text-xl font-black">2. Decisión de las partes</h2><p className="mt-3 leading-relaxed text-slate-700">La persona decide si manifiesta interés. La empresa decide si también está interesada. Los datos de contacto se revelan solamente según el consentimiento y las reglas del match.</p></section>
              <section><h2 className="text-xl font-black">3. Conductas prohibidas</h2><p className="mt-3 leading-relaxed text-slate-700">No se permiten ofertas falsas, cobros al trabajador, discriminación, suplantación, extracción masiva de datos ni uso de información para finalidades ajenas a una oportunidad laboral legítima.</p></section>
              <section><h2 className="text-xl font-black">4. Suspensión y denuncias</h2><p className="mt-3 leading-relaxed text-slate-700">MundoConnect puede suspender preventivamente cuentas u ofertas ante indicios de fraude o riesgo. La persona afectada puede solicitar revisión mediante el canal de soporte.</p></section>
              <section><h2 className="text-xl font-black">5. Responsabilidades</h2><p className="mt-3 leading-relaxed text-slate-700">La empresa es responsable de verificar antecedentes necesarios, cumplir la legislación laboral, pagar remuneraciones y proporcionar condiciones seguras. MundoConnect no controla jornada ni ejecución del trabajo.</p></section>
            </>
          ) : (
            <>
              <section><h2 className="text-xl font-black">1. Información tratada</h2><p className="mt-3 leading-relaxed text-slate-700">Cuenta, nombre, comuna, experiencia, disponibilidad, preferencias de traslado, datos de contacto y antecedentes que la persona decida aportar. No mostramos públicamente RUT, teléfono, correo, dirección exacta ni documentos.</p></section>
              <section><h2 className="text-xl font-black">2. Finalidades</h2><p className="mt-3 leading-relaxed text-slate-700">Crear y administrar el perfil, mostrar ofertas compatibles, prevenir fraude, registrar decisiones de match, entregar soporte y cumplir obligaciones legales.</p></section>
              <section><h2 className="text-xl font-black">3. Consentimientos separados</h2><p className="mt-3 leading-relaxed text-slate-700">Aceptar los términos no autoriza marketing. Las comunicaciones promocionales son opcionales y pueden desactivarse. Las comunicaciones necesarias para operar una postulación o match se registran por separado.</p></section>
              <section><h2 className="text-xl font-black">4. Acceso y contacto</h2><p className="mt-3 leading-relaxed text-slate-700">Las empresas verificadas reciben una vista limitada para buscar compatibilidad. El contacto completo se entrega únicamente cuando el flujo autorizado lo permite.</p></section>
              <section><h2 className="text-xl font-black">5. Derechos</h2><p className="mt-3 leading-relaxed text-slate-700">Puedes solicitar acceso, corrección, oposición, portabilidad cuando corresponda y eliminación. Mientras una solicitud se procesa, el perfil puede ocultarse para detener nuevos contactos.</p></section>
            </>
          )}
        </div>

        <aside className="mt-8 rounded-3xl bg-slate-950 p-6 text-white">
          <h2 className="font-black">Responsable y contacto</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70">{LEGAL_OPERATOR.name} · RUT {LEGAL_OPERATOR.rut} · {LEGAL_OPERATOR.address}</p>
          <a className="mt-3 inline-block font-black text-lime-300 underline" href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>
        </aside>
      </main>
    </div>
  );
}
