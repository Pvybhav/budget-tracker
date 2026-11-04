import { createWidget } from "expo-widgets";
import { BudgetTrackerWidget } from "./widget-component";
import type { BudgetWidgetProps } from "./widget-types";

export const budgetTrackerWidget = createWidget<BudgetWidgetProps>(
  "BudgetTrackerWidget",
  BudgetTrackerWidget,
  { balance: "₹0", spent: "₹0", alertCount: 0 },
);
