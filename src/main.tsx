import { createRoot } from "react-dom/client";
import * as React from "react";
import App from "./App";
import "./index.css";
import { AuthProvider } from "@/auth/AuthProvider";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);