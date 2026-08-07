import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import AddPaymentModal from '../components/modals/AddPaymentModal';

export default function ManagePaymentsPage() {
  const payments = useLiveQuery(() => db.payments.toArray());
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-slate-100">Manage Payments</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Add Payment
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-slate-300 whitespace-nowrap min-w-max">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="px-6 py-4 font-medium">Date</th>
              <th className="px-6 py-4 font-medium">Card ID</th>
              <th className="px-6 py-4 font-medium">Amount</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {payments?.map((payment) => (
              <tr key={payment.id} className="hover:bg-slate-800/20 transition-colors">
                <td className="px-6 py-4">{new Date(payment.date).toLocaleDateString()}</td>
                <td className="px-6 py-4">{payment.cardId}</td>
                <td className="px-6 py-4">₹{payment.amount}</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-blue-400 hover:text-blue-300 mr-3">Edit</button>
                  <button 
                    onClick={() => db.payments.delete(payment.id!)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {(!payments || payments.length === 0) && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                  No payments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddPaymentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
