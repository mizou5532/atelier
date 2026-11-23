import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { appliquerTheme, suivreSysteme } from "./theme";
import { chargerPreferences } from "./preferences";

appliquerTheme();
suivreSysteme();
chargerPreferences();

createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
