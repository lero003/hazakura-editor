import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { RootErrorRecovery } from "./components/app/RootErrorRecovery";
import { syncDocumentLanguageFromStorage } from "./features/app/documentLanguage";
import "./styles/index.css";

// `index.html` の既定は en。保存済みの表示言語を React の初回描画前に反映し、
// 起動直後の一瞬だけ本文・UI が en として読まれる状態を作らない。
syncDocumentLanguageFromStorage();

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RootErrorRecovery>
      <App />
    </RootErrorRecovery>
  </React.StrictMode>,
);
