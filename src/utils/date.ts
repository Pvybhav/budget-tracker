import moment from "moment";

export const DATE_INPUT_FORMAT = "YYYY-MM-DD";
export const DATE_TIME_INPUT_FORMAT = "YYYY-MM-DDTHH:mm";
export const DISPLAY_DATE_FORMAT = "D MMM YY";

export function dateOnly(value: string) {
  const datePart = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (datePart && !value.includes("T")) return datePart;
  if (datePart) {
    if (/^\d{4}-\d{2}-\d{2}T00:00(?::00(?:\.0{1,3})?)?Z$/.test(value)) return datePart;
    const parsedDateTime = moment(value, moment.ISO_8601, true);
    if (parsedDateTime.isValid()) return parsedDateTime.local().format(DATE_INPUT_FORMAT);
  }
  const parsed = moment(value, [DATE_INPUT_FORMAT, moment.ISO_8601], true);
  return parsed.isValid() ? parsed.format(DATE_INPUT_FORMAT) : value.slice(0, 10);
}

export function parseDateOnly(value: string) {
  const date = moment(dateOnly(value), DATE_INPUT_FORMAT, true);
  return date.isValid() ? date.toDate() : undefined;
}

export function todayDateInput() {
  return moment().format(DATE_INPUT_FORMAT);
}

export function formatDateInput(value: Date) {
  return moment(value).format(DATE_INPUT_FORMAT);
}

export function getStatementDateRange(billingDay: number, year: number, month: number) {
  if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) return undefined;
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return undefined;

  const end = new Date(
    year,
    month - 1,
    Math.min(billingDay, new Date(year, month, 0).getDate()),
  );
  const previousMonth = new Date(year, month - 2, 1);
  const previousEnd = new Date(
    previousMonth.getFullYear(),
    previousMonth.getMonth(),
    Math.min(
      billingDay,
      new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0).getDate(),
    ),
  );
  const start = new Date(previousEnd);
  start.setDate(start.getDate() + 1);

  return { start: formatDateInput(start), end: formatDateInput(end) };
}

export function currentDateTimeInput() {
  return moment().format(DATE_TIME_INPUT_FORMAT);
}

export function dateTimeInput(value: string) {
  const parsed = moment(value, [DATE_TIME_INPUT_FORMAT, DATE_INPUT_FORMAT, moment.ISO_8601], true);
  return parsed.isValid() ? parsed.local().format(DATE_TIME_INPUT_FORMAT) : value.slice(0, 16);
}

export function dateTimeInputToUTC(value: string) {
  const parsed = moment(value, DATE_TIME_INPUT_FORMAT, true);
  return parsed.isValid() ? parsed.toISOString() : value;
}

export function formatMonthYear(value: string) {
  const date = moment(value, ["YYYY-MM", DATE_INPUT_FORMAT, moment.ISO_8601], true);
  return date.isValid() ? date.format("MMMM YYYY") : "Date unavailable";
}

export function formatDateOnly(value: string) {
  const date = parseDateOnly(value);
  return date ? moment(date).format(DISPLAY_DATE_FORMAT) : "Date unavailable";
}

export function formatDateTime(value: string) {
  const date = moment(value, moment.ISO_8601, true);
  return date.isValid() ? date.local().format("D MMM YY, h:mm A") : "Date unavailable";
}
