// src/components/WorkerAuthScreen.tsx
import React, { useState } from "react";
import { loginWorker, registerWorker } from "../services/authWorker";
import { formatRut, validateRut } from "../services/rut";
import { FiInfo, FiEye, FiEyeOff } from "react-icons/fi";

type Props = {
  onSuccess: () => void;
  onBack?: () => void;
};

export default function WorkerAuthScreen({ onSuccess, onBack }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Login
  const [rut, setRut] = useState("");
  const [password, setPassword] = useState("");

  // Register
  const [fullName, setFullName] = useState("");
  const [rutNew, setRutNew] = useState("");
  const [phone, setPhone] = useState("");
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [terms, setTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setErr(null);
    setLoading(true);
    try {
      if (!validateRut(rut)) {
        throw new Error("El RUT ingresado no es válido.");
      }
      await loginWorker(rut, password);
      onSuccess();
    } catch (e: any) {
      setErr(e?.message || "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setErr(null);

    if (!fullName.trim() || !rutNew.trim() || !phone.trim() || !pass1) {
      setErr("Completa todos los campos requeridos.");
      return;
    }
    if (!validateRut(rutNew)) {
      setErr("El RUT ingresado no es válido.");
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

    setLoading(true);
    try {
      await registerWorker({ fullName, rut: rutNew, phone, password: pass1 });
      onSuccess();
    } catch (e: any) {
      setErr(e?.message || "No se pudo crear la cuenta.");
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
                  value={rut}
                  onChange={(e) => setRut(formatRut(e.target.value))}
                  placeholder="RUT (12.345.678-9)"
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
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold py-3 rounded-xl transition-all shadow-md hover:shadow-lg"
                >
                  {loading ? "Ingresando..." : "INICIAR SESIÓN"}
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
                <div className="flex gap-2">
                  <div className="w-20 border border-gray-300 rounded-xl px-3 py-3 text-gray-500 text-sm bg-gray-50">
                    +569
                  </div>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="8 dígitos"
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

          {err && (
            <div className="mt-4 text-sm text-red-700 bg-red-100 border border-red-300 p-3 rounded-lg">
              {err}
            </div>
          )}

          <div className="mt-4 text-[11px] text-gray-500">
            Nota: No pedimos correo. Tu RUT funciona como usuario. Si cambias de teléfono, podrás recuperar por soporte.
          </div>
        </div>
      </div>
    </div>
  );
}
