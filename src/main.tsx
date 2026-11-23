import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { appliquerTheme, suivreSysteme } from "./theme";

appliquerTheme();
suivreSysteme();

createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
