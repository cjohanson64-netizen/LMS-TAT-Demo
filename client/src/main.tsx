import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { DataRefreshProvider } from "./data/DataRefreshProvider";
import "./styles/App.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DataRefreshProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </DataRefreshProvider>
  </React.StrictMode>
);
