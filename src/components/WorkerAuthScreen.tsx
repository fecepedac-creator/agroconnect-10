// src/components/WorkerAuthScreen.tsx
import React, { useState } from "react";
import {
  loginWorker,
  registerWorker,
  sendWorkerPasswordReset,
  signInWorkerWithGoogle,
  updateWorkerRut,
} from "../services/workerAuth";
import { formatRut, isValidRut } from "../utils/rut";
import { FiInfo, FiEye, FiEyeOff } from "react-icons/fi";
import { auth } from "../firebase";

type Props = {
  onSuccess: () => void;
  onBack?: () => void;
};

export default function WorkerAuthScreen({ onSuccess, onBack }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showResetCta, setShowResetCta] = useState(false);
  const [needsRut, setNeedsRut] = useState(false);

  // Login
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // Register
  const [fullName, setFullName] = useState("");
  const [rutNew, setRutNew] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [terms, setTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rutGoogle, setRutGoogle] = useState("");

  const handleIdentifierChange = (value: string) => {
    const raw = value.trim();
    if (raw.includes("@")) {
      setIdentifier(raw.toLowerCase());
    } else {
      setIdentifier(formatRut(raw));
    }
  };

  const handleLogin = async () => {
    setErr(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      if (!identifier.trim()) {
        throw new Error("Ingresa tu RUT o Email.");
      }
      if (!identifier.includes("@") && !isValidRut(identifier)) {
        throw new Error("El RUT ingresado no es válido.");
      }
      await loginWorker(identifier, password);
      onSuccess();
    } catch (e: any) {
      setErr(e?.message || "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setErr(null);
    setSuccessMsg(null);
    setShowResetCta(false);

    if (!fullName.trim() || !rutNew.trim() || !email.trim() || !pass1) {
      setErr("Completa todos los campos requeridos (nombre, RUT, email y contraseña).");
      return;
    }
    if (!isValidRut(rutNew)) {
      setErr("El RUT ingresado no es válido.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErr("Ingresa un email válido.");
      return;
    }
    if (pass1.length < 6) {
      setErr("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (pass1 !== pass2) {
      setErr("Las contraseñas no coinciden.");
      return;
    }
    if (!terms) {
      setErr("Debes aceptar los términos y condiciones.");
      return;
    }
    if (phone.trim() && phone.trim().length !== 8) {
      setErr("El teléfono debe tener 8 dígitos.");
      return;
    }

    setLoading(true);
    try {
      await registerWorker({ fullName, rut: rutNew, phone, email, password: pass1 });
      onSuccess();
    } catch (e: any) {
      const code = String(e?.code || "");
      if (code.includes("auth/email-already-in-use")) {
        setErr("Este correo ya está registrado. Inicia sesión o recupera tu clave.");
        setShowResetCta(true);
        setIdentifier(email.trim().toLowerCase());
      } else if (code.includes("auth/weak-password")) {
        setErr("La contraseña es muy débil.");
      } else if (code.includes("permission-denied")) {
        setErr("No tienes permisos para crear el perfil. Contacta soporte.");
      } else {
        setErr(e?.message || "No se pudo crear la cuenta.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setErr(null);
    setSuccessMsg(null);

    if (!identifier.trim()) {
      setErr("Ingresa tu email o RUT para recuperar tu clave.");
      return;
    }

    try {
      const emailUsed = await sendWorkerPasswordReset(identifier);
      setSuccessMsg(`Te enviamos un correo de recuperación a ${emailUsed}.`);
    } catch (e: any) {
      setErr(e?.message || "No se pudo enviar el correo de recuperación.");
    }
  };

  const handleGoogleSignIn = async () => {
    setErr(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const { needsRut: needsRutFlag } = await signInWorkerWithGoogle();
      if (needsRutFlag) {
        setNeedsRut(true);
        return;
      }
      onSuccess();
    } catch (e: any) {
      setErr(e?.message || "No se pudo iniciar sesión con Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRutGoogle = async () => {
    setErr(null);
    setSuccessMsg(null);

    if (!rutGoogle.trim()) {
      setErr("Ingresa tu RUT para completar el perfil.");
      return;
    }
    if (!isValidRut(rutGoogle)) {
      setErr("El RUT ingresado no es válido.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser?.uid || !currentUser.email) {
      setErr("No encontramos tu sesión. Intenta ingresar nuevamente.");
      return;
    }

    setLoading(true);
    try {
      await updateWorkerRut(currentUser.uid, rutGoogle, currentUser.email);
      setNeedsRut(false);
      setSuccessMsg("RUT guardado correctamente.");
      onSuccess();
    } catch (e: any) {
      setErr(e?.message || "No se pudo guardar el RUT.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-extrabold text-emerald-800">AgroConnect</div>
              <div className="text-xs font-semibold text-emerald-600">CHILE</div>
            </div>
            {onBack && (
              <button onClick={onBack} className="text-sm text-gray-600 hover:text-gray-900">
                Volver
              </button>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("login")}
              className={`py-2 rounded-lg text-sm font-bold transition-all ${
                mode === "login"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Ingreso trabajador
            </button>
            <button
              onClick={() => setMode("register")}
              className={`py-3 rounded-lg text-sm font-bold uppercase transform transition-all ${
                mode === "register"
                  ? "bg-emerald-500 text-white shadow-lg ring-2 ring-offset-2 ring-emerald-400"
                  : "bg-emerald-400 text-white hover:bg-emerald-500 animate-pulse"
              }`}
            >
              Regístrate aquí
            </button>
          </div>
        </div>

        <div className="p-6">
          {mode === "login" ? (
            <>
              <h2 className="text-lg font-extrabold text-gray-900">INGRESO TRABAJADOR</h2>

              <div className="mt-4 space-y-3">
                <input
                  value={identifier}
                  onChange={(e) => handleIdentifierChange(e.target.value)}
                  placeholder="RUT o Email"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
                />
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contraseña"
                    type={showPassword ? "text" : "password"}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
                  />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-4 flex items-center text-gray-500">
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 text-left"
                >
                  ¿Olvidaste tu clave?
                </button>

                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold py-3 rounded-xl transition-all shadow-md hover:shadow-lg"
                >
                  {loading ? "Ingresando..." : "INICIAR SESIÓN"}
                </button>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-xl transition-all shadow-sm"
                >
                  Continuar con Google
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-extrabold text-gray-900">Crea tu Cuenta</h2>
              <p className="text-sm text-gray-600 mt-1">Regístrate para postular a ofertas.</p>

              <div className="mt-4 space-y-3">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                  placeholder="Nombre Completo"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
                />
                <input
                  value={rutNew}
                  onChange={(e) => setRutNew(formatRut(e.target.value))}
                  placeholder="RUT (Ej: 12.345.678-9)"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  type="email"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
                />
                <div className="flex gap-2">
                  <div className="w-20 border border-gray-300 rounded-xl px-3 py-3 text-gray-500 text-sm bg-gray-50">
                    +569
                  </div>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="8 dígitos (opcional)"
                    maxLength={8}
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
                  />
                </div>
                 <div className="relative">
                  <input
                    value={pass1}
                    onChange={(e) => setPass1(e.target.value)}
                    placeholder="Contraseña"
                    type={showPassword ? "text" : "password"}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-300 transition-all pr-10"
                  />
                   <div className="absolute inset-y-0 right-10 flex items-center pr-3 cursor-pointer group">
                     <FiInfo className="text-gray-400" />
                     <div className="absolute right-full mr-2 w-48 bg-gray-700 text-white text-xs rounded-lg py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                       Mínimo 6 caracteres.
                     </div>
                   </div>
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-4 flex items-center text-gray-500">
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
                <input
                  value={pass2}
                  onChange={(e) => setPass2(e.target.value)}
                  placeholder="Confirmar Contraseña"
                  type={showPassword ? "text" : "password"}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
                />

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-gray-700">
                  <div className="font-extrabold text-blue-800 mb-1">RESUMEN LEGAL TRABAJADOR</div>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>AgroConnect NO es tu empleador.</li>
                    <li>La empresa que te contrata es responsable del trabajo y del pago.</li>
                    <li>Tus datos se comparten con empresas para ofrecerte trabajo.</li>
                    <li>Usamos tu ubicación solo para mostrar trabajos cercanos.</li>
                    <li>Puedes apagar tu perfil o borrarlo cuando quieras.</li>
                    <li>Puedes recibir mensajes por WhatsApp o SMS (opcional).</li>
                  </ul>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500"/>
                  Acepto términos y condiciones
                </label>

                <button
                  onClick={handleRegister}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold py-3 rounded-xl transition-all shadow-md hover:shadow-lg"
                >
                  {loading ? "Creando..." : "CREAR PERFIL"}
                </button>
              </div>
            </>
          )}

          {needsRut && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="text-sm font-extrabold text-amber-800">Completa tu RUT</div>
              <p className="text-xs text-amber-700 mt-1">
                Para finalizar el acceso con Google necesitamos tu RUT.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <input
                  value={rutGoogle}
                  onChange={(e) => setRutGoogle(formatRut(e.target.value))}
                  placeholder="RUT (Ej: 12.345.678-9)"
                  className="w-full border border-amber-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-300 transition-all"
                />
                <button
                  type="button"
                  onClick={handleSaveRutGoogle}
                  disabled={loading}
                  className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-extrabold py-2 rounded-xl transition-all"
                >
                  Guardar RUT
                </button>
              </div>
            </div>
          )}

          {err && (
            <div className="mt-4 text-sm text-red-700 bg-red-100 border border-red-300 p-3 rounded-lg">
              {err}
              {showResetCta && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900"
                  >
                    Ir a Ingreso
                  </button>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900"
                  >
                    Recuperar clave
                  </button>
                </div>
              )}
            </div>
          )}

          {successMsg && (
            <div className="mt-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
              {successMsg}
            </div>
          )}

          <div className="mt-4 text-[11px] text-gray-500">
            Nota: Pedimos correo para recuperación y seguimiento. Tu RUT sigue siendo un dato clave del perfil.
          </div>
        </div>
      </div>
    </div>
  );
}
