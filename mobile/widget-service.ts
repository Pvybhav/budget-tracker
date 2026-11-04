import { budgetTrackerWidget } from "./widget";
import type { BudgetWidgetProps } from "./widget-types";

export function updateBudgetTrackerWidget(props: BudgetWidgetProps) {
  budgetTrackerWidget.updateSnapshot(props);
}
