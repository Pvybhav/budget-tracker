import { Income, Expense, Payment } from "./models.js";

const MIGRATION_KEY = "legacy-local-datetime-v1";
const LEGACY_OFFSET_MINUTES = Number(process.env.LEGACY_DATETIME_OFFSET_MINUTES ?? 330);

export async function migrateLegacyDateTimes(connection) {
  if (!Number.isFinite(LEGACY_OFFSET_MINUTES) || LEGACY_OFFSET_MINUTES === 0) return;

  const migrations = connection.db.collection("date_migrations");
  const alreadyMigrated = await migrations.findOne({ _id: MIGRATION_KEY });
  if (alreadyMigrated) return;

  const shiftDate = {
    $dateSubtract: {
      startDate: "$date",
      unit: "minute",
      amount: LEGACY_OFFSET_MINUTES,
    },
  };
  const shiftOptionalDate = {
    $cond: [
      { $eq: [{ $type: "$recurringEndDate" }, "date"] },
      {
        $dateSubtract: {
          startDate: "$recurringEndDate",
          unit: "minute",
          amount: LEGACY_OFFSET_MINUTES,
        },
      },
      "$recurringEndDate",
    ],
  };

  await Expense.collection.updateMany({ dateTimezoneVersion: { $exists: false } }, [
    { $set: { date: shiftDate, recurringEndDate: shiftOptionalDate, dateTimezoneVersion: 2 } },
  ]);
  await Income.collection.updateMany({ dateTimezoneVersion: { $exists: false } }, [
    { $set: { date: shiftDate, recurringEndDate: shiftOptionalDate, dateTimezoneVersion: 2 } },
  ]);
  await Payment.collection.updateMany({ dateTimezoneVersion: { $exists: false } }, [
    { $set: { date: shiftDate, dateTimezoneVersion: 2 } },
  ]);

  await migrations.insertOne({
    _id: MIGRATION_KEY,
    offsetMinutes: LEGACY_OFFSET_MINUTES,
    migratedAt: new Date(),
  });
}
