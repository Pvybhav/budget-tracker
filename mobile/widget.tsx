import { createWidget } from "expo-widgets";
import { HStack, Text, VStack } from "@expo/ui/swift-ui";
import { background, cornerRadius, font, foregroundColor, padding } from "@expo/ui/swift-ui/modifiers";

export type BudgetWidgetProps = {
  balance: string;
  spent: string;
  alertCount: number;
};

function BudgetTrackerWidget(props: BudgetWidgetProps) {
  "use widget";

  return (
    <VStack spacing={8} modifiers={[background("#0b756c"), cornerRadius(18), padding({ all: 16 })]}>
      <Text modifiers={[font({ size: 12, weight: "bold" }), foregroundColor("#b9e2d9")]}>BUDGET TRACKER</Text>
      <Text modifiers={[font({ size: 24, weight: "bold" }), foregroundColor("#ffffff")]}>{props.balance}</Text>
      <HStack spacing={8}>
        <VStack spacing={2}>
          <Text modifiers={[font({ size: 11 }), foregroundColor("#b9e2d9")]}>Spent this month</Text>
          <Text modifiers={[font({ size: 14, weight: "bold" }), foregroundColor("#ffffff")]}>{props.spent}</Text>
        </VStack>
        <VStack spacing={2}>
          <Text modifiers={[font({ size: 11 }), foregroundColor("#b9e2d9")]}>Alerts</Text>
          <Text modifiers={[font({ size: 14, weight: "bold" }), foregroundColor("#ffffff")]}>{String(props.alertCount)}</Text>
        </VStack>
      </HStack>
    </VStack>
  );
}

export const budgetTrackerWidget = createWidget<BudgetWidgetProps>(
  "BudgetTrackerWidget",
  BudgetTrackerWidget,
  { balance: "₹0", spent: "₹0", alertCount: 0 },
);

export function updateBudgetTrackerWidget(props: BudgetWidgetProps) {
  budgetTrackerWidget.updateSnapshot(props);
}
