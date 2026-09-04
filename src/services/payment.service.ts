import type { Payment } from "../db/db";
import * as backend from "./backendSync";

export async function addPayment(data: Payment) {
  return backend.createPayment(data);
}

export async function deletePayment(id: string) {
  return backend.deletePayment(id);
}
