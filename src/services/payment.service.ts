import { db, type Payment } from '../db/db';

export async function addPayment(data: Payment) {
  return await db.payments.add(data);
}

export async function deletePayment(id: number) {
  return await db.payments.delete(id);
}
