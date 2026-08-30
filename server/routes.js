import crypto from "crypto";
import express from "express";
import {
  User,
  Card,
  Category,
  Expense,
  Payment,
  Transfer,
  Bill,
  Loan,
  SavingsGoal,
  Income,
  RewardPoints,
  Investment,
  InsurancePolicy,
  BudgetRule,
  AutoCategorizeRule,
  NetWorthSnapshot,
  InvestmentTransaction,
} from "./models.js";
const router = express.Router();
const AUTH_SECRET = process.env.JWT_SECRET || "budget-tracker-dev-secret";
const DEFAULT_USERNAME = process.env.BUDGET_TRACKER_USERNAME || "admin";
const DEFAULT_PASSWORD = process.env.BUDGET_TRACKER_PASSWORD || "admin123";
const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return { salt, hash };
};
const verifyPassword = (password, salt, hash) => {
  const candidate = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
};
const parseCookieHeader = (cookieHeader = "") =>
  Object.fromEntries(
    cookieHeader
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [key, ...rest] = item.split("=");
        return [key, decodeURIComponent(rest.join("="))];
      }),
  );
const toBase64Url = (value) => Buffer.from(value).toString("base64url");
const signToken = (payload) => {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
};
const verifyToken = (token) => {
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) {
    throw new Error("Malformed token");
  }
  const expectedSignature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error("Invalid token signature");
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error("Token expired");
  }
  return payload;
};
const getAuthToken = (req) => {
  const authorization = req.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }
  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies.budget_tracker_session || null;
};
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
router.use((req, res, next) => {
  if (req.path === "/health" || req.path.startsWith("/auth")) {
    return next();
  }
  const token = getAuthToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    req.user = verifyToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
});
const ensureDefaultAdminUser = async () => {
  const username = DEFAULT_USERNAME.toLowerCase();
  const existingUser = await User.findOne({ username });
  if (existingUser) return existingUser;
  const { salt, hash } = hashPassword(DEFAULT_PASSWORD);
  return User.create({
    username,
    fullName: "Administrator",
    role: "admin",
    passwordHash: hash,
    passwordSalt: salt,
  });
};
router.post(
  "/auth/signup",
  catchAsync(async (req, res) => {
    const username = String(req.body?.username ?? "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password ?? "");
    const fullName = String(req.body?.fullName ?? "User").trim();
    if (!/^[a-z0-9_.-]{3,32}$/i.test(username)) {
      return res.status(400).json({
        error:
          "Username must be 3-32 characters using letters, numbers, dots, underscores, or hyphens.",
      });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }
    if (await User.findOne({ username })) {
      return res.status(409).json({ error: "Username is already taken." });
    }
    const { salt, hash } = hashPassword(password);
    const user = await User.create({
      username,
      fullName: fullName || "User",
      role: "user",
      passwordHash: hash,
      passwordSalt: salt,
    });
    const sessionToken = signToken({
      sub: user.username,
      fullName: user.fullName,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    });
    const isProduction = process.env.NODE_ENV === "production";
    res.setHeader(
      "Set-Cookie",
      `budget_tracker_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24}${isProduction ? "; Secure" : ""}`,
    );
    return res.status(201).json({
      user: { username: user.username, fullName: user.fullName, role: user.role },
      token: sessionToken,
    });
  }),
);
router.post(
  "/auth/login",
  catchAsync(async (req, res) => {
    const username = String(req.body?.username ?? "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password ?? "");
    let user = await User.findOne({ username });
    if (!user && username === DEFAULT_USERNAME.toLowerCase()) {
      user = await ensureDefaultAdminUser();
    }
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    const sessionToken = signToken({
      sub: user.username,
      fullName: user.fullName,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    });
    const isProduction = process.env.NODE_ENV === "production";
    res.setHeader(
      "Set-Cookie",
      `budget_tracker_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24}${isProduction ? "; Secure" : ""}`,
    );
    return res.json({
      user: { username: user.username, fullName: user.fullName, role: user.role },
      token: sessionToken,
    });
  }),
);
router.get("/auth/session", async (req, res) => {
  const token = getAuthToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const payload = verifyToken(token);
    return res.json({
      user: {
        username: payload.sub,
        fullName: payload.fullName || payload.sub,
        role: payload.role || "user",
      },
    });
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
});
router.post("/auth/logout", (req, res) => {
  res.setHeader("Set-Cookie", "budget_tracker_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return res.json({ success: true });
});
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
    const card = await Card.findOneAndUpdate({ id }, req.body, { new: true, runValidators: true });
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
    await RewardPoints.deleteMany({ cardId: id });
    await Transfer.deleteMany({ $or: [{ fromAccountId: id }, { toAccountId: id }] });
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
    if (id == null) return res.status(400).json({ error: "Invalid category id" });
    const category = await Category.findOne({ id });
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  }),
);
router.put(
  "/categories/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid category id" });
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
    if (id == null) return res.status(400).json({ error: "Invalid category id" });
    const category = await Category.findOne({ id });
    if (!category) return res.status(404).json({ error: "Category not found" });
    await Expense.updateMany({ categoryId: id }, { $unset: { categoryId: "" } });
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
      if (recurringTemplateId != null) filter.recurringTemplateId = recurringTemplateId;
    }
    if (req.query.isRecurringInstance !== undefined) {
      filter.isRecurringInstance = req.query.isRecurringInstance === "true";
    }
    const expenses = await Expense.find(filter).sort({ date: -1, createdAt: -1 });
    res.json(expenses);
  }),
);
router.post(
  "/expenses",
  catchAsync(async (req, res) => {
    const cardId = toNumericId(req.body.cardId);
    const categoryId = req.body.categoryId == null ? undefined : toNumericId(req.body.categoryId);
    if (cardId == null || !(await Card.exists({ id: cardId }))) {
      return res.status(400).json({ error: "Expense account must exist" });
    }
    if (
      req.body.categoryId != null &&
      (categoryId == null || !(await Category.exists({ id: categoryId })))
    ) {
      return res.status(400).json({ error: "Expense category must exist" });
    }
    const expense = await createWithId(Expense, req.body);
    res.status(201).json(expense);
  }),
);
router.get(
  "/expenses/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid expense id" });
    const expense = await Expense.findOne({ id });
    if (!expense) return res.status(404).json({ error: "Expense not found" });
    res.json(expense);
  }),
);
router.put(
  "/expenses/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid expense id" });
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
    if (id == null) return res.status(400).json({ error: "Invalid expense id" });
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
    const payments = await Payment.find(filter).sort({ date: -1, createdAt: -1 });
    res.json(payments);
  }),
);
router.post(
  "/payments",
  catchAsync(async (req, res) => {
    const cardId = toNumericId(req.body.cardId);
    if (cardId == null || !(await Card.exists({ id: cardId }))) {
      return res.status(400).json({ error: "Payment account must exist" });
    }
    const payment = await createWithId(Payment, req.body);
    res.status(201).json(payment);
  }),
);
router.get(
  "/payments/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid payment id" });
    const payment = await Payment.findOne({ id });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    res.json(payment);
  }),
);
router.put(
  "/payments/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid payment id" });
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
    if (id == null) return res.status(400).json({ error: "Invalid payment id" });
    const payment = await Payment.findOne({ id });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    await payment.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/transfers",
  catchAsync(async (req, res) => {
    const transfers = await Transfer.find().sort({ date: -1, createdAt: -1 });
    res.json(transfers);
  }),
);
router.post(
  "/transfers",
  catchAsync(async (req, res) => {
    const fromAccountId = toNumericId(req.body.fromAccountId);
    const toAccountId = toNumericId(req.body.toAccountId);
    const amount = Number(req.body.amount);
    if (fromAccountId == null || toAccountId == null || fromAccountId === toAccountId) {
      return res.status(400).json({ error: "Transfer accounts must be different valid accounts" });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Transfer amount must be greater than zero" });
    }
    const [source, destination] = await Promise.all([
      Card.findOne({ id: fromAccountId }).select("id"),
      Card.findOne({ id: toAccountId }).select("id"),
    ]);
    if (!source || !destination) {
      return res.status(400).json({ error: "Both transfer accounts must exist" });
    }
    const transfer = await createWithId(Transfer, {
      ...req.body,
      fromAccountId,
      toAccountId,
      amount,
    });
    res.status(201).json(transfer);
  }),
);
router.delete(
  "/transfers/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid transfer id" });
    const transfer = await Transfer.findOne({ id });
    if (!transfer) return res.status(404).json({ error: "Transfer not found" });
    await transfer.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/bills",
  catchAsync(async (req, res) => {
    const bills = await Bill.find().sort({ dueDate: 1, createdAt: -1 });
    res.json(bills);
  }),
);
router.post(
  "/bills",
  catchAsync(async (req, res) => {
    const bill = await createWithId(Bill, req.body);
    res.status(201).json(bill);
  }),
);
router.put(
  "/bills/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid bill id" });
    const bill = await Bill.findOneAndUpdate({ id }, req.body, { new: true, runValidators: true });
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    res.json(bill);
  }),
);
router.delete(
  "/bills/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid bill id" });
    const bill = await Bill.findOne({ id });
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    await bill.deleteOne();
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
      { new: true, runValidators: true },
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
    if (id == null) return res.status(400).json({ error: "Invalid savings goal id" });
    const goal = await SavingsGoal.findOne({ id });
    if (!goal) return res.status(404).json({ error: "Savings goal not found" });
    res.json(goal);
  }),
);
router.put(
  "/savings-goals/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid savings goal id" });
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
    if (id == null) return res.status(400).json({ error: "Invalid savings goal id" });
    const goal = await SavingsGoal.findOne({ id });
    if (!goal) return res.status(404).json({ error: "Savings goal not found" });
    await goal.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/income",
  catchAsync(async (req, res) => {
    const filter = {};
    if (req.query.accountId) {
      const accountId = toNumericId(req.query.accountId);
      if (accountId != null) filter.accountId = accountId;
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.recurringTemplateId) {
      const recurringTemplateId = toNumericId(req.query.recurringTemplateId);
      if (recurringTemplateId != null) filter.recurringTemplateId = recurringTemplateId;
    }
    if (req.query.isRecurringInstance !== undefined) {
      filter.isRecurringInstance = req.query.isRecurringInstance === "true";
    }
    const income = await Income.find(filter).sort({ date: -1, createdAt: -1 });
    res.json(income);
  }),
);
router.post(
  "/income",
  catchAsync(async (req, res) => {
    if (req.body.accountId != null) {
      const accountId = toNumericId(req.body.accountId);
      if (accountId == null || !(await Card.exists({ id: accountId }))) {
        return res.status(400).json({ error: "Income account must exist" });
      }
    }
    const income = await createWithId(Income, req.body);
    res.status(201).json(income);
  }),
);
router.get(
  "/income/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid income id" });
    const income = await Income.findOne({ id });
    if (!income) return res.status(404).json({ error: "Income not found" });
    res.json(income);
  }),
);
router.put(
  "/income/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid income id" });
    const income = await Income.findOneAndUpdate({ id }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!income) return res.status(404).json({ error: "Income not found" });
    res.json(income);
  }),
);
router.delete(
  "/income/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid income id" });
    const income = await Income.findOne({ id });
    if (!income) return res.status(404).json({ error: "Income not found" });
    await income.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/reward-points",
  catchAsync(async (req, res) => {
    const filter = {};
    if (req.query.cardId) {
      const cardId = toNumericId(req.query.cardId);
      if (cardId != null) filter.cardId = cardId;
    }
    const entries = await RewardPoints.find(filter).sort({ date: -1, createdAt: -1 });
    res.json(entries);
  }),
);
router.post(
  "/reward-points",
  catchAsync(async (req, res) => {
    const entry = await createWithId(RewardPoints, req.body);
    res.status(201).json(entry);
  }),
);
router.put(
  "/reward-points/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid reward points id" });
    const entry = await RewardPoints.findOneAndUpdate({ id }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!entry) return res.status(404).json({ error: "Reward points entry not found" });
    res.json(entry);
  }),
);
router.delete(
  "/reward-points/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid reward points id" });
    const entry = await RewardPoints.findOne({ id });
    if (!entry) return res.status(404).json({ error: "Reward points entry not found" });
    await entry.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/investments",
  catchAsync(async (req, res) => {
    const investments = await Investment.find().sort({ purchaseDate: -1, createdAt: -1 });
    res.json(investments);
  }),
);
router.post(
  "/investments",
  catchAsync(async (req, res) => {
    const investment = await createWithId(Investment, req.body);
    res.status(201).json(investment);
  }),
);
router.put(
  "/investments/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid investment id" });
    const investment = await Investment.findOneAndUpdate({ id }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!investment) return res.status(404).json({ error: "Investment not found" });
    res.json(investment);
  }),
);
router.delete(
  "/investments/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid investment id" });
    const investment = await Investment.findOne({ id });
    if (!investment) return res.status(404).json({ error: "Investment not found" });
    await investment.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/investment-transactions",
  catchAsync(async (req, res) => {
    const transactions = await InvestmentTransaction.find().sort({ date: -1, createdAt: -1 });
    res.json(transactions);
  }),
);
router.post(
  "/investment-transactions",
  catchAsync(async (req, res) => {
    const investmentId = toNumericId(req.body.investmentId);
    const amount = Number(req.body.amount);
    if (investmentId == null || !(await Investment.exists({ id: investmentId }))) {
      return res.status(400).json({ error: "Investment must exist" });
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: "Transaction amount is invalid" });
    }
    const transaction = await createWithId(InvestmentTransaction, {
      ...req.body,
      investmentId,
      amount,
    });
    res.status(201).json(transaction);
  }),
);
router.delete(
  "/investment-transactions/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid investment transaction id" });
    const transaction = await InvestmentTransaction.findOne({ id });
    if (!transaction) return res.status(404).json({ error: "Investment transaction not found" });
    await transaction.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/insurance",
  catchAsync(async (req, res) => {
    const policies = await InsurancePolicy.find().sort({ createdAt: -1 });
    res.json(policies);
  }),
);
router.post(
  "/insurance",
  catchAsync(async (req, res) => {
    const policy = await createWithId(InsurancePolicy, req.body);
    res.status(201).json(policy);
  }),
);
router.get(
  "/insurance/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid insurance policy id" });
    const policy = await InsurancePolicy.findOne({ id });
    if (!policy) return res.status(404).json({ error: "Insurance policy not found" });
    res.json(policy);
  }),
);
router.put(
  "/insurance/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid insurance policy id" });
    const updates = { ...req.body };
    if (Array.isArray(req.body.premiumPayments)) {
      updates.premiumPayments = req.body.premiumPayments.map((payment) => ({
        ...(payment.id != null ? { id: Number(payment.id) } : {}),
        date: payment.date,
        amount: Number(payment.amount),
        ...(payment.note ? { note: payment.note } : {}),
      }));
    }
    const policy = await InsurancePolicy.findOneAndUpdate(
      { id },
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!policy) return res.status(404).json({ error: "Insurance policy not found" });
    res.json(policy);
  }),
);
router.delete(
  "/insurance/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid insurance policy id" });
    const policy = await InsurancePolicy.findOne({ id });
    if (!policy) return res.status(404).json({ error: "Insurance policy not found" });
    await policy.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/budget-rules",
  catchAsync(async (req, res) => {
    const rules = await BudgetRule.find().sort({ createdAt: -1 });
    res.json(rules);
  }),
);
router.post(
  "/budget-rules",
  catchAsync(async (req, res) => {
    const rule = await createWithId(BudgetRule, req.body);
    res.status(201).json(rule);
  }),
);
router.put(
  "/budget-rules/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid budget rule id" });
    const rule = await BudgetRule.findOneAndUpdate({ id }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!rule) return res.status(404).json({ error: "Budget rule not found" });
    res.json(rule);
  }),
);
router.delete(
  "/budget-rules/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid budget rule id" });
    const rule = await BudgetRule.findOne({ id });
    if (!rule) return res.status(404).json({ error: "Budget rule not found" });
    await rule.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/auto-categorize-rules",
  catchAsync(async (req, res) => {
    const rules = await AutoCategorizeRule.find().sort({ createdAt: -1 });
    res.json(rules);
  }),
);
router.get(
  "/net-worth-snapshots",
  catchAsync(async (req, res) => {
    const snapshots = await NetWorthSnapshot.find().sort({ date: 1 });
    res.json(snapshots);
  }),
);
router.post(
  "/net-worth-snapshots",
  catchAsync(async (req, res) => {
    const date = String(req.body.date ?? "");
    const assets = Number(req.body.assets);
    const liabilities = Number(req.body.liabilities);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || ![assets, liabilities].every(Number.isFinite)) {
      return res.status(400).json({ error: "Snapshot date and amounts are invalid" });
    }
    const values = { date, assets, liabilities, netWorth: assets - liabilities };
    let snapshot = await NetWorthSnapshot.findOne({ date });
    if (snapshot) {
      Object.assign(snapshot, values);
      await snapshot.save();
    } else {
      snapshot = await createWithId(NetWorthSnapshot, values);
    }
    res.status(201).json(snapshot);
  }),
);
router.post(
  "/auto-categorize-rules",
  catchAsync(async (req, res) => {
    const rule = await createWithId(AutoCategorizeRule, req.body);
    res.status(201).json(rule);
  }),
);
router.put(
  "/auto-categorize-rules/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid auto-categorize rule id" });
    const rule = await AutoCategorizeRule.findOneAndUpdate({ id }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!rule) return res.status(404).json({ error: "Auto-categorize rule not found" });
    res.json(rule);
  }),
);
router.delete(
  "/auto-categorize-rules/:id",
  catchAsync(async (req, res) => {
    const id = toNumericId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid auto-categorize rule id" });
    const rule = await AutoCategorizeRule.findOne({ id });
    if (!rule) return res.status(404).json({ error: "Auto-categorize rule not found" });
    await rule.deleteOne();
    res.json({ success: true });
  }),
);
export default router;
