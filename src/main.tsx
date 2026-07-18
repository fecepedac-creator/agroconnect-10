import { createRoot } from "react-dom/client";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import {startClientObservability} from "./services/telemetry";
import "./index.css";

startClientObservability();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
    <App />
  </AppErrorBoundary>
);
