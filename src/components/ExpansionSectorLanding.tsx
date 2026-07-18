import {ArrowLeft, ArrowRight, BadgeCheck, Building2, CheckCircle2, Clock3, MapPin, ShieldCheck} from "lucide-react";
import type {ExpansionSector} from "../expansionSectors";
import ExpansionSectorIcon from "./ExpansionSectorIcon";

type Props = {sector: ExpansionSector};
const go = (path: string) => window.location.assign(path);

export default function ExpansionSectorLanding({sector}: Props) {
  return (
    <div className="min-h-screen bg-[#f4f1e8] text-slate-950">
      <header className="border-b border-white/10 bg-slate-950 text-white">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <button onClick={() => go("/")} className="flex items-center gap-3 text-left">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-300 text-emerald-950"><ArrowLeft size={22} /></span>
            <span><span className="block text-lg font-black">Mundo<span className="text-lime-300">Connect</span></span><span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Volver a todas las áreas</span></span>
          </button>
          <button onClick={() => go("/portal-empresas")} className="min-h-11 rounded-full border border-white/20 px-4 text-sm font-extrabold hover:bg-white/10">Acceso empresas</button>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="relative isolate overflow-hidden text-white" style={{background: sector.gradient}}>
          <div className="absolute -right-24 top-12 -z-10 h-[28rem] w-[28rem] rounded-full blur-3xl" style={{background: sector.glow}} />
          <div className="absolute inset-0 -z-10 opacity-[0.08]" style={{backgroundImage: "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)", backgroundSize: "42px 42px"}} />
          <div className="mx-auto grid min-h-[650px] max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.12fr_0.88fr] lg:px-8 lg:py-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em]"><Clock3 size={16} /> Área en preparación</div>
              <div className="mt-8 flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{background: sector.accent, color: sector.accentText}}><ExpansionSectorIcon name={sector.icon} size={28} /></span>
                <div><p className="text-xs font-black uppercase tracking-[0.16em] text-white/50">Una plataforma de MundoConnect</p><p className="text-2xl font-black">{sector.brand}</p></div>
              </div>
              <p className="mt-8 text-xs font-black uppercase tracking-[0.18em]" style={{color: sector.accent}}>{sector.eyebrow}</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-black leading-[1.04] tracking-[-0.04em] sm:text-5xl lg:text-6xl">{sector.headline}</h1>
              <p className="mt-6 max-w-2xl text-lg font-medium leading-relaxed text-white/70">{sector.description}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button onClick={() => go("/portal-empresas")} className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl px-7 font-black shadow-xl" style={{background: sector.accent, color: sector.accentText}}><Building2 size={20} /> Participar como empresa</button>
                <button onClick={() => go("/")} className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white/5 px-7 font-black">Explorar MundoConnect <ArrowRight size={20} /></button>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-white/15 bg-slate-950/45 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">Oportunidades consideradas</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {sector.roles.map((role) => <div key={role} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/7 p-4 font-extrabold"><CheckCircle2 size={19} style={{color: sector.accent}} /> {role}</div>)}
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/7 p-5"><p className="flex items-center gap-2 text-sm font-black"><BadgeCheck size={19} style={{color: sector.accent}} /> Requisito de confianza</p><p className="mt-3 text-sm font-medium leading-relaxed text-white/60">{sector.credentialNote}</p></div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
          <div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">La empresa informa, la persona decide</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Lo importante debe verse antes de postular.</h2></div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <article className="rounded-3xl bg-white p-7 shadow-[0_18px_55px_rgba(15,23,42,0.08)]"><MapPin className="text-emerald-800" size={27} /><h3 className="mt-6 text-xl font-black">Lugar y traslado</h3><p className="mt-3 font-medium leading-relaxed text-slate-600">Ubicación exacta, punto de encuentro y transporte cuando corresponda.</p></article>
            <article className="rounded-3xl bg-white p-7 shadow-[0_18px_55px_rgba(15,23,42,0.08)]"><Clock3 className="text-emerald-800" size={27} /><h3 className="mt-6 text-xl font-black">Jornada y duración</h3><p className="mt-3 font-medium leading-relaxed text-slate-600">Turno, fechas, remuneración y condiciones informadas por la empresa.</p></article>
            <article className="rounded-3xl bg-white p-7 shadow-[0_18px_55px_rgba(15,23,42,0.08)]"><ShieldCheck className="text-emerald-800" size={27} /><h3 className="mt-6 text-xl font-black">Requisitos verificables</h3><p className="mt-3 font-medium leading-relaxed text-slate-600">{sector.companyFocus}</p></article>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 text-white"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm font-semibold text-white/45 sm:flex-row sm:items-center sm:justify-between lg:px-8"><span>{sector.brand} · En preparación.</span><span>Misma cuenta y sistema de confianza MundoConnect.</span></div></footer>
    </div>
  );
}
