import React from "react";
import {reportClientError} from "../services/telemetry";

type State = {failed: boolean};

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = {failed: false};

  static getDerivedStateFromError(): State {
    return {failed: true};
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportClientError(error, {source: "react", componentStack: info.componentStack?.slice(0, 500) || ""});
  }

  render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <main id="main-content" className="flex min-h-screen items-center justify-center bg-amber-50 px-5">
        <section role="alert" className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-lg">
          <h1 className="text-2xl font-black text-slate-950">No pudimos mostrar esta pagina</h1>
          <p className="mt-3 text-base text-slate-700">Tu informacion no se perdio. Recarga para intentarlo nuevamente.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 min-h-14 rounded-2xl bg-slate-950 px-6 text-base font-black text-white">
            Recargar pagina
          </button>
        </section>
      </main>
    );
  }
}
