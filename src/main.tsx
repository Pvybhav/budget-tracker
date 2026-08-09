import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import NetworkToastProvider from "./components/NetworkToastProvider";
import { syncRecurringExpenses } from "./services/recurring.service";

void syncRecurringExpenses().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <NetworkToastProvider>
        <App />
      </NetworkToastProvider>
    </StrictMode>,
  );
});
