import React, {useState} from "react";
import {FiEye, FiEyeOff} from "react-icons/fi";
import {
  loginWorker,
  registerWorker,
  sendWorkerPasswordReset,
  signInWorkerWithGoogle,
} from "../services/workerAuth";
import {SECTOR_EXPERIENCES, type EmploymentSector} from "../sectorExperience";
import {LEGAL_VERSION} from "../legalContent";

type Props = {
  onSuccess: () => void;
  onBack?: () => void;
  initialMode?: "login" | "register";
  sector?: EmploymentSector;
};

type Mobility = "needs_transport" | "public_transport" | "own_transport";

export default function WorkerAuthScreen({
  onSuccess,
  onBack,
  initialMode = "login",
  sector = "agriculture",
}: Props) {
  const experience = SECTOR_EXPERIENCES[sector];
  const isAgriculture = sector === "agriculture";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [registerStep, setRegisterStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [commune, setCommune] = useState("");
  const [primaryTrade, setPrimaryTrade] = useState("");
  const [sectors, setSectors] = useState<EmploymentSector[]>([sector]);
  const [phone, setPhone] = useState("");
  const [mobility, setMobility] = useState<Mobility>(isAgriculture ? "needs_transport" : "public_transport");
  const [terms, setTerms] = useState(false);
  const [matchingConsent, setMatchingConsent] = useState(false);
  const [operationalMessages, setOperationalMessages] = useState(false);
  const [marketing, setMarketing] = useState(false);

  React.useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const inputClass = "w-full min-h-12 rounded-xl border border-gray-300 px-4 text-base outline-none transition focus:ring-2 focus:ring-emerald-300";

  const changeMode = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setRegisterStep(1);
    setError(null);
    setSuccess(null);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())) {
      setError("Ingresa un correo válido.");
      return;
    }

    setLoading(true);
    try {
      await loginWorker(identifier, password);
      onSuccess();
    } catch (loginError: any) {
      setError(loginError?.message || "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setError(null);
    setSuccess(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())) {
      setError("Escribe tu correo para recuperar la clave.");
      return;
    }

    try {
      const usedEmail = await sendWorkerPasswordReset(identifier);
      setSuccess(`Enviamos las instrucciones a ${usedEmail}.`);
    } catch (resetError: any) {
      setError(resetError?.message || "No se pudo enviar el correo.");
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await signInWorkerWithGoogle();
      onSuccess();
    } catch (googleError: any) {
      setError(googleError?.message || "No se pudo continuar con Google.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSector = (value: EmploymentSector) => {
    setSectors((current) => (
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    ));
  };

  const validateCurrentStep = () => {
    setError(null);

    if (registerStep === 1) {
      if (!fullName.trim() || !email.trim() || !pass1 || !pass2) {
        setError("Completa tu nombre, correo y contraseña.");
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError("Ingresa un correo válido.");
        return false;
      }
      if (pass1.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres.");
        return false;
      }
      if (pass1 !== pass2) {
        setError("Las contraseñas no coinciden.");
        return false;
      }
    }

    if (registerStep === 2) {
      if (!commune.trim() || !primaryTrade.trim()) {
        setError("Indica tu comuna y el trabajo que sabes hacer.");
        return false;
      }
      if (sectors.length === 0) {
        setError("Selecciona al menos un tipo de trabajo.");
        return false;
      }
    }

    if (registerStep === 3) {
      if (phone.trim() && phone.trim().length !== 8) {
        setError("El teléfono debe tener 8 dígitos.");
        return false;
      }
      if (!terms || !matchingConsent) {
        setError("Debes aceptar los términos y autorizar el uso del perfil para buscar oportunidades.");
        return false;
      }
    }

    return true;
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateCurrentStep()) return;

    if (registerStep < 3) {
      setRegisterStep((step) => step + 1);
      return;
    }

    setLoading(true);
    try {
      await registerWorker({
        fullName,
        email,
        password: pass1,
        phone,
        commune,
        primaryTrade,
        sectors,
        mobility,
        consent: {
          version: LEGAL_VERSION,
          matching: true,
          operationalMessages,
          marketing,
        },
      });
      onSuccess();
    } catch (registerError: any) {
      const code = String(registerError?.code || "");
      if (code.includes("email-already-in-use")) {
        setError("Este correo ya está registrado. Puedes ingresar o recuperar tu clave.");
        setIdentifier(email.trim().toLowerCase());
      } else {
        setError(registerError?.message || "No se pudo crear la cuenta.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={[
      "min-h-screen flex items-center justify-center p-4 sm:p-6",
      isAgriculture ? "bg-emerald-50" : "bg-slate-100",
    ].join(" ")}>
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl">
        <header className="border-b border-gray-100 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className={[
                "text-2xl font-black tracking-tight",
                isAgriculture ? "text-emerald-900" : "text-blue-950",
              ].join(" ")}>{experience.brand}</div>
              <div className="mt-1 text-xs font-bold uppercase tracking-wider text-gray-500">
                Una plataforma de MundoConnect
              </div>
            </div>
            {onBack && <button onClick={onBack} className="min-h-11 px-3 text-sm font-bold text-gray-600">Volver</button>}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
            <button
              onClick={() => changeMode("login")}
              className={`min-h-11 rounded-xl text-sm font-extrabold ${mode === "login" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
            >
              Ya tengo cuenta
            </button>
            <button
              onClick={() => changeMode("register")}
              className={`min-h-11 rounded-xl text-sm font-extrabold ${mode === "register" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
            >
              Crear cuenta
            </button>
          </div>
        </header>

        <div className="p-6">
          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h1 className="text-2xl font-black text-gray-900">Ingresa a tus oportunidades</h1>
                <p className="mt-2 text-base text-gray-600">Usa tu correo o continúa con Google.</p>
              </div>
              <input value={identifier} onChange={(event) => setIdentifier(event.target.value.toLowerCase())} className={inputClass} type="email" autoComplete="email" placeholder="Tu correo" aria-label="Correo" />
              <div className="relative">
                <input value={password} onChange={(event) => setPassword(event.target.value)} className={`${inputClass} pr-12`} type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Tu contraseña" aria-label="Contraseña" />
                <button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-500">
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              <button type="button" onClick={handlePasswordReset} className="min-h-11 text-sm font-bold text-emerald-800">Olvidé mi clave</button>
              <button disabled={loading} className="min-h-14 w-full rounded-2xl bg-emerald-700 text-base font-black text-white disabled:opacity-60">
                {loading ? "Ingresando..." : "Ingresar"}
              </button>
              <button type="button" onClick={handleGoogle} disabled={loading} className="min-h-14 w-full rounded-2xl border border-gray-300 bg-white text-base font-black text-gray-800 disabled:opacity-60">
                Continuar con Google
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <div className="flex items-center justify-between text-sm font-bold text-gray-500">
                  <span>Paso {registerStep} de 3</span>
                  <span>{registerStep === 1 ? "Tu cuenta" : registerStep === 2 ? "Tu trabajo" : "Tu movilidad"}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((step) => <span key={step} className={`h-2 rounded-full ${step <= registerStep ? "bg-emerald-600" : "bg-gray-200"}`} />)}
                </div>
              </div>

              {registerStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-2xl font-black text-gray-900">Crea tu cuenta gratuita</h1>
                    <p className="mt-2 text-base text-gray-600">No necesitas currículum para comenzar.</p>
                  </div>
                  <button type="button" onClick={handleGoogle} disabled={loading} className="min-h-14 w-full rounded-2xl border border-gray-300 bg-white text-base font-black text-gray-800">
                    Continuar con Google
                  </button>
                  <div className="text-center text-sm font-bold text-gray-400">o usa tu correo</div>
                  <input value={fullName} onChange={(event) => setFullName(event.target.value.replace(/[^\p{L}\p{M}\s'-]/gu, ""))} className={inputClass} autoComplete="name" placeholder="Nombre y apellido" aria-label="Nombre y apellido" />
                  <input value={email} onChange={(event) => setEmail(event.target.value.toLowerCase())} className={inputClass} type="email" autoComplete="email" placeholder="Correo" aria-label="Correo" />
                  <div className="relative">
                    <input value={pass1} onChange={(event) => setPass1(event.target.value)} className={`${inputClass} pr-12`} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Crea una contraseña" aria-label="Crear contraseña" />
                    <button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-500">
                      {showPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  <input value={pass2} onChange={(event) => setPass2(event.target.value)} className={inputClass} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Repite la contraseña" aria-label="Repetir contraseña" />
                </div>
              )}

              {registerStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-2xl font-black text-gray-900">¿Qué trabajo buscas?</h1>
                    <p className="mt-2 text-base text-gray-600">Esto nos permite mostrar oportunidades útiles.</p>
                  </div>
                  <input value={commune} onChange={(event) => setCommune(event.target.value)} className={inputClass} autoComplete="address-level2" placeholder="Comuna donde vives" aria-label="Comuna" />
                  <input value={primaryTrade} onChange={(event) => setPrimaryTrade(event.target.value)} className={inputClass} placeholder={isAgriculture ? "Ejemplo: poda, cosecha o packing" : "Ejemplo: guardia o control de acceso"} aria-label="Trabajo principal" />
                  <fieldset>
                    <legend className="mb-3 text-base font-black text-gray-900">También me interesan</legend>
                    <div className="grid grid-cols-2 gap-3">
                      {(["agriculture", "security"] as EmploymentSector[]).map((item) => (
                        <button key={item} type="button" onClick={() => toggleSector(item)} className={`min-h-14 rounded-2xl border-2 text-sm font-black ${sectors.includes(item) ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-gray-200 text-gray-600"}`}>
                          {item === "agriculture" ? "Agricultura" : "Seguridad"}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}

              {registerStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-2xl font-black text-gray-900">¿Cómo puedes trasladarte?</h1>
                    <p className="mt-2 text-base text-gray-600">Usaremos esta información para mejorar las recomendaciones.</p>
                  </div>
                  <div className="grid gap-3">
                    {([
                      ["needs_transport", "Necesito transporte"],
                      ["public_transport", "Uso locomoción pública"],
                      ["own_transport", "Tengo transporte propio"],
                    ] as Array<[Mobility, string]>).map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setMobility(value)} className={`min-h-14 rounded-2xl border-2 px-4 text-left text-base font-black ${mobility === value ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-gray-200 text-gray-700"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <span className="flex min-h-12 items-center rounded-xl border border-gray-300 bg-gray-50 px-3 text-sm font-bold text-gray-500">+569</span>
                    <input value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^0-9]/g, ""))} className={inputClass} maxLength={8} inputMode="numeric" autoComplete="tel" placeholder="Teléfono (opcional)" aria-label="Teléfono" />
                  </div>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-gray-700">
                    MundoConnect no es tu empleador. La empresa que contrata es responsable del trabajo y del pago. Tus datos solo se comparten para oportunidades laborales.
                  </div>
                  <label className="flex min-h-12 items-start gap-3 text-base font-bold text-gray-800">
                    <input aria-label="Acepto términos y privacidad" type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-1 h-5 w-5 accent-emerald-600" />
                    <span>Acepto los <a className="text-emerald-800 underline" href="/legal/terminos" target="_blank" rel="noreferrer">términos</a> y la <a className="text-emerald-800 underline" href="/legal/privacidad" target="_blank" rel="noreferrer">política de privacidad</a>.</span>
                  </label>
                  <label className="flex min-h-12 items-start gap-3 text-base font-bold text-gray-800">
                    <input aria-label="Autorizo matching laboral" type="checkbox" checked={matchingConsent} onChange={(event) => setMatchingConsent(event.target.checked)} className="mt-1 h-5 w-5 accent-emerald-600" />
                    <span>Autorizo que mi perfil laboral limitado sea considerado para oportunidades. Mi contacto seguirá oculto hasta el flujo autorizado.</span>
                  </label>
                  <label className="flex min-h-12 items-start gap-3 text-sm font-semibold text-gray-700">
                    <input aria-label="Acepto mensajes operativos" type="checkbox" checked={operationalMessages} onChange={(event) => setOperationalMessages(event.target.checked)} className="mt-1 h-5 w-5 accent-emerald-600" />
                    <span>Quiero recibir avisos operativos sobre postulaciones y matches por los canales informados.</span>
                  </label>
                  <label className="flex min-h-12 items-start gap-3 text-sm font-semibold text-gray-700">
                    <input aria-label="Acepto marketing" type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} className="mt-1 h-5 w-5 accent-emerald-600" />
                    <span>Quiero recibir novedades y campañas de MundoConnect. Esto es opcional.</span>
                  </label>
                  <p className="text-sm text-gray-500">Podrás verificar tu RUT posteriormente desde tu perfil.</p>
                </div>
              )}

              <div className="flex gap-3">
                {registerStep > 1 && <button type="button" onClick={() => { setError(null); setRegisterStep((step) => step - 1); }} className="min-h-14 flex-1 rounded-2xl border border-gray-300 text-base font-black text-gray-700">Volver</button>}
                <button disabled={loading} className="min-h-14 flex-1 rounded-2xl bg-emerald-700 px-5 text-base font-black text-white disabled:opacity-60">
                  {loading ? "Creando..." : registerStep === 3 ? "Crear mi cuenta" : "Continuar"}
                </button>
              </div>
            </form>
          )}

          {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}
          {success && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{success}</div>}
        </div>
      </div>
    </div>
  );
}
