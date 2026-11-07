import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CategoryExpensesModal from "./CategoryExpensesModal";
import { fetchCards, fetchExpenses } from "../../services/backend.service";

vi.mock("../../services/backend.service", () => ({
  fetchCards: vi.fn(),
  fetchExpenses: vi.fn(),
}));

describe("CategoryExpensesModal", () => {
  beforeEach(() => {
    vi.mocked(fetchExpenses).mockResolvedValue([
      { id: "march", categoryId: "food", details: "Lunch", amount: 300, date: "2024-03-15" },
      { id: "old", categoryId: "food", details: "Dinner", amount: 700, date: "2022-10-01" },
      { id: "other", categoryId: "travel", details: "Train", amount: 900, date: "2024-03-20" },
    ]);
    vi.mocked(fetchCards).mockResolvedValue([]);
  });

  it("shows the selected period and lifetime total for only this category", async () => {
    render(
      <CategoryExpensesModal
        isOpen
        onClose={vi.fn()}
        category={{ id: "food", title: "Food" }}
        selectedYear={2024}
        selectedMonth={3}
      />,
    );

    expect(await screen.findByText("Lifetime recorded")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByText("₹300.00")).toHaveLength(2);
      expect(screen.getByText("₹1,000.00")).toBeTruthy();
    });
    expect(screen.getByText("Lunch")).toBeTruthy();
    expect(screen.queryByText("Dinner")).toBeNull();
    expect(screen.queryByText("Train")).toBeNull();
  });
});
