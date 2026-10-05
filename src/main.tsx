import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Tooltip from "@radix-ui/react-tooltip";
import "./index.css";
import App from "./App.tsx";
import NetworkToastProvider from "./components/NetworkToastProvider";
import {
  syncRecurringContributions,
  syncRecurringExpenses,
  syncRecurringIncomes,
} from "./services/recurring.service";
void Promise.all([
  syncRecurringExpenses(),
  syncRecurringIncomes(),
  syncRecurringContributions(),
]).finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Tooltip.Provider delayDuration={300}>
        <NetworkToastProvider>
          <App />
        </NetworkToastProvider>
      </Tooltip.Provider>
    </StrictMode>,
  );
});
