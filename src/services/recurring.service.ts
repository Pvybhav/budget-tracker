import type { Expense, Income } from "../db/db";
import { fetchExpenses, createExpense, fetchIncomes, createIncome } from "./backend.service";

type RecurringFrequency = NonNullable<Expense["recurringFrequency"]>;

function toDateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function parseLocalDate(value: string) {
  const [datePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addInterval(date: Date, frequency: RecurringFrequency, interval: number) {
  const amount = Math.max(1, interval || 1);

  switch (frequency) {
    case "weekly":
      return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7 * amount);
    case "yearly":
      return new Date(date.getFullYear() + amount, date.getMonth(), date.getDate());
    case "monthly":
    default:
      return new Date(date.getFullYear(), date.getMonth() + amount, date.getDate());
  }
}

export async function syncRecurringExpenses(now = new Date()) {
  const expenses = await fetchExpenses();
  const templates = expenses.filter(
    (expense) => Boolean(expense.recurringFrequency) && !expense.isRecurringInstance,
  );

  for (const template of templates) {
    if (!template.id) continue;

    const frequency = template.recurringFrequency ?? "monthly";
    const interval = template.recurringInterval ?? 1;
    const endDate = template.recurringEndDate ? parseLocalDate(template.recurringEndDate) : null;

    const instances = expenses.filter(
      (expense) => expense.recurringTemplateId === template.id && expense.id !== template.id,
    );

    let latestOccurrenceDate = new Date(template.date);
    for (const instance of instances) {
      const instanceDate = new Date(instance.date);
      if (instanceDate > latestOccurrenceDate) {
        latestOccurrenceDate = instanceDate;
      }
    }

    let nextOccurrenceDate = addInterval(latestOccurrenceDate, frequency, interval);
    let createdCount = 0;

    while (createdCount < 6) {
      if (endDate && nextOccurrenceDate > endDate) {
        break;
      }

      if (nextOccurrenceDate > now) {
        break;
      }

      const nextOccurrenceValue = toDateTimeLocalValue(nextOccurrenceDate);
      const alreadyExists = instances.some((item) => item.date === nextOccurrenceValue);

      if (!alreadyExists) {
        const payload: Omit<Expense, "id"> = {
          cardId: template.cardId,
          categoryId: template.categoryId,
          details: template.details,
          amount: template.amount,
          date: nextOccurrenceValue,
          isEmi: template.isEmi,
          emiMonths: template.emiMonths,
          emiInterestRate: template.emiInterestRate,
          emiProcessingFee: template.emiProcessingFee,
          emiGst: template.emiGst,
          recurringFrequency: template.recurringFrequency,
          recurringInterval: template.recurringInterval,
          recurringEndDate: template.recurringEndDate,
          recurringTemplateId: template.id,
          isRecurringInstance: true,
        };

        await createExpense(payload);
        instances.push({ ...payload, id: undefined } as Expense);
        createdCount += 1;
      }

      latestOccurrenceDate = nextOccurrenceDate;
      nextOccurrenceDate = addInterval(nextOccurrenceDate, frequency, interval);
    }
  }
}

export async function syncRecurringIncomes(now = new Date()) {
  const income = await fetchIncomes();
  const templates = income.filter(
    (item) => Boolean(item.recurringFrequency) && !item.isRecurringInstance,
  );
  for (const template of templates) {
    if (!template.id) continue;
    const frequency = template.recurringFrequency ?? "monthly";
    const interval = template.recurringInterval ?? 1;
    const endDate = template.recurringEndDate ? parseLocalDate(template.recurringEndDate) : null;
    const instances = income.filter(
      (item) => item.recurringTemplateId === template.id && item.id !== template.id,
    );
    let latestOccurrenceDate = new Date(template.date);
    for (const instance of instances) {
      const instanceDate = new Date(instance.date);
      if (instanceDate > latestOccurrenceDate) {
        latestOccurrenceDate = instanceDate;
      }
    }
    let nextOccurrenceDate = addInterval(latestOccurrenceDate, frequency, interval);
    let createdCount = 0;
    while (createdCount < 6) {
      if (endDate && nextOccurrenceDate > endDate) {
        break;
      }
      if (nextOccurrenceDate > now) {
        break;
      }
      const nextOccurrenceValue = toDateTimeLocalValue(nextOccurrenceDate);
      const alreadyExists = instances.some((item) => item.date === nextOccurrenceValue);
      if (!alreadyExists) {
        const payload: Omit<Income, "id"> = {
          source: template.source,
          category: template.category,
          accountId: template.accountId,
          amount: template.amount,
          date: nextOccurrenceValue,
          note: template.note,
          recurringFrequency: template.recurringFrequency,
          recurringInterval: template.recurringInterval,
          recurringEndDate: template.recurringEndDate,
          recurringTemplateId: template.id,
          isRecurringInstance: true,
        };
        await createIncome(payload);
        instances.push({ ...payload, id: undefined } as Income);
        createdCount += 1;
      }
      latestOccurrenceDate = nextOccurrenceDate;
      nextOccurrenceDate = addInterval(nextOccurrenceDate, frequency, interval);
    }
  }
}
