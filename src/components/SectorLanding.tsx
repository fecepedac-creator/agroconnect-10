import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  BusFront,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import {SECTOR_EXPERIENCES, sectorQuery, type EmploymentSector} from "../sectorExperience";

type Props = {
  sector: EmploymentSector;
};

const previewJobs = {
  agriculture: [
    { title: "Cosecha de temporada", location: "San Javier", detail: "Transporte desde Plaza de Armas · 06:10" },
    { title: "Operario de packing", location: "Talca", detail: "Turno día · Colación incluida" },
  ],
  security: [
    { title: "Guardia de instalación", location: "Talca", detail: "Turno 4x4 · OS10 vigente" },
    { title: "Control de acceso", location: "San Clemente", detail: "Turno día · Lunes a viernes" },
  ],
};

export default function SectorLanding({sector}: Props) {
  const experience = SECTOR_EXPERIENCES[sector];
  const isAgriculture = sector === "agriculture";
  const jobsUrl = `/trabajos${sectorQuery(sector)}`;

  const go = (to: string) => window.location.assign(to);

  return (
    <div
      className={[
        "min-h-screen text-slate-950",
        isAgriculture ? "bg-[#f5f0e5]" : "bg-[#eef3f7]",
      ].join(" ")}
    >
      <header className="relative z-20 border-b border-white/15 bg-slate-950/90 text-white backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <button className="flex items-center gap-3 text-left" onClick={() => go(`/${isAgriculture ? "agro" : "seguridad"}`)}>
            <span className={[
              "flex h-11 w-11 items-center justify-center rounded-2xl",
              isAgriculture ? "bg-lime-300 text-emerald-950" : "bg-amber-300 text-slate-950",
            ].join(" ")}>
              {isAgriculture ? <Sprout size={25} /> : <ShieldCheck size={25} />}
            </span>
            <span>
              <span className="block text-xl font-black tracking-tight">{experience.brand}</span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
                Una plataforma de MundoConnect
              </span>
            </span>
          </button>
          <button
            onClick={() => go(jobsUrl)}
            className="min-h-12 rounded-full border border-white/20 px-5 text-sm font-extrabold text-white transition hover:bg-white/10"
          >
            Ingresar
          </button>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-slate-950 text-white">
          <div
            className="absolute inset-0 -z-20 bg-cover bg-center opacity-55"
            style={{backgroundImage: `url(${isAgriculture ? "/bg-left.jpg" : "/bg-right.jpg"})`}}
          />
          <div className={[
            "absolute inset-0 -z-10",
            isAgriculture
              ? "bg-gradient-to-r from-emerald-950 via-emerald-950/90 to-emerald-900/25"
              : "bg-gradient-to-r from-slate-950 via-slate-950/90 to-blue-950/30",
          ].join(" ")} />
          <div className="mx-auto grid min-h-[650px] max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <div className={[
                "mb-7 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.16em]",
                isAgriculture
                  ? "border-lime-200/30 bg-lime-200/10 text-lime-200"
                  : "border-amber-200/30 bg-amber-200/10 text-amber-200",
              ].join(" ")}>
                {isAgriculture ? <Sprout size={16} /> : <ShieldCheck size={16} />}
                {experience.eyebrow}
              </div>
              <h1 className="max-w-3xl text-4xl font-black leading-[1.03] tracking-[-0.04em] sm:text-5xl lg:text-7xl">
                {experience.headline}
              </h1>
              <p className="mt-7 max-w-2xl text-lg font-medium leading-relaxed text-white/72 sm:text-xl">
                {experience.description}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => go(jobsUrl)}
                  className={[
                    "inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl px-7 text-base font-black shadow-xl transition hover:-translate-y-0.5",
                    isAgriculture
                      ? "bg-lime-300 text-emerald-950 hover:bg-lime-200"
                      : "bg-amber-300 text-slate-950 hover:bg-amber-200",
                  ].join(" ")}
                >
                  {experience.workerCta} <ArrowRight size={20} />
                </button>
                <button
                  onClick={() => go("/portal-empresas")}
                  className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-white/25 bg-white/5 px-7 text-base font-extrabold text-white backdrop-blur transition hover:bg-white/10"
                >
                  <Building2 size={20} /> {experience.companyCta}
                </button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-white/65">
                <span className="flex items-center gap-2"><CheckCircle2 size={18} /> Registro gratuito</span>
                <span className="flex items-center gap-2"><BadgeCheck size={18} /> Condiciones visibles</span>
                <span className="flex items-center gap-2"><MapPin size={18} /> Oportunidades cercanas</span>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-white/50">Así verás las ofertas</p>
                  <h2 className="mt-1 text-xl font-black">Información importante primero</h2>
                </div>
                <BriefcaseBusiness className={isAgriculture ? "text-lime-300" : "text-amber-300"} />
              </div>
              <div className="space-y-3">
                {previewJobs[sector].map((job) => (
                  <article key={job.title} className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black">{job.title}</h3>
                        <p className="mt-2 flex items-center gap-2 text-sm font-bold text-white/60">
                          <MapPin size={16} /> {job.location}
                        </p>
                      </div>
                      <span className={[
                        "rounded-full px-3 py-1 text-[11px] font-black uppercase",
                        isAgriculture ? "bg-lime-300 text-emerald-950" : "bg-amber-300 text-slate-950",
                      ].join(" ")}>
                        Disponible
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/7 px-3 py-3 text-sm font-bold text-white/75">
                      {isAgriculture ? <BusFront size={18} /> : <Clock3 size={18} />}
                      {job.detail}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
          <div className="mb-10 max-w-2xl">
            <p className={[
              "text-xs font-black uppercase tracking-[0.18em]",
              isAgriculture ? "text-emerald-700" : "text-blue-800",
            ].join(" ")}>Simple desde el primer momento</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Solo mostramos lo que necesitas para decidir.</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {experience.highlights.map((highlight, index) => (
              <article key={highlight.title} className="rounded-3xl border border-black/5 bg-white p-7 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
                <span className={[
                  "flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-black",
                  isAgriculture ? "bg-emerald-950 text-lime-300" : "bg-slate-950 text-amber-300",
                ].join(" ")}>0{index + 1}</span>
                <h3 className="mt-6 text-xl font-black">{highlight.title}</h3>
                <p className="mt-3 text-base font-medium leading-relaxed text-slate-600">{highlight.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>{experience.brand} · Trabajo cerca, sin complicaciones.</span>
          <span>Misma cuenta y tecnología de MundoConnect.</span>
        </div>
      </footer>
    </div>
  );
}
