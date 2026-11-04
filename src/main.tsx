import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";
import App from "./App.tsx";
import NetworkToastProvider from "./components/NetworkToastProvider";
import {
  syncRecurringContributions,
  syncRecurringBills,
  syncRecurringExpenses,
  syncRecurringIncomes,
} from "./services/recurring.service";
void Promise.all([
  syncRecurringExpenses(),
  syncRecurringIncomes(),
  syncRecurringContributions(),
  syncRecurringBills(),
]).finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Tooltip.Provider delayDuration={300}>
        <NetworkToastProvider>
          <App />
          <ToastContainer
            position="top-right"
            autoClose={5000}
            closeOnClick
            pauseOnFocusLoss
            draggable
            theme="colored"
          />
        </NetworkToastProvider>
      </Tooltip.Provider>
    </StrictMode>,
  );
});
