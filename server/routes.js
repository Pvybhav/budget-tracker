import express from "express";
import {
  Card,
  Category,
  Expense,
  Payment,
  Loan,
  SavingsGoal,
} from "./models.js";

const router = express.Router();

const catchAsync = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const toNumericId = (value) => {
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

async function getNextId(model) {
  const maxDoc = await model.findOne().sort({ id: -1 }).select("id").lean();
  return maxDoc?.id != null ? maxDoc.id + 1 : 1;
}

async function createWithId(model, data) {
  if (data.id == null) {
    data.id = await getNextId(model);
  }
  return model.create(data);
}

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.get(
  "/cards",
  catchAsync(async (req, res) => {
    const cards = await Card.find().sort({ createdAt: -1 });
    res.json(cards);
  }),
);

router.post(
  "/cards",
  catchAsync(async (req, res) => {
    const card = await createWithId(Card, req.body);
    res.status(201).json(card);
  }),
);

router.get(
  "/cards/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid card id" });
    const card = await Card.findOne({ id });
    if (!card) return res.status(404).json({ error: "Card not found" });
    res.json(card);
  }),
);

router.put(
  "/cards/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid card id" });
    const card = await Card.findOneAndUpdate({ id }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!card) return res.status(404).json({ error: "Card not found" });
    res.json(card);
  }),
);

router.delete(
  "/cards/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid card id" });
    const card = await Card.findOne({ id });
    if (!card) return res.status(404).json({ error: "Card not found" });

    await Expense.deleteMany({ cardId: id });
    await Payment.deleteMany({ cardId: id });
    await card.deleteOne();

    res.json({ success: true });
  }),
);

router.get(
  "/categories",
  catchAsync(async (req, res) => {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.json(categories);
  }),
);

router.post(
  "/categories",
  catchAsync(async (req, res) => {
    const category = await createWithId(Category, req.body);
    res.status(201).json(category);
  }),
);

router.get(
  "/categories/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null)
      return res.status(400).json({ error: "Invalid category id" });
    const category = await Category.findOne({ id });
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  }),
);

router.put(
  "/categories/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null)
      return res.status(400).json({ error: "Invalid category id" });
    const category = await Category.findOneAndUpdate({ id }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  }),
);

router.delete(
  "/categories/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null)
      return res.status(400).json({ error: "Invalid category id" });
    const category = await Category.findOne({ id });
    if (!category) return res.status(404).json({ error: "Category not found" });

    await Expense.updateMany(
      { categoryId: id },
      { $unset: { categoryId: "" } },
    );
    await category.deleteOne();

    res.json({ success: true });
  }),
);

router.get(
  "/expenses",
  catchAsync(async (req, res) => {
    const filter = {};
    if (req.query.cardId) {
      const cardId = toNumericId(req.query.cardId);
      if (cardId != null) filter.cardId = cardId;
    }
    if (req.query.categoryId) {
      const categoryId = toNumericId(req.query.categoryId);
      if (categoryId != null) filter.categoryId = categoryId;
    }
    if (req.query.recurringTemplateId) {
      const recurringTemplateId = toNumericId(req.query.recurringTemplateId);
      if (recurringTemplateId != null)
        filter.recurringTemplateId = recurringTemplateId;
    }
    if (req.query.isRecurringInstance !== undefined) {
      filter.isRecurringInstance = req.query.isRecurringInstance === "true";
    }
    const expenses = await Expense.find(filter).sort({
      date: -1,
      createdAt: -1,
    });
    res.json(expenses);
  }),
);

router.post(
  "/expenses",
  catchAsync(async (req, res) => {
    const expense = await createWithId(Expense, req.body);
    res.status(201).json(expense);
  }),
);

router.get(
  "/expenses/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null)
      return res.status(400).json({ error: "Invalid expense id" });
    const expense = await Expense.findOne({ id });
    if (!expense) return res.status(404).json({ error: "Expense not found" });
    res.json(expense);
  }),
);

router.put(
  "/expenses/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null)
      return res.status(400).json({ error: "Invalid expense id" });
    const expense = await Expense.findOneAndUpdate({ id }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!expense) return res.status(404).json({ error: "Expense not found" });
    res.json(expense);
  }),
);

router.delete(
  "/expenses/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null)
      return res.status(400).json({ error: "Invalid expense id" });
    const expense = await Expense.findOne({ id });
    if (!expense) return res.status(404).json({ error: "Expense not found" });
    await expense.deleteOne();
    res.json({ success: true });
  }),
);

router.get(
  "/payments",
  catchAsync(async (req, res) => {
    const filter = {};
    if (req.query.cardId) {
      const cardId = toNumericId(req.query.cardId);
      if (cardId != null) filter.cardId = cardId;
    }
    const payments = await Payment.find(filter).sort({
      date: -1,
      createdAt: -1,
    });
    res.json(payments);
  }),
);

router.post(
  "/payments",
  catchAsync(async (req, res) => {
    const payment = await createWithId(Payment, req.body);
    res.status(201).json(payment);
  }),
);

router.get(
  "/payments/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null)
      return res.status(400).json({ error: "Invalid payment id" });
    const payment = await Payment.findOne({ id });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    res.json(payment);
  }),
);

router.put(
  "/payments/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null)
      return res.status(400).json({ error: "Invalid payment id" });
    const payment = await Payment.findOneAndUpdate({ id }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    res.json(payment);
  }),
);

router.delete(
  "/payments/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null)
      return res.status(400).json({ error: "Invalid payment id" });
    const payment = await Payment.findOne({ id });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    await payment.deleteOne();
    res.json({ success: true });
  }),
);

router.get(
  "/loans",
  catchAsync(async (req, res) => {
    const loans = await Loan.find().sort({ createdAt: -1 });
    res.json(loans);
  }),
);

router.post(
  "/loans",
  catchAsync(async (req, res) => {
    const loan = await createWithId(Loan, req.body);
    res.status(201).json(loan);
  }),
);

router.get(
  "/loans/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid loan id" });
    const loan = await Loan.findOne({ id });
    if (!loan) return res.status(404).json({ error: "Loan not found" });
    res.json(loan);
  }),
);

router.put(
  "/loans/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid loan id" });
    const updates = { ...req.body };
    if (Array.isArray(req.body.repayments)) {
      updates.repayments = req.body.repayments.map((repayment) => ({
        paymentNumber: Number(repayment.paymentNumber),
        paid: Boolean(repayment.paid),
        ...(repayment.paidDate ? { paidDate: repayment.paidDate } : {}),
        ...(repayment.note ? { note: repayment.note } : {}),
      }));
    }
    const loan = await Loan.findOneAndUpdate(
      { id },
      { $set: updates },
      {
        new: true,
        runValidators: true,
      },
    );
    if (!loan) return res.status(404).json({ error: "Loan not found" });
    res.json(loan);
  }),
);

router.delete(
  "/loans/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid loan id" });
    const loan = await Loan.findOne({ id });
    if (!loan) return res.status(404).json({ error: "Loan not found" });
    await loan.deleteOne();
    res.json({ success: true });
  }),
);

router.get(
  "/savings-goals",
  catchAsync(async (req, res) => {
    const goals = await SavingsGoal.find().sort({ createdAt: -1 });
    res.json(goals);
  }),
);

router.post(
  "/savings-goals",
  catchAsync(async (req, res) => {
    const goal = await createWithId(SavingsGoal, req.body);
    res.status(201).json(goal);
  }),
);

router.get(
  "/savings-goals/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null)
      return res.status(400).json({ error: "Invalid savings goal id" });
    const goal = await SavingsGoal.findOne({ id });
    if (!goal) return res.status(404).json({ error: "Savings goal not found" });
    res.json(goal);
  }),
);

router.put(
  "/savings-goals/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null)
      return res.status(400).json({ error: "Invalid savings goal id" });
    const goal = await SavingsGoal.findOneAndUpdate({ id }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!goal) return res.status(404).json({ error: "Savings goal not found" });
    res.json(goal);
  }),
);

router.delete(
  "/savings-goals/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null)
      return res.status(400).json({ error: "Invalid savings goal id" });
    const goal = await SavingsGoal.findOne({ id });
    if (!goal) return res.status(404).json({ error: "Savings goal not found" });
    await goal.deleteOne();
    res.json({ success: true });
  }),
);

export default router;
