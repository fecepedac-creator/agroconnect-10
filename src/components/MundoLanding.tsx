import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Construction,
  Handshake,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  Sprout,
  Truck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";

const sectors = [
  {
    name: "AgroConnect",
    description: "Trabajo agrícola con condiciones, ubicación y transporte informados por cada empresa.",
    href: "/agro",
    image: "/bg-left.jpg",
    accent: "bg-lime-300 text-emerald-950",
    icon: Sprout,
  },
  {
    name: "SeguridadConnect",
    description: "Oportunidades de seguridad, control de acceso y turnos cerca de cada trabajador.",
    href: "/seguridad",
    image: "/bg-right.jpg",
    accent: "bg-amber-300 text-slate-950",
    icon: ShieldCheck,
  },
];

const steps = [
  {title: "Crea un perfil simple", text: "Registra lo esencial una vez y usa la misma cuenta en distintos sectores.", icon: UserRoundCheck},
  {title: "Encuentra oportunidades", text: "Revisa trabajos cercanos y las condiciones publicadas por cada empresa.", icon: MapPin},
  {title: "Ambos muestran interés", text: "Cuando trabajador y empresa coinciden, habilitamos el contacto de forma protegida.", icon: Handshake},
];

const go = (path: string) => window.location.assign(path);

export default function MundoLanding() {
  return (
    <div className="min-h-screen bg-[#f3efe5] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <button className="flex items-center gap-3 text-left" onClick={() => go("/")}>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-300 text-emerald-950"><UsersRound size={24} /></span>
            <span>
              <span className="block text-xl font-black tracking-tight">Mundo<span className="text-lime-300">Connect</span></span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Personas y oportunidades</span>
            </span>
          </button>
          <nav className="hidden items-center gap-7 text-sm font-bold text-white/70 md:flex" aria-label="Navegación principal">
            <a className="transition hover:text-white" href="#plataformas">Plataformas</a>
            <a className="transition hover:text-white" href="#como-funciona">Como funciona</a>
            <a className="transition hover:text-white" href="#nosotros">Nosotros</a>
          </nav>
          <button onClick={() => go("/acceso")} className="min-h-11 rounded-full border border-white/20 px-4 text-sm font-extrabold transition hover:bg-white/10 sm:px-5">
            Acceso empresas
          </button>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0 -z-30 grid grid-cols-2">
            <div className="bg-cover bg-center opacity-45" style={{backgroundImage: "url(/bg-left.jpg)"}} />
            <div className="bg-cover bg-center opacity-35" style={{backgroundImage: "url(/bg-right.jpg)"}} />
          </div>
          <div className="absolute inset-0 -z-20 bg-gradient-to-r from-slate-950 via-slate-950/95 to-emerald-950/70" />
          <div className="absolute -right-32 top-24 -z-10 h-96 w-96 rounded-full bg-lime-300/15 blur-3xl" />
          <div className="mx-auto grid min-h-[690px] max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-lime-200/25 bg-lime-200/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-lime-200">
                <MapPin size={16} /> Nacimos en el Maule para conectar Chile
              </div>
              <h1 className="text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-7xl">
                El trabajo correcto puede estar más cerca de lo que imaginas.
              </h1>
              <p className="mt-7 max-w-2xl text-lg font-medium leading-relaxed text-white/72 sm:text-xl">
                MundoConnect une personas con oportunidades reales en su zona. Una cuenta simple, distintos sectores y contacto solo cuando existe interés mutuo.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href="#plataformas" className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-lime-300 px-7 text-base font-black text-emerald-950 shadow-xl transition hover:-translate-y-0.5 hover:bg-lime-200">
                  Quiero encontrar trabajo <ArrowRight size={20} />
                </a>
                <button onClick={() => go("/acceso")} className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-white/25 bg-white/5 px-7 text-base font-extrabold text-white backdrop-blur transition hover:bg-white/10">
                  <Building2 size={20} /> Soy empresa
                </button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-white/65">
                <span className="flex items-center gap-2"><CheckCircle2 size={18} /> Gratis para trabajadores</span>
                <span className="flex items-center gap-2"><BadgeCheck size={18} /> Información clara</span>
                <span className="flex items-center gap-2"><HeartHandshake size={18} /> Interés de ambas partes</span>
              </div>
            </div>
            <div className="rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-lime-200">Una red, varias puertas</p>
              <h2 className="mt-2 text-2xl font-black">Tu perfil crece contigo.</h2>
              <p className="mt-3 font-medium leading-relaxed text-white/65">Experiencia, evaluaciones y credenciales pueden acompañar al trabajador aunque cambie de sector.</p>
              <div className="mt-6 space-y-3">
                {sectors.map(({name, icon: Icon, accent}) => (
                  <div key={name} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/65 p-4">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}><Icon size={22} /></span>
                    <div><p className="font-black">{name}</p><p className="text-sm font-semibold text-white/50">Misma cuenta MundoConnect</p></div>
                    <CheckCircle2 className="ml-auto shrink-0 text-lime-300" size={20} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="plataformas" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Elige tu camino</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Una experiencia pensada para cada sector.</h2>
            </div>
            <p className="max-w-md text-base font-semibold leading-relaxed text-slate-600">Entra directamente al área que te interesa. No necesitas conocer todo MundoConnect para comenzar.</p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {sectors.map(({name, description, href, image, accent, icon: Icon}) => (
              <article key={name} className="group relative isolate min-h-[390px] overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-[0_22px_70px_rgba(15,23,42,0.18)] sm:p-9">
                <div className="absolute inset-0 -z-20 bg-cover bg-center transition duration-700 group-hover:scale-105" style={{backgroundImage: `url(${image})`}} />
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950 via-slate-950/85 to-slate-950/20" />
                <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${accent}`}><Icon size={28} /></span>
                <div className="absolute inset-x-7 bottom-7 sm:inset-x-9 sm:bottom-9">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">Una plataforma de MundoConnect</p>
                  <h3 className="mt-2 text-3xl font-black">{name}</h3>
                  <p className="mt-3 max-w-lg font-medium leading-relaxed text-white/70">{description}</p>
                  <button onClick={() => go(href)} className="mt-6 inline-flex items-center gap-2 text-base font-black text-white">Visitar {name} <ArrowRight className="transition group-hover:translate-x-1" size={19} /></button>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              {name: "ConstrucciónConnect", icon: Construction},
              {name: "TransporteConnect", icon: Truck},
            ].map(({name, icon: Icon}) => (
              <div key={name} className="flex items-center gap-4 rounded-3xl border border-slate-900/8 bg-white/65 p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200 text-slate-700"><Icon size={23} /></span>
                <div><p className="font-black text-slate-800">{name}</p><p className="mt-1 text-sm font-bold text-slate-500">Proximamente</p></div>
              </div>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-24 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Sin complicaciones</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-5xl">Tres pasos que cualquiera puede entender.</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {steps.map(({title, text, icon: Icon}, index) => (
                <article key={title} className="rounded-3xl border border-slate-900/7 bg-[#f7f4ec] p-7">
                  <div className="flex items-center justify-between"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-950 text-lime-300"><Icon size={23} /></span><span className="text-sm font-black text-slate-300">0{index + 1}</span></div>
                  <h3 className="mt-7 text-xl font-black">{title}</h3><p className="mt-3 font-medium leading-relaxed text-slate-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="nosotros" className="scroll-mt-24 bg-emerald-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-2 lg:px-8 lg:py-24">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-300">Nuestra historia</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Tecnología cercana, nacida desde una necesidad real.</h2>
              <p className="mt-6 text-lg font-medium leading-relaxed text-white/70">MundoConnect nace en la Región del Maule al observar una dificultad cotidiana: trabajadores disponibles y empresas que necesitan personas, pero que muchas veces no logran encontrarse a tiempo.</p>
              <p className="mt-4 text-lg font-medium leading-relaxed text-white/70">Comenzamos por agricultura y seguridad para construir una solución simple, territorial y útil antes de crecer hacia nuevos rubros.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <article className="rounded-3xl border border-white/10 bg-white/7 p-7"><BriefcaseBusiness className="text-lime-300" size={29} /><h3 className="mt-6 text-xl font-black">Nuestra misión</h3><p className="mt-3 font-medium leading-relaxed text-white/65">Acercar oportunidades laborales reales mediante una experiencia digital clara y humana.</p></article>
              <article className="rounded-3xl border border-white/10 bg-white/7 p-7"><UsersRound className="text-lime-300" size={29} /><h3 className="mt-6 text-xl font-black">Nuestra visión</h3><p className="mt-3 font-medium leading-relaxed text-white/65">Ser la red de confianza que conecte trabajadores, empresas y territorios en los sectores que mueven Chile.</p></article>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
          <div className="rounded-[2rem] border border-slate-900/8 bg-white p-7 shadow-[0_20px_70px_rgba(15,23,42,0.08)] sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-12">
            <div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Confianza que se demuestra</p><h2 className="mt-3 text-3xl font-black tracking-tight">Construyendo nuestra primera red en el Maule.</h2><p className="mt-4 font-medium leading-relaxed text-slate-600">Estamos preparando el piloto junto a trabajadores y empresas de la zona. Publicaremos organizaciones participantes y resultados solo cuando puedan ser verificados.</p></div>
            <button onClick={() => go("/acceso")} className="mt-7 inline-flex min-h-14 shrink-0 items-center justify-center gap-3 rounded-2xl bg-slate-950 px-7 font-black text-white transition hover:bg-emerald-950 lg:mt-0">Incorporar mi empresa <ArrowRight size={20} /></button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-9 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div><p className="text-lg font-black">Mundo<span className="text-lime-300">Connect</span></p><p className="mt-1 text-sm font-semibold text-white/45">Personas y oportunidades, más cerca.</p></div>
          <p className="max-w-xl text-sm font-medium leading-relaxed text-white/45">MundoConnect facilita el encuentro entre trabajadores y empresas. No actúa como empleador ni celebra contratos laborales por cuenta de sus usuarios.</p>
        </div>
      </footer>
    </div>
  );
}
