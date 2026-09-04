import moment from "moment";

export const DATE_INPUT_FORMAT = "YYYY-MM-DD";
export const DATE_TIME_INPUT_FORMAT = "YYYY-MM-DDTHH:mm";
export const DISPLAY_DATE_FORMAT = "DD/MM/YYYY";

export function dateOnly(value: string) {
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

export function currentDateTimeInput() {
  return moment().format(DATE_TIME_INPUT_FORMAT);
}

export function formatMonthYear(value: string) {
  const date = moment(value, ["YYYY-MM", DATE_INPUT_FORMAT, moment.ISO_8601], true);
  return date.isValid() ? date.format("MMMM YYYY") : "Date unavailable";
}

export function formatDateOnly(value: string) {
  const date = parseDateOnly(value);
  return date ? moment(date).format(DISPLAY_DATE_FORMAT) : "Date unavailable";
}
