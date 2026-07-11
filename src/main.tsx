import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { RootErrorRecovery } from "./components/app/RootErrorRecovery";
import "./styles/index.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RootErrorRecovery>
      <App />
    </RootErrorRecovery>
  </React.StrictMode>,
);
