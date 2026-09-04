import crypto from "crypto";
import express from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import {
  User,
  Card,
  Category,
  Expense,
  Payment,
  Transfer,
  Beneficiary,
  Bill,
  Loan,
  SavingsGoal,
  SavingsContribution,
  Income,
  RewardPoints,
  Investment,
  InsurancePolicy,
  BudgetRule,
  AutoCategorizeRule,
  NetWorthSnapshot,
  InvestmentTransaction,
  Household,
} from "./models.js";
const router = express.Router();
// Brute-force protection: caps login/signup attempts per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});
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
const toRecordId = (value) => (mongoose.Types.ObjectId.isValid(value) ? String(value) : undefined);
router.use(
  catchAsync(async (req, res, next) => {
    if (req.path === "/health" || req.path.startsWith("/auth")) {
      return next();
    }
    const token = getAuthToken(req);
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    // actualUserId is the real logged-in identity; userId is the "effective" data owner and is
    // redirected to a household's owner below when the caller is an active shared member -
    // every existing route already scopes by req.user.userId, so no other route needs to change.
    payload.actualUserId = payload.userId;
    const household = await Household.findOne({
      "members.userId": payload.userId,
      "members.status": "active",
    });
    if (household) {
      payload.userId = household.ownerUserId;
    }
    req.user = payload;
    return next();
  }),
);
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
  authLimiter,
  catchAsync(async (req, res) => {
    const username = String(req.body?.username ?? "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password ?? "");
    const fullName = String(req.body?.fullName ?? "User").trim();
    const emailInput = String(req.body?.email ?? "")
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9_.-]{3,32}$/i.test(username)) {
      return res.status(400).json({
        error:
          "Username must be 3-32 characters using letters, numbers, dots, underscores, or hyphens.",
      });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }
    if (emailInput && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      return res.status(400).json({ error: "Email address is not valid." });
    }
    if (await User.findOne({ username })) {
      return res.status(409).json({ error: "Username is already taken." });
    }
    if (emailInput && (await User.findOne({ email: emailInput }))) {
      return res.status(409).json({ error: "Email is already registered." });
    }
    const { salt, hash } = hashPassword(password);
    const user = await User.create({
      username,
      fullName: fullName || "User",
      ...(emailInput ? { email: emailInput } : {}),
      role: "user",
      passwordHash: hash,
      passwordSalt: salt,
    });
    const sessionToken = signToken({
      sub: user.username,
      userId: user._id.toString(),
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
  authLimiter,
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
      userId: user._id.toString(),
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
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
});
router.post("/auth/logout", (req, res) => {
  res.setHeader("Set-Cookie", "budget_tracker_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return res.json({ success: true });
});
// Fields clients must never be able to set directly on create/update payloads.
const PROTECTED_FIELDS = ["_id", "id", "userId", "createdAt", "updatedAt", "__v"];
function stripProtectedFields(body) {
  const clean = { ...body };
  for (const field of PROTECTED_FIELDS) delete clean[field];
  return clean;
}
async function createWithId(model, data, userId) {
  const clean = stripProtectedFields(data);
  if (userId) {
    clean.userId = userId;
  }
  return model.create(clean);
}
// Optional ?limit=&skip= support on list endpoints; no-op (returns full result set) when omitted.
function withPagination(query, req) {
  const limit = Number(req.query.limit);
  const skip = Number(req.query.skip);
  if (Number.isFinite(limit) && limit > 0) query.limit(Math.min(Math.floor(limit), 1000));
  if (Number.isFinite(skip) && skip > 0) query.skip(Math.floor(skip));
  return query;
}
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});
router.get(
  "/cards",
  catchAsync(async (req, res) => {
    const cards = await withPagination(
      Card.find({ userId: req.user.userId }).sort({ createdAt: -1 }),
      req,
    );
    res.json(cards);
  }),
);
router.post(
  "/cards",
  catchAsync(async (req, res) => {
    const card = await createWithId(Card, req.body, req.user.userId);
    res.status(201).json(card);
  }),
);
router.get(
  "/cards/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid card id" });
    const card = await Card.findOne({ _id: id, userId: req.user.userId });
    if (!card) return res.status(404).json({ error: "Card not found" });
    res.json(card);
  }),
);
router.put(
  "/cards/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid card id" });
    const card = await Card.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      stripProtectedFields(req.body),
      { new: true, runValidators: true },
    );
    if (!card) return res.status(404).json({ error: "Card not found" });
    res.json(card);
  }),
);
router.delete(
  "/cards/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid card id" });
    const card = await Card.findOne({ _id: id, userId: req.user.userId });
    if (!card) return res.status(404).json({ error: "Card not found" });
    await Expense.deleteMany({ userId: req.user.userId, cardId: id });
    await Payment.deleteMany({ userId: req.user.userId, cardId: id });
    await RewardPoints.deleteMany({ userId: req.user.userId, cardId: id });
    await Transfer.deleteMany({
      userId: req.user.userId,
      $or: [{ fromAccountId: id }, { toAccountId: id }],
    });
    await card.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/categories",
  catchAsync(async (req, res) => {
    const categories = await withPagination(
      Category.find({ userId: req.user.userId }).sort({ createdAt: -1 }),
      req,
    );
    res.json(categories);
  }),
);
router.post(
  "/categories",
  catchAsync(async (req, res) => {
    const category = await createWithId(Category, req.body, req.user.userId);
    res.status(201).json(category);
  }),
);
router.get(
  "/categories/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid category id" });
    const category = await Category.findOne({ _id: id, userId: req.user.userId });
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  }),
);
router.put(
  "/categories/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid category id" });
    const category = await Category.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      stripProtectedFields(req.body),
      { new: true, runValidators: true },
    );
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  }),
);
router.delete(
  "/categories/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid category id" });
    const category = await Category.findOne({ _id: id, userId: req.user.userId });
    if (!category) return res.status(404).json({ error: "Category not found" });
    await Expense.updateMany(
      { userId: req.user.userId, categoryId: id },
      { $unset: { categoryId: "" } },
    );
    await category.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/expenses",
  catchAsync(async (req, res) => {
    const filter = { userId: req.user.userId };
    if (req.query.cardId) {
      const cardId = toRecordId(req.query.cardId);
      if (cardId != null) filter.cardId = cardId;
    }
    if (req.query.categoryId) {
      const categoryId = toRecordId(req.query.categoryId);
      if (categoryId != null) filter.categoryId = categoryId;
    }
    if (req.query.recurringTemplateId) {
      const recurringTemplateId = toRecordId(req.query.recurringTemplateId);
      if (recurringTemplateId != null) filter.recurringTemplateId = recurringTemplateId;
    }
    if (req.query.isRecurringInstance !== undefined) {
      filter.isRecurringInstance = req.query.isRecurringInstance === "true";
    }
    const expenses = await withPagination(
      Expense.find(filter).sort({ date: -1, createdAt: -1 }),
      req,
    );
    res.json(expenses);
  }),
);
router.post(
  "/expenses",
  catchAsync(async (req, res) => {
    const cardId = toRecordId(req.body.cardId);
    const categoryId = req.body.categoryId == null ? undefined : toRecordId(req.body.categoryId);
    if (cardId == null || !(await Card.exists({ _id: cardId, userId: req.user.userId }))) {
      return res.status(400).json({ error: "Expense account must exist" });
    }
    if (
      req.body.categoryId != null &&
      (categoryId == null || !(await Category.exists({ _id: categoryId, userId: req.user.userId })))
    ) {
      return res.status(400).json({ error: "Expense category must exist" });
    }
    const expense = await createWithId(Expense, req.body, req.user.userId);
    res.status(201).json(expense);
  }),
);
router.get(
  "/expenses/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid expense id" });
    const expense = await Expense.findOne({ _id: id, userId: req.user.userId });
    if (!expense) return res.status(404).json({ error: "Expense not found" });
    res.json(expense);
  }),
);
router.put(
  "/expenses/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid expense id" });
    const expense = await Expense.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      stripProtectedFields(req.body),
      { new: true, runValidators: true },
    );
    if (!expense) return res.status(404).json({ error: "Expense not found" });
    res.json(expense);
  }),
);
router.delete(
  "/expenses/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid expense id" });
    const expense = await Expense.findOne({ _id: id, userId: req.user.userId });
    if (!expense) return res.status(404).json({ error: "Expense not found" });
    await expense.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/payments",
  catchAsync(async (req, res) => {
    const filter = { userId: req.user.userId };
    if (req.query.cardId) {
      const cardId = toRecordId(req.query.cardId);
      if (cardId != null) filter.cardId = cardId;
    }
    const payments = await withPagination(
      Payment.find(filter).sort({ date: -1, createdAt: -1 }),
      req,
    );
    res.json(payments);
  }),
);
router.post(
  "/payments",
  catchAsync(async (req, res) => {
    const cardId = toRecordId(req.body.cardId);
    if (cardId == null || !(await Card.exists({ _id: cardId, userId: req.user.userId }))) {
      return res.status(400).json({ error: "Payment account must exist" });
    }
    const payment = await createWithId(Payment, req.body, req.user.userId);
    res.status(201).json(payment);
  }),
);
router.get(
  "/payments/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid payment id" });
    const payment = await Payment.findOne({ _id: id, userId: req.user.userId });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    res.json(payment);
  }),
);
router.put(
  "/payments/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid payment id" });
    const payment = await Payment.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      stripProtectedFields(req.body),
      { new: true, runValidators: true },
    );
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    res.json(payment);
  }),
);
router.delete(
  "/payments/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid payment id" });
    const payment = await Payment.findOne({ _id: id, userId: req.user.userId });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    await payment.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/transfers",
  catchAsync(async (req, res) => {
    const transfers = await withPagination(
      Transfer.find({ userId: req.user.userId }).sort({
        date: -1,
        createdAt: -1,
      }),
      req,
    );
    res.json(transfers);
  }),
);
router.get(
  "/beneficiaries",
  catchAsync(async (req, res) => {
    const beneficiaries = await Beneficiary.find({ userId: req.user.userId }).sort({ name: 1 });
    res.json(beneficiaries);
  }),
);
router.post(
  "/beneficiaries",
  catchAsync(async (req, res) => {
    if (!req.body.name?.trim())
      return res.status(400).json({ error: "Beneficiary name is required" });
    const beneficiary = await createWithId(Beneficiary, req.body, req.user.userId);
    res.status(201).json(beneficiary);
  }),
);
router.put(
  "/beneficiaries/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid beneficiary id" });
    const beneficiary = await Beneficiary.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      stripProtectedFields(req.body),
      { new: true, runValidators: true },
    );
    if (!beneficiary) return res.status(404).json({ error: "Beneficiary not found" });
    res.json(beneficiary);
  }),
);
router.delete(
  "/beneficiaries/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid beneficiary id" });
    const beneficiary = await Beneficiary.findOneAndDelete({ _id: id, userId: req.user.userId });
    if (!beneficiary) return res.status(404).json({ error: "Beneficiary not found" });
    res.json({ success: true });
  }),
);
router.post(
  "/transfers",
  catchAsync(async (req, res) => {
    const fromAccountId = toRecordId(req.body.fromAccountId);
    const toAccountId = toRecordId(req.body.toAccountId);
    const amount = Number(req.body.amount);
    const isExternal = req.body.destinationType === "external";
    if (
      fromAccountId == null ||
      (!isExternal && (toAccountId == null || fromAccountId === toAccountId))
    ) {
      return res.status(400).json({ error: "Select a valid source and destination" });
    }
    if (isExternal && !req.body.externalName?.trim()) {
      return res.status(400).json({ error: "Enter the external recipient name" });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Transfer amount must be greater than zero" });
    }
    const [source, destination] = await Promise.all([
      Card.findOne({ _id: fromAccountId, userId: req.user.userId }),
      isExternal ? null : Card.findOne({ _id: toAccountId, userId: req.user.userId }),
    ]);
    if (!source || (!isExternal && !destination)) {
      return res.status(400).json({ error: "Source and destination accounts must exist" });
    }
    const transfer = await createWithId(
      Transfer,
      {
        ...req.body,
        fromAccountId,
        toAccountId,
        amount,
      },
      req.user.userId,
    );
    res.status(201).json(transfer);
  }),
);
router.delete(
  "/transfers/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid transfer id" });
    const transfer = await Transfer.findOne({ _id: id, userId: req.user.userId });
    if (!transfer) return res.status(404).json({ error: "Transfer not found" });
    await transfer.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/bills",
  catchAsync(async (req, res) => {
    const bills = await withPagination(
      Bill.find({ userId: req.user.userId }).sort({ dueDate: 1, createdAt: -1 }),
      req,
    );
    res.json(bills);
  }),
);
router.post(
  "/bills",
  catchAsync(async (req, res) => {
    const bill = await createWithId(Bill, req.body, req.user.userId);
    res.status(201).json(bill);
  }),
);
router.put(
  "/bills/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid bill id" });
    const bill = await Bill.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      stripProtectedFields(req.body),
      { new: true, runValidators: true },
    );
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    res.json(bill);
  }),
);
router.delete(
  "/bills/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid bill id" });
    const bill = await Bill.findOne({ _id: id, userId: req.user.userId });
    if (!bill) return res.status(404).json({ error: "Bill not found" });
    await bill.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/loans",
  catchAsync(async (req, res) => {
    const loans = await withPagination(
      Loan.find({ userId: req.user.userId }).sort({ createdAt: -1 }),
      req,
    );
    res.json(loans);
  }),
);
router.post(
  "/loans",
  catchAsync(async (req, res) => {
    const loan = await createWithId(Loan, req.body, req.user.userId);
    res.status(201).json(loan);
  }),
);
router.get(
  "/loans/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid loan id" });
    const loan = await Loan.findOne({ _id: id, userId: req.user.userId });
    if (!loan) return res.status(404).json({ error: "Loan not found" });
    res.json(loan);
  }),
);
router.put(
  "/loans/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid loan id" });
    const updates = stripProtectedFields(req.body);
    if (Array.isArray(req.body.repayments)) {
      updates.repayments = req.body.repayments.map((repayment) => ({
        paymentNumber: Number(repayment.paymentNumber),
        paid: Boolean(repayment.paid),
        ...(repayment.paidDate ? { paidDate: repayment.paidDate } : {}),
        ...(repayment.note ? { note: repayment.note } : {}),
        ...(repayment.paymentType ? { paymentType: repayment.paymentType } : {}),
        ...(repayment.paymentReference ? { paymentReference: repayment.paymentReference } : {}),
      }));
    }
    const loan = await Loan.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
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
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid loan id" });
    const loan = await Loan.findOne({ _id: id, userId: req.user.userId });
    if (!loan) return res.status(404).json({ error: "Loan not found" });
    await loan.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/savings-goals",
  catchAsync(async (req, res) => {
    const goals = await withPagination(
      SavingsGoal.find({ userId: req.user.userId }).sort({ createdAt: -1 }),
      req,
    );
    res.json(goals);
  }),
);
router.post(
  "/savings-goals",
  catchAsync(async (req, res) => {
    const goal = await createWithId(SavingsGoal, req.body, req.user.userId);
    res.status(201).json(goal);
  }),
);
router.get(
  "/savings-goals/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid savings goal id" });
    const goal = await SavingsGoal.findOne({ _id: id, userId: req.user.userId });
    if (!goal) return res.status(404).json({ error: "Savings goal not found" });
    res.json(goal);
  }),
);
router.put(
  "/savings-goals/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid savings goal id" });
    const goal = await SavingsGoal.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      stripProtectedFields(req.body),
      { new: true, runValidators: true },
    );
    if (!goal) return res.status(404).json({ error: "Savings goal not found" });
    res.json(goal);
  }),
);
router.delete(
  "/savings-goals/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid savings goal id" });
    const goal = await SavingsGoal.findOne({ _id: id, userId: req.user.userId });
    if (!goal) return res.status(404).json({ error: "Savings goal not found" });
    await goal.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/savings-goals/:id/contributions",
  catchAsync(async (req, res) => {
    const goalId = toRecordId(req.params.id);
    if (goalId == null) return res.status(400).json({ error: "Invalid savings goal id" });
    const goal = await SavingsGoal.findOne({ _id: goalId, userId: req.user.userId });
    if (!goal) return res.status(404).json({ error: "Savings goal not found" });
    const contributions = await SavingsContribution.find({ goalId, userId: req.user.userId }).sort({
      date: -1,
    });
    res.json(contributions);
  }),
);
router.post(
  "/savings-goals/:id/contributions",
  catchAsync(async (req, res) => {
    const goalId = toRecordId(req.params.id);
    const amount = Number(req.body.amount);
    if (goalId == null || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Enter a valid positive contribution" });
    }
    const goal = await SavingsGoal.findOne({ _id: goalId, userId: req.user.userId });
    if (!goal) return res.status(404).json({ error: "Savings goal not found" });
    const contribution = await createWithId(
      SavingsContribution,
      { ...req.body, goalId, amount },
      req.user.userId,
    );
    goal.currentAmount = Number(goal.currentAmount) + amount;
    await goal.save();
    res.status(201).json(contribution);
  }),
);
router.delete(
  "/savings-goals/:goalId/contributions/:id",
  catchAsync(async (req, res) => {
    const goalId = toRecordId(req.params.goalId);
    const id = toRecordId(req.params.id);
    if (goalId == null || id == null)
      return res.status(400).json({ error: "Invalid contribution id" });
    const contribution = await SavingsContribution.findOne({
      _id: id,
      goalId,
      userId: req.user.userId,
    });
    if (!contribution) return res.status(404).json({ error: "Contribution not found" });
    const goal = await SavingsGoal.findOne({ _id: goalId, userId: req.user.userId });
    if (!goal) return res.status(404).json({ error: "Savings goal not found" });
    await contribution.deleteOne();
    goal.currentAmount = Math.max(0, Number(goal.currentAmount) - Number(contribution.amount));
    await goal.save();
    res.json({ success: true });
  }),
);
router.get(
  "/income",
  catchAsync(async (req, res) => {
    const filter = { userId: req.user.userId };
    if (req.query.accountId) {
      const accountId = toRecordId(req.query.accountId);
      if (accountId != null) filter.accountId = accountId;
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.recurringTemplateId) {
      const recurringTemplateId = toRecordId(req.query.recurringTemplateId);
      if (recurringTemplateId != null) filter.recurringTemplateId = recurringTemplateId;
    }
    if (req.query.isRecurringInstance !== undefined) {
      filter.isRecurringInstance = req.query.isRecurringInstance === "true";
    }
    const income = await withPagination(Income.find(filter).sort({ date: -1, createdAt: -1 }), req);
    res.json(income);
  }),
);
router.post(
  "/income",
  catchAsync(async (req, res) => {
    if (req.body.accountId != null) {
      const accountId = toRecordId(req.body.accountId);
      if (accountId == null || !(await Card.exists({ _id: accountId, userId: req.user.userId }))) {
        return res.status(400).json({ error: "Income account must exist" });
      }
    }
    const income = await createWithId(Income, req.body, req.user.userId);
    res.status(201).json(income);
  }),
);
router.get(
  "/income/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid income id" });
    const income = await Income.findOne({ _id: id, userId: req.user.userId });
    if (!income) return res.status(404).json({ error: "Income not found" });
    res.json(income);
  }),
);
router.put(
  "/income/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid income id" });
    const income = await Income.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      stripProtectedFields(req.body),
      { new: true, runValidators: true },
    );
    if (!income) return res.status(404).json({ error: "Income not found" });
    res.json(income);
  }),
);
router.delete(
  "/income/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid income id" });
    const income = await Income.findOne({ _id: id, userId: req.user.userId });
    if (!income) return res.status(404).json({ error: "Income not found" });
    await income.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/reward-points",
  catchAsync(async (req, res) => {
    const filter = { userId: req.user.userId };
    if (req.query.cardId) {
      const cardId = toRecordId(req.query.cardId);
      if (cardId != null) filter.cardId = cardId;
    }
    const entries = await withPagination(
      RewardPoints.find(filter).sort({ date: -1, createdAt: -1 }),
      req,
    );
    res.json(entries);
  }),
);
router.post(
  "/reward-points",
  catchAsync(async (req, res) => {
    const entry = await createWithId(RewardPoints, req.body, req.user.userId);
    res.status(201).json(entry);
  }),
);
router.put(
  "/reward-points/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid reward points id" });
    const entry = await RewardPoints.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      stripProtectedFields(req.body),
      { new: true, runValidators: true },
    );
    if (!entry) return res.status(404).json({ error: "Reward points entry not found" });
    res.json(entry);
  }),
);
router.delete(
  "/reward-points/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid reward points id" });
    const entry = await RewardPoints.findOne({ _id: id, userId: req.user.userId });
    if (!entry) return res.status(404).json({ error: "Reward points entry not found" });
    await entry.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/investments",
  catchAsync(async (req, res) => {
    const investments = await withPagination(
      Investment.find({ userId: req.user.userId }).sort({
        purchaseDate: -1,
        createdAt: -1,
      }),
      req,
    );
    res.json(investments);
  }),
);
router.post(
  "/investments",
  catchAsync(async (req, res) => {
    const name = String(req.body.name ?? "").trim();
    const platform = String(req.body.platform ?? "").trim();
    const duplicate = await Investment.exists({
      userId: req.user.userId,
      name,
      platform,
    }).collation({ locale: "en", strength: 2 });
    if (duplicate) {
      return res
        .status(409)
        .json({ error: "An investment with this name already exists on this platform" });
    }
    const investment = await createWithId(Investment, req.body, req.user.userId);
    res.status(201).json(investment);
  }),
);
router.put(
  "/investments/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid investment id" });
    const currentInvestment = await Investment.findOne({ _id: id, userId: req.user.userId });
    if (!currentInvestment) return res.status(404).json({ error: "Investment not found" });
    const name = String(req.body.name ?? currentInvestment.name).trim();
    const platform = String(req.body.platform ?? currentInvestment.platform).trim();
    const duplicate = await Investment.exists({
      userId: req.user.userId,
      name,
      platform,
      _id: { $ne: id },
    }).collation({ locale: "en", strength: 2 });
    if (duplicate) {
      return res
        .status(409)
        .json({ error: "An investment with this name already exists on this platform" });
    }
    const investment = await Investment.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      stripProtectedFields(req.body),
      { new: true, runValidators: true },
    );
    res.json(investment);
  }),
);
router.delete(
  "/investments/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid investment id" });
    const investment = await Investment.findOne({ _id: id, userId: req.user.userId });
    if (!investment) return res.status(404).json({ error: "Investment not found" });
    await investment.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/investment-transactions",
  catchAsync(async (req, res) => {
    const transactions = await withPagination(
      InvestmentTransaction.find({ userId: req.user.userId }).sort({
        date: -1,
        createdAt: -1,
      }),
      req,
    );
    res.json(transactions);
  }),
);
router.post(
  "/investment-transactions",
  catchAsync(async (req, res) => {
    const investmentId = toRecordId(req.body.investmentId);
    const amount = Number(req.body.amount);
    if (
      investmentId == null ||
      !(await Investment.exists({ _id: investmentId, userId: req.user.userId }))
    ) {
      return res.status(400).json({ error: "Investment must exist" });
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: "Transaction amount is invalid" });
    }
    const transaction = await createWithId(
      InvestmentTransaction,
      {
        ...req.body,
        investmentId,
        amount,
      },
      req.user.userId,
    );
    res.status(201).json(transaction);
  }),
);
router.delete(
  "/investment-transactions/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid investment transaction id" });
    const transaction = await InvestmentTransaction.findOne({ _id: id, userId: req.user.userId });
    if (!transaction) return res.status(404).json({ error: "Investment transaction not found" });
    await transaction.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/insurance",
  catchAsync(async (req, res) => {
    const policies = await withPagination(
      InsurancePolicy.find({ userId: req.user.userId }).sort({
        createdAt: -1,
      }),
      req,
    );
    res.json(policies);
  }),
);
router.post(
  "/insurance",
  catchAsync(async (req, res) => {
    const policy = await createWithId(InsurancePolicy, req.body, req.user.userId);
    res.status(201).json(policy);
  }),
);
router.get(
  "/insurance/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid insurance policy id" });
    const policy = await InsurancePolicy.findOne({ _id: id, userId: req.user.userId });
    if (!policy) return res.status(404).json({ error: "Insurance policy not found" });
    res.json(policy);
  }),
);
router.put(
  "/insurance/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid insurance policy id" });
    const updates = stripProtectedFields(req.body);
    if (Array.isArray(req.body.premiumPayments)) {
      updates.premiumPayments = req.body.premiumPayments.map((payment) => ({
        ...(payment.id != null && mongoose.Types.ObjectId.isValid(payment.id)
          ? { _id: payment.id }
          : {}),
        date: payment.date,
        amount: Number(payment.amount),
        paymentType: payment.paymentType,
        ...(payment.paymentSource ? { paymentSource: payment.paymentSource } : {}),
        ...(payment.note ? { note: payment.note } : {}),
      }));
    }
    const policy = await InsurancePolicy.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
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
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid insurance policy id" });
    const policy = await InsurancePolicy.findOne({ _id: id, userId: req.user.userId });
    if (!policy) return res.status(404).json({ error: "Insurance policy not found" });
    await policy.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/budget-rules",
  catchAsync(async (req, res) => {
    const rules = await withPagination(
      BudgetRule.find({ userId: req.user.userId }).sort({ createdAt: -1 }),
      req,
    );
    res.json(rules);
  }),
);
router.post(
  "/budget-rules",
  catchAsync(async (req, res) => {
    const rule = await createWithId(BudgetRule, req.body, req.user.userId);
    res.status(201).json(rule);
  }),
);
router.put(
  "/budget-rules/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid budget rule id" });
    const rule = await BudgetRule.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      stripProtectedFields(req.body),
      { new: true, runValidators: true },
    );
    if (!rule) return res.status(404).json({ error: "Budget rule not found" });
    res.json(rule);
  }),
);
router.delete(
  "/budget-rules/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid budget rule id" });
    const rule = await BudgetRule.findOne({ _id: id, userId: req.user.userId });
    if (!rule) return res.status(404).json({ error: "Budget rule not found" });
    await rule.deleteOne();
    res.json({ success: true });
  }),
);
router.get(
  "/auto-categorize-rules",
  catchAsync(async (req, res) => {
    const rules = await withPagination(
      AutoCategorizeRule.find({ userId: req.user.userId }).sort({
        createdAt: -1,
      }),
      req,
    );
    res.json(rules);
  }),
);
router.get(
  "/net-worth-snapshots",
  catchAsync(async (req, res) => {
    const snapshots = await withPagination(
      NetWorthSnapshot.find({ userId: req.user.userId }).sort({ date: 1 }),
      req,
    );
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
    let snapshot = await NetWorthSnapshot.findOne({ date, userId: req.user.userId });
    if (snapshot) {
      Object.assign(snapshot, values);
      await snapshot.save();
    } else {
      snapshot = await createWithId(NetWorthSnapshot, values, req.user.userId);
    }
    res.status(201).json(snapshot);
  }),
);
router.post(
  "/auto-categorize-rules",
  catchAsync(async (req, res) => {
    const rule = await createWithId(AutoCategorizeRule, req.body, req.user.userId);
    res.status(201).json(rule);
  }),
);
router.put(
  "/auto-categorize-rules/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid auto-categorize rule id" });
    const rule = await AutoCategorizeRule.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      stripProtectedFields(req.body),
      { new: true, runValidators: true },
    );
    if (!rule) return res.status(404).json({ error: "Auto-categorize rule not found" });
    res.json(rule);
  }),
);
router.delete(
  "/auto-categorize-rules/:id",
  catchAsync(async (req, res) => {
    const id = toRecordId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid auto-categorize rule id" });
    const rule = await AutoCategorizeRule.findOne({ _id: id, userId: req.user.userId });
    if (!rule) return res.status(404).json({ error: "Auto-categorize rule not found" });
    await rule.deleteOne();
    res.json({ success: true });
  }),
);
// Household sharing: these use req.user.actualUserId (the real logged-in identity), never the
// possibly-redirected req.user.userId, since managing membership must always act on the caller's
// own account regardless of which household's data they currently have effective access to.
router.get(
  "/household",
  catchAsync(async (req, res) => {
    const owned = await Household.findOne({ ownerUserId: req.user.actualUserId });
    if (owned) return res.json({ role: "owner", household: owned });
    const memberOf = await Household.findOne({
      "members.userId": req.user.actualUserId,
      "members.status": "active",
    });
    if (memberOf) return res.json({ role: "member", household: memberOf });
    res.json({ role: "none", household: null });
  }),
);
router.post(
  "/household/invite",
  catchAsync(async (req, res) => {
    const email = String(req.body?.email ?? "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "A valid email address is required" });
    }
    const alreadyMember = await Household.findOne({
      "members.userId": req.user.actualUserId,
      "members.status": "active",
    });
    if (alreadyMember) {
      return res.status(400).json({ error: "You already belong to someone else's household" });
    }
    let household = await Household.findOne({ ownerUserId: req.user.actualUserId });
    if (household?.members.some((member) => member.email === email)) {
      return res.status(409).json({ error: "That email has already been invited" });
    }
    const inviteToken = crypto.randomBytes(24).toString("hex");
    const newMember = { email, status: "pending", inviteToken, invitedAt: new Date() };
    if (household) {
      household.members.push(newMember);
      await household.save();
    } else {
      household = await Household.create({
        ownerUserId: req.user.actualUserId,
        members: [newMember],
      });
    }
    // No SMTP/email provider is configured in this project - the invite token is returned
    // directly to the owner to share manually instead of being emailed automatically.
    res.status(201).json({ email, inviteToken });
  }),
);
router.post(
  "/household/accept",
  catchAsync(async (req, res) => {
    const token = String(req.body?.token ?? "");
    if (!token) return res.status(400).json({ error: "Invite token is required" });
    const household = await Household.findOneAndUpdate(
      { "members.inviteToken": token, "members.status": "pending" },
      {
        $set: {
          "members.$.status": "active",
          "members.$.userId": req.user.actualUserId,
          "members.$.joinedAt": new Date(),
          "members.$.inviteToken": null,
        },
      },
      { new: true },
    );
    if (!household) {
      return res.status(404).json({ error: "Invite not found or already used" });
    }
    res.json({ success: true, household });
  }),
);
router.delete(
  "/household/members/:email",
  catchAsync(async (req, res) => {
    const email = String(req.params.email).trim().toLowerCase();
    const household = await Household.findOneAndUpdate(
      { ownerUserId: req.user.actualUserId },
      { $pull: { members: { email } } },
      { new: true },
    );
    if (!household) return res.status(404).json({ error: "Household not found" });
    res.json({ success: true, household });
  }),
);
router.post(
  "/household/leave",
  catchAsync(async (req, res) => {
    const household = await Household.findOneAndUpdate(
      { "members.userId": req.user.actualUserId, "members.status": "active" },
      { $pull: { members: { userId: req.user.actualUserId } } },
      { new: true },
    );
    if (!household) return res.status(404).json({ error: "You are not a member of a household" });
    res.json({ success: true });
  }),
);
export default router;
