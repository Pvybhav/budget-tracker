import { useEffect, useState } from "react";
import type { Card, RewardPointsEntry } from "../../db/db";
import { createRewardPoints, updateRewardPoints } from "../../services/backendSync";
import { X } from "lucide-react";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  card?: Card;
  initialEntry?: RewardPointsEntry;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
export default function AddRewardPointsModal({
  isOpen,
  onClose,
  card,
  initialEntry,
}: Readonly<Props>) {
  const [formData, setFormData] = useState({
    type: "earned" as RewardPointsEntry["type"],
    points: "",
    valuePerPoint: "0.25",
    date: today(),
    expiryDate: "",
    note: "",
  });
  useEffect(() => {
    if (isOpen) {
      setFormData({
        type: initialEntry?.type ?? "earned",
        points: initialEntry?.points.toString() ?? "",
        valuePerPoint: initialEntry?.valuePerPoint?.toString() ?? "0.25",
        date: initialEntry?.date ?? today(),
        expiryDate: initialEntry?.expiryDate ?? "",
        note: initialEntry?.note ?? "",
      });
    }
  }, [initialEntry, isOpen]);
  if (!isOpen || !card) return null;
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    const points = Number.parseFloat(formData.points || "0");
    if (!Number.isFinite(points) || points <= 0) return;
    const payload: Omit<RewardPointsEntry, "id"> = {
      cardId: card.id!,
      type: formData.type,
      points,
      valuePerPoint: Number.parseFloat(formData.valuePerPoint || "0"),
      date: formData.date,
      expiryDate: formData.type === "earned" ? formData.expiryDate || undefined : undefined,
      note: formData.note.trim() || undefined,
    };
    if (initialEntry?.id) {
      await updateRewardPoints(initialEntry.id, payload);
    } else {
      await createRewardPoints(payload);
    }
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      {" "}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl relative">
        {" "}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          {" "}
          <X className="w-5 h-5" />{" "}
        </button>{" "}
        <div className="p-6 border-b border-slate-800">
          {" "}
          <h2 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            {" "}
            {initialEntry ? "Edit" : "Add"} Reward Points — {card.title}{" "}
          </h2>{" "}
        </div>{" "}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {" "}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {" "}
                Entry Type{" "}
              </label>{" "}
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500"
              >
                {" "}
                <option value="earned">Earned</option> <option value="redeemed">Redeemed</option>{" "}
                <option value="expired">Expired</option>{" "}
              </select>{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-400 mb-1"> Points </label>{" "}
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                name="points"
                value={formData.points}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500"
              />{" "}
            </div>{" "}
          </div>{" "}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {" "}
                Value per Point (₹){" "}
              </label>{" "}
              <input
                type="number"
                min="0"
                step="0.01"
                name="valuePerPoint"
                value={formData.valuePerPoint}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500"
              />{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-400 mb-1"> Date </label>{" "}
              <input
                required
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500"
              />{" "}
            </div>{" "}
          </div>{" "}
          {formData.type === "earned" && (
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {" "}
                Expiry Date (optional){" "}
              </label>{" "}
              <input
                type="date"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500"
              />{" "}
            </div>
          )}{" "}
          <div>
            {" "}
            <label className="block text-sm font-medium text-slate-400 mb-1"> Notes </label>{" "}
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500"
            />{" "}
          </div>{" "}
          <div className="pt-2">
            {" "}
            <button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {" "}
              {initialEntry ? "Update Entry" : "Save Entry"}{" "}
            </button>{" "}
          </div>{" "}
        </form>{" "}
      </div>{" "}
    </div>
  );
}
