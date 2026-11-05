import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, SafeAreaView, ScrollView, Switch, Text, TextInput, View } from "react-native";
import * as Calendar from "expo-calendar";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { acceptHouseholdInvite, fetchHousehold, inviteHouseholdMember, leaveHousehold, login, removeHouseholdMember, signup } from "../api";
import { compareMonthlySpending, getMonthlyExpenseAmount, forecastBudget } from "../calculations";
import { categoryColors, moduleLabels, money } from "./constants";
import { Field, ModuleForm } from "./forms";
import { moduleDescription, promptText } from "./screen-helpers";
import { styles } from "./styles";
import type { AccountOption, Expense, Goal, ModuleItem, ModuleKey, Screen } from "./types";

function getExpenseDate(dateValue: string): Date | undefined {
  const normalized = dateValue.trim();
  if (/^today$/i.test(normalized)) return new Date();
  if (/^yesterday$/i.test(normalized)) return new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (/^(just now|now)$/i.test(normalized)) return new Date();

  const directDate = new Date(normalized);
  if (!Number.isNaN(directDate.getTime())) return directDate;

  const monthDate = normalized.match(/^(?:(\d{1,2})\s+)?([a-z]{3,})$/i);
  if (!monthDate) return undefined;
  const monthIndex = new Date(`${monthDate[2]} 1, 2000`).getMonth();
  if (Number.isNaN(monthIndex)) return undefined;
  const day = monthDate[1] ? Number(monthDate[1]) : 1;
  const now = new Date();
  return new Date(now.getFullYear(), monthIndex, day);
}

function getYearlySpending(expenses: Expense[], now = new Date()) {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    const amount = expenses.reduce((sum, expense) => {
      const expenseDate = getExpenseDate(expense.date);
      return expenseDate?.getFullYear() === date.getFullYear() &&
        expenseDate.getMonth() === date.getMonth()
        ? sum + expense.amount
        : sum;
    }, 0);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleString("en-US", { month: "short" }),
      yearLabel: date.getMonth() === 0 ? String(date.getFullYear()).slice(-2) : "",
      amount,
    };
  });
}

function YearlySpendingChart({
  expenses,
  darkMode,
}: {
  expenses: Expense[];
  darkMode: boolean;
}) {
  const monthlyData = getYearlySpending(expenses);
  const maxAmount = Math.max(...monthlyData.map((item) => item.amount), 1);
  const total = monthlyData.reduce((sum, item) => sum + item.amount, 0);
  return (
    <View style={[styles.chartCard, darkMode && styles.darkSurface]}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={[styles.sectionTitle, darkMode && styles.darkText]}>Spending trend</Text>
          <Text style={darkMode ? styles.darkMuted : styles.muted}>Last 12 months</Text>
        </View>
        <Text style={[styles.chartAmount, darkMode && styles.darkText]}>{money(total)}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.yearChart}>
          {monthlyData.map((item) => (
            <View key={item.key} style={styles.yearChartColumn}>
              <Text style={[styles.yearChartAmount, darkMode && styles.darkMuted]}>
                {item.amount > 0 ? money(item.amount) : ""}
              </Text>
              <View style={[styles.yearChartTrack, darkMode && styles.darkChartTrack]}>
                <View
                  style={[
                    styles.yearChartBar,
                    { height: `${Math.max(4, (item.amount / maxAmount) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, darkMode && styles.darkMuted]}>{item.label}</Text>
              <Text style={[styles.yearLabel, darkMode && styles.darkMuted]}>{item.yearLabel}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={[styles.chartLegend, darkMode && styles.darkBorder]}>
        <Text style={darkMode ? styles.darkMuted : styles.muted}>Total recorded spending</Text>
        <Text style={[styles.chartAmount, darkMode && styles.darkText]}>{money(total)}</Text>
      </View>
    </View>
  );
}

export function Dashboard({ darkMode, expenses, goals, onRefresh, refreshing, onAddExpense, onVoiceExpense, onReceipt, onOpenExpenses, onOpenGoals, onNavigate }: { darkMode: boolean; expenses: Expense[]; goals: Goal[]; onRefresh: () => Promise<void>; refreshing: boolean; onAddExpense: () => void; onVoiceExpense: () => void; onReceipt: () => void; onOpenExpenses: () => void; onOpenGoals: () => void; onNavigate: (screen: Screen) => void }) {
  const spent = expenses.reduce((sum, expense) => sum + getMonthlyExpenseAmount({ amount: expense.amount, date: expense.date, isEmi: expense.isEmi, emiMonths: expense.months }, new Date()), 0);
  const monthlyComparison = compareMonthlySpending(expenses);
  return <ScrollView contentContainerStyle={[styles.scroll, darkMode && styles.darkScroll]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} colors={["#0f766e"]} />}>
    <View style={styles.monthRow}><View><Text style={[styles.monthLabel, darkMode && styles.darkText]}>{new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}</Text><Text style={styles.muted}>Monthly overview</Text></View><Pressable style={[styles.monthButton, darkMode && styles.darkControl]}><Text style={[styles.monthButtonText, darkMode && styles.darkText]}>This month⌄</Text></Pressable></View>
    <View style={styles.balanceCard}><View style={styles.balanceGlowOne} /><View style={styles.balanceGlowTwo} /><View style={styles.balanceCardContent}><View><Text style={styles.cardOverline}>TOTAL BALANCE</Text><Text style={styles.balance}>{money(184250)}</Text><Text style={styles.positive}>{monthlyComparison.changePercent >= 0 ? "↑" : "↓"} {Math.abs(monthlyComparison.changePercent).toFixed(1)}% spending vs last month</Text></View><View style={styles.balanceRing}><Text style={styles.ringValue}>68%</Text><Text style={styles.ringLabel}>saved</Text></View></View></View>
    <View style={styles.statsRow}><Stat label="Income" value={money(275000)} color="#0f766e" icon="↗" /><Stat label="Spent" value={money(spent)} color="#c65353" icon="↘" /><Stat label="Left to spend" value={money(Math.max(0, 90000 - spent))} color="#2563eb" icon="◌" /></View>
    <SectionHeader title="Yearly overview" action="View details" onPress={onOpenExpenses} />
    <YearlySpendingChart expenses={expenses} darkMode={darkMode} />
    <SectionHeader title="Budget health" action="Manage budgets" onPress={() => Alert.alert("Budgets", "Budget rules can be managed from the full web app.")} />
    <View style={styles.budgetCard}><BudgetForecastRow title="Food & dining" expenses={expenses} limit={18000} color="#f4b183" /><BudgetForecastRow title="Transport" expenses={expenses} limit={10000} color="#78c7b5" /><BudgetForecastRow title="Shopping" expenses={expenses} limit={15000} color="#a99be8" /></View>
    <SectionHeader title="Recent transactions" action="See all" onPress={onOpenExpenses} />
    <TransactionList expenses={expenses.slice(0, 3)} onSelect={() => {}} />
    <SectionHeader title="Savings goals" action="See all" onPress={onOpenGoals} />
    <View style={styles.goalsPreview}>{goals.slice(0, 2).map((goal) => <GoalMini key={goal.id} goal={goal} />)}</View>
    <View style={styles.quickActions}><Pressable onPress={onAddExpense} style={styles.quickAction}><Text style={styles.quickActionIcon}>＋</Text><Text style={styles.quickActionText}>Expense</Text></Pressable><Pressable onPress={onVoiceExpense} style={[styles.quickAction, styles.voiceQuickAction]}><Text style={styles.quickActionIcon}>◉</Text><Text style={styles.quickActionText}>Voice</Text></Pressable><Pressable onPress={onReceipt} style={[styles.quickAction, styles.receiptQuickAction]}><Text style={styles.quickActionIcon}>▤</Text><Text style={styles.quickActionText}>Receipt</Text></Pressable><Pressable onPress={() => onNavigate("bills")} style={styles.quickAction}><Text style={styles.quickActionIcon}>□</Text><Text style={styles.quickActionText}>Bill</Text></Pressable></View>
  </ScrollView>;
}

export function Expenses({ darkMode, expenses, onRefresh, refreshing, onAdd, onVoice, onReceipt, onSelect }: { darkMode: boolean; expenses: Expense[]; onRefresh: () => Promise<void>; refreshing: boolean; onAdd: () => void; onVoice: () => void; onReceipt: () => void; onSelect: (expense: Expense) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const filtered = expenses.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()) && (filter === "All" || item.category === filter));
  return <ScrollView contentContainerStyle={[styles.scroll, darkMode && styles.darkScroll]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} colors={["#0f766e"]} />}>
    <View style={styles.pageIntroRow}><View><Text style={[styles.pageTitle, darkMode && styles.darkText]}>Your expenses</Text><Text style={styles.muted}>Track every rupee, build better habits.</Text></View><View style={styles.inlineActions}><Pressable onPress={onVoice} style={styles.voiceButton}><Text style={styles.voiceButtonText}>◉ Voice</Text></Pressable><Pressable onPress={onReceipt} style={styles.receiptButton}><Text style={styles.voiceButtonText}>▤ Scan</Text></Pressable></View></View>
    <View style={[styles.expenseSummary, darkMode && styles.darkExpenseSummary]}><View><Text style={styles.cardOverline}>MATCHING SPENDING</Text><Text style={[styles.summaryAmount, darkMode && styles.darkText]}>{money(filtered.reduce((sum, item) => sum + item.amount, 0))}</Text></View><Text style={[styles.summaryChange, darkMode && styles.darkPositive]}>{filtered.length} transactions</Text></View>
    <View style={[styles.searchBox, darkMode && styles.darkSearchBox]}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search expenses" placeholderTextColor="#95a2b1" style={[styles.searchInput, darkMode && styles.darkInputText]} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{["All", "Food & dining", "Housing", "Transport", "Groceries"].map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filterChip, darkMode && styles.darkFilterChip, filter === item && styles.filterChipActive]}><Text style={[styles.filterText, darkMode && styles.darkMuted, filter === item && styles.filterTextActive]}>{item}</Text></Pressable>)}</ScrollView>
    <View style={styles.listHeader}><Text style={styles.sectionTitle}>{filtered.length} transactions</Text><Pressable onPress={onAdd}><Text style={styles.link}>+ Add</Text></Pressable></View>
    <TransactionList expenses={filtered} onSelect={onSelect} darkMode={darkMode} />
  </ScrollView>;
}

export function Accounts({ darkMode }: { darkMode: boolean }) {
  return <ScrollView contentContainerStyle={[styles.scroll, darkMode && styles.darkScroll]}><View style={styles.pageIntro}><Text style={[styles.pageTitle, darkMode && styles.darkText]}>Accounts & cards</Text><Text style={styles.muted}>All your money in one clear view.</Text></View><View style={styles.netWorthCard}><Text style={styles.cardOverline}>NET WORTH</Text><Text style={styles.netWorth}>{money(438520)}</Text><Text style={styles.positive}>↑ 5.2% this month</Text></View><Text style={[styles.sectionTitle, darkMode && styles.darkText]}>Your accounts</Text><AccountCard title="HDFC Salary Account" type="Bank account" amount={money(184250)} icon="H" color="#315ca8" /><AccountCard title="SBI Cashback Card" type="Credit card · 18% used" amount={money(-26480)} icon="S" color="#0f766e" /><AccountCard title="Cash wallet" type="Cash" amount={money(3200)} icon="₹" color="#c27a2c" /><Pressable style={styles.outlineButton} onPress={() => Alert.alert("Add account", "Account setup is available in the full app.")}><Text style={styles.outlineButtonText}>＋ Add account or card</Text></Pressable></ScrollView>;
}

export function Goals({ darkMode, goals, onAdd }: { darkMode: boolean; goals: Goal[]; onAdd: () => void }) {
  return <ScrollView contentContainerStyle={[styles.scroll, darkMode && styles.darkScroll]}><View style={styles.pageIntroRow}><View><Text style={[styles.pageTitle, darkMode && styles.darkText]}>Savings goals</Text><Text style={styles.muted}>Small steps become big milestones.</Text></View><Pressable onPress={onAdd} style={styles.smallAdd}><Text style={styles.smallAddText}>＋</Text></Pressable></View><View style={styles.goalsTotal}><Text style={styles.cardOverline}>TOTAL SAVED</Text><Text style={styles.summaryAmount}>{money(goals.reduce((sum, goal) => sum + goal.saved, 0))}</Text><Text style={styles.muted}>of {money(goals.reduce((sum, goal) => sum + goal.target, 0))} across {goals.length} goals</Text></View>{goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}</ScrollView>;
}

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: { username: string; fullName: string; role: string }) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!username || !password || (mode === "signup" && !fullName)) {
      Alert.alert("Missing details", "Complete the required fields before continuing.");
      return;
    }
    setBusy(true);
    try {
      const user = mode === "login"
        ? await login(username, password)
        : await signup(username, password, fullName, email);
      onAuthenticated(user);
    } catch (error) {
      Alert.alert("Unable to continue", error instanceof Error ? error.message : "The server could not be reached.");
    } finally {
      setBusy(false);
    }
  };
  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled"><Text style={styles.authMark}>◎</Text><Text style={styles.authTitle}>Budget Tracker</Text><Text style={styles.authSubtitle}>Your private financial workspace, wherever you go.</Text><View style={styles.authCard}><View style={styles.authTabs}><Pressable onPress={() => setMode("login")} style={[styles.authTab, mode === "login" && styles.authTabActive]}><Text style={[styles.authTabText, mode === "login" && styles.authTabTextActive]}>Sign in</Text></Pressable><Pressable onPress={() => setMode("signup")} style={[styles.authTab, mode === "signup" && styles.authTabActive]}><Text style={[styles.authTabText, mode === "signup" && styles.authTabTextActive]}>Create account</Text></Pressable></View>{mode === "signup" && <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Alex Morgan" />}{mode === "signup" && <Field label="Email" value={email} onChangeText={setEmail} placeholder="alex@example.com" /> }<Field label="Username" value={username} onChangeText={setUsername} placeholder="Your username" /><Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" /><Pressable style={styles.primaryButton} onPress={() => void submit()} disabled={busy}><Text style={styles.primaryButtonText}>{busy ? "Connecting…" : mode === "login" ? "Sign in securely" : "Create account"}</Text></Pressable></View><Text style={styles.securityText}>Your session uses a signed bearer token and your financial records stay scoped to your account.</Text></ScrollView></SafeAreaView>;
}

export function More({ darkMode, setDarkMode, notificationsEnabled, setNotificationsEnabled, biometricEnabled, setBiometricEnabled, onNavigate, onLogout, onSync, syncing }: { darkMode: boolean; setDarkMode: (value: boolean) => void; notificationsEnabled: boolean; setNotificationsEnabled: (value: boolean) => void; biometricEnabled: boolean; setBiometricEnabled: (value: boolean) => void; onNavigate: (screen: Screen) => void; onLogout: () => void; onSync: () => void; syncing: boolean }) {
  const items: { label: string; detail: string; icon: string; screen: Screen }[] = [
    { label: "Secure Vault", detail: "Passwords, account details, and cards", icon: "⌑", screen: "secureVault" },
    { label: "Nominees & personal records", detail: "Emergency contacts and document references", icon: "♧", screen: "personalRecords" },
    { label: "Bills & subscriptions", detail: "Never miss a payment", icon: "▣", screen: "bills" },
    { label: "Payments", detail: "Credit card payments", icon: "↗", screen: "payments" },
    { label: "Transfers", detail: "Move money between accounts", icon: "⇄", screen: "transfers" },
    { label: "Income", detail: "Salary and other income", icon: "↙", screen: "income" },
    { label: "Loans & insurance", detail: "Repayments and policies", icon: "◈", screen: "loans" },
    { label: "Budget rules", detail: "Thresholds and alerts", icon: "◒", screen: "budgets" },
    { label: "Categories", detail: "Organize your spending", icon: "⌘", screen: "categories" },
    { label: "Investments", detail: "Portfolio and transactions", icon: "↗", screen: "investments" },
    { label: "Rewards", detail: "Track points and redemptions", icon: "✦", screen: "rewards" },
    { label: "Reports & insights", detail: "Visualize your finances", icon: "◒", screen: "visualize" },
    { label: "Calendar", detail: "Upcoming financial events", icon: "□", screen: "calendar" },
    { label: "Reconciliation", detail: "Review account differences", icon: "✓", screen: "reconciliation" },
    { label: "Import / export", detail: "Move your data anytime", icon: "⇩", screen: "import" },
    { label: "Household", detail: "Share with family members", icon: "♧", screen: "household" },
    { label: "Net-worth history", detail: "Track your financial progress", icon: "⌁", screen: "netWorth" },
    { label: "About", detail: "Privacy and app information", icon: "i", screen: "about" },
  ];
  const addCalendarEvent = async () => {
    try {
      const permission = await Calendar.requestCalendarPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Calendar permission needed", "Allow calendar access to add bill reminders.");
        return;
      }
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const calendar = calendars.find((item) => item.allowsModifications);
      if (!calendar) throw new Error("No writable calendar is available.");
      const startDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      startDate.setHours(9, 0, 0, 0);
      await Calendar.createEventAsync(calendar.id, {
        title: "Budget Tracker bill reminder",
        startDate,
        endDate: new Date(startDate.getTime() + 30 * 60 * 1000),
        notes: "Review upcoming bills in Budget Tracker.",
        alarms: [{ relativeOffset: 0 }],
      });
      Alert.alert("Calendar reminder added", "A bill reminder was added for tomorrow.");
    } catch (error) {
      Alert.alert("Could not add calendar reminder", error instanceof Error ? error.message : "Calendar access failed.");
    }
  };
  return <ScrollView contentContainerStyle={styles.scroll}><View style={styles.pageIntro}><Text style={styles.pageTitle}>More</Text><Text style={styles.muted}>Tools to keep your finances organized.</Text></View><Pressable style={styles.syncButton} onPress={onSync}><Text style={styles.syncButtonText}>{syncing ? "Syncing with your account…" : "↻ Sync with web app"}</Text></Pressable><Pressable style={styles.calendarButton} onPress={() => void addCalendarEvent()}><Text style={styles.calendarButtonText}>□ Add bill reminder to calendar</Text></Pressable><View style={styles.moreCard}>{items.map((item) => <Pressable key={item.label} style={styles.moreRow} onPress={() => onNavigate(item.screen)}><View style={styles.moreIcon}><Text style={styles.moreIconText}>{item.icon}</Text></View><View style={styles.moreCopy}><Text style={styles.moreLabel}>{item.label}</Text><Text style={styles.muted}>{item.detail}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}<View style={styles.moreRow}><View style={styles.moreIcon}><Text style={styles.moreIconText}>◐</Text></View><View style={styles.moreCopy}><Text style={styles.moreLabel}>Dark mode</Text><Text style={styles.muted}>Use a darker appearance</Text></View><Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ false: "#d8dee8", true: "#86c9bd" }} thumbColor={darkMode ? "#0f766e" : "#fff"} /></View><View style={styles.moreRow}><View style={styles.moreIcon}><Text style={styles.moreIconText}>♢</Text></View><View style={styles.moreCopy}><Text style={styles.moreLabel}>Device notifications</Text><Text style={styles.muted}>Receive alerts outside the app</Text></View><Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ false: "#d8dee8", true: "#86c9bd" }} thumbColor={notificationsEnabled ? "#0f766e" : "#fff"} /></View><View style={styles.moreRow}><View style={styles.moreIcon}><Text style={styles.moreIconText}>◉</Text></View><View style={styles.moreCopy}><Text style={styles.moreLabel}>Biometric app lock</Text><Text style={styles.muted}>Protect your financial data on this device</Text></View><Switch value={biometricEnabled} onValueChange={setBiometricEnabled} trackColor={{ false: "#d8dee8", true: "#86c9bd" }} thumbColor={biometricEnabled ? "#0f766e" : "#fff"} /></View></View><Pressable style={styles.signOutButton} onPress={onLogout}><Text style={styles.signOutText}>Sign out securely</Text></Pressable><View style={styles.privacy}><Text style={styles.privacyTitle}>Private by design</Text><Text style={styles.muted}>Your data stays yours. Budget Tracker does not read bank SMS, scrape statements, or silently send your financial data anywhere.</Text></View></ScrollView>;
}

export function ModuleScreen({ darkMode, module, items, expenses = [], accounts = [], household, onHouseholdChange, onRefresh, refreshing, onAdd, onUpdate, onDelete, onExport, onImport }: { darkMode: boolean; module: ModuleKey; items: ModuleItem[]; expenses?: Expense[]; accounts?: AccountOption[]; household: { role: "owner" | "member" | "none"; members: { email: string; status: string }[] }; onHouseholdChange: (value: { role: "owner" | "member" | "none"; members: { email: string; status: string }[] }) => void; onRefresh: () => Promise<void>; refreshing: boolean; onAdd: (item: ModuleItem) => void; onUpdate: (id: string, patch: Partial<ModuleItem>) => unknown; onDelete: (id: string) => void; onExport: () => void; onImport: () => void }) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [accountFilter, setAccountFilter] = useState("All");
  const [periodFilter, setPeriodFilter] = useState("All time");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [statusFilter, setStatusFilter] = useState(module === "reconciliation" ? "To verify" : "All");
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  useEffect(() => {
    setStatusFilter(module === "reconciliation" ? "To verify" : "All");
    setCategoryFilter("All");
    setAccountFilter("All");
    setPeriodFilter("All time");
    setMinAmount("");
    setMaxAmount("");
    setQuery("");
  }, [module]);
  const incomeCategories = Array.from(new Set(items.map((item) => item.category).filter(Boolean))) as string[];
  const incomeAccounts = Array.from(new Set(items.map((item) => item.accountId).filter(Boolean))) as string[];
  const filtered = items.filter((item) => {
    const matchesQuery = `${item.title} ${item.detail}`.toLowerCase().includes(query.trim().toLowerCase());
    const itemDate = item.date ? getExpenseDate(item.date) : undefined;
    const now = new Date();
    const matchesPeriod =
      module !== "income" ||
      periodFilter === "All time" ||
      (itemDate != null &&
        (periodFilter === "This month"
          ? itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear()
          : itemDate.getFullYear() === now.getFullYear()));
    const amount = item.amount ?? 0;
    const matchesAmount =
      module !== "income" ||
      ((minAmount === "" || amount >= Number(minAmount)) &&
        (maxAmount === "" || amount <= Number(maxAmount)));
    const matchesCategory =
      module !== "income" || categoryFilter === "All" || item.category === categoryFilter;
    const matchesAccount =
      module !== "income" || accountFilter === "All" || item.accountId === accountFilter;
    const matchesStatus =
      (module !== "payments" && module !== "reconciliation") ||
      statusFilter === "All" ||
      item.status === statusFilter;
    return matchesQuery && matchesPeriod && matchesAmount && matchesCategory && matchesAccount && matchesStatus;
  });
  const isReadOnly = module === "calendar" || module === "visualize" || module === "export" || module === "import" || module === "about" || module === "netWorth";
  const incomeTotal = items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const rewardEarned = items
    .filter((item) => item.status?.toLowerCase() !== "redeemed")
    .reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const rewardRedeemed = items
    .filter((item) => item.status?.toLowerCase() === "redeemed")
    .reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const toggleItemStatus = async (item: ModuleItem) => {
    if (module !== "payments" && module !== "reconciliation" && module !== "bills" && module !== "budgets") return;
    const patch =
      module === "budgets"
        ? { enabled: !item.enabled }
        : module === "reconciliation"
          ? { status: item.status === "Verified" ? "To verify" : "Verified" }
          : { status: item.status === "Paid" || item.status === "Completed" ? "Pending" : "Paid" };
    setUpdatingItemId(item.id);
    try {
      await onUpdate(item.id, patch);
    } finally {
      setUpdatingItemId(null);
    }
  };
  const invite = async () => {
    const email = await promptText("Invite household member", "Enter their email address");
    if (!email?.trim()) return;
    try {
      const result = await inviteHouseholdMember(email.trim());
      const link = `budget-tracker://accept-invite?token=${result.inviteToken}`;
      const uri = `${FileSystem.Paths.cache}budget-tracker-invite.txt`;
      await FileSystem.writeAsStringAsync(uri, link);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { dialogTitle: "Share household invitation" });
      Alert.alert("Invitation created", link);
    } catch (error) {
      Alert.alert("Invitation failed", error instanceof Error ? error.message : "Could not create invitation");
    }
  };
  const leave = async () => {
    try { await leaveHousehold(); onHouseholdChange({ role: "none", members: [] }); } catch (error) { Alert.alert("Could not leave household", error instanceof Error ? error.message : "Request failed"); }
  };
  const accept = async () => {
    const token = await promptText("Accept invitation", "Paste the invitation token");
    if (!token?.trim()) return;
    try {
      await acceptHouseholdInvite(token.trim());
      const current = await fetchHousehold();
      onHouseholdChange({ role: current.role, members: current.household?.members ?? [] });
      Alert.alert("Invitation accepted", "The shared household is now available.");
    } catch (error) {
      Alert.alert("Could not accept invitation", error instanceof Error ? error.message : "Request failed");
    }
  };
  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, darkMode && styles.darkScroll]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} colors={["#0f766e"]} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageIntroRow}>
        <View style={styles.moduleIntroCopy}>
          <Text style={[styles.pageTitle, darkMode && styles.darkText]}>{moduleLabels[module]}</Text>
          <Text style={styles.muted}>{moduleDescription(module)}</Text>
        </View>
        {!isReadOnly && module !== "reconciliation" && (
          <Pressable onPress={() => setShowForm(true)} style={styles.smallAdd}>
            <Text style={styles.smallAddText}>＋</Text>
          </Pressable>
        )}
      </View>

      {module === "household" && (
        <View style={[styles.householdCard, darkMode && styles.darkSurface]}>
          <Text style={[styles.sectionTitle, darkMode && styles.darkText]}>
            {household.role === "member" ? "Shared household" : "Household access"}
          </Text>
          <Text style={styles.muted}>
            {household.role === "member"
              ? "You are viewing another owner's shared data."
              : "Invite people with full access to this workspace."}
          </Text>
          {household.role !== "member" && (
            <Pressable style={styles.primaryButton} onPress={() => void invite()}>
              <Text style={styles.primaryButtonText}>Invite by email</Text>
            </Pressable>
          )}
          {household.role === "none" && (
            <Pressable style={styles.secondaryButton} onPress={() => void accept()}>
              <Text style={styles.secondaryButtonText}>Accept invitation</Text>
            </Pressable>
          )}
          {household.members.map((member) => (
            <View key={member.email} style={styles.memberRow}>
              <View style={styles.moduleCopy}>
                <Text style={[styles.transactionTitle, darkMode && styles.darkText]}>{member.email}</Text>
                <Text style={styles.muted}>{member.status}</Text>
              </View>
              <Pressable
                onPress={() =>
                  void removeHouseholdMember(member.email).then(() =>
                    onHouseholdChange({
                      ...household,
                      members: household.members.filter((item) => item.email !== member.email),
                    }),
                  )
                }
              >
                <Text style={styles.deleteButtonText}>×</Text>
              </Pressable>
            </View>
          ))}
          {household.role === "member" && (
            <Pressable style={styles.secondaryButton} onPress={() => void leave()}>
              <Text style={styles.secondaryButtonText}>Leave household</Text>
            </Pressable>
          )}
        </View>
      )}

      {(module === "import" || module === "export") && (
        <View style={styles.actionRow}>
          <Pressable style={styles.primaryButton} onPress={module === "export" ? onExport : onImport}>
            <Text style={styles.primaryButtonText}>
              {module === "export" ? "Export JSON" : "Import CSV / JSON"}
            </Text>
          </Pressable>
        </View>
      )}

      {module === "visualize" ? (
        <YearlySpendingChart expenses={expenses} darkMode={darkMode} />
      ) : module === "rewards" ? (
        <View style={[styles.rewardsHero, darkMode && styles.darkRewardsHero]}>
          <Text style={[styles.cardOverline, darkMode && styles.darkRewardOverline]}>REWARDS OVERVIEW</Text>
          <Text style={[styles.rewardsBalance, darkMode && styles.darkText]}>
            {(rewardEarned - rewardRedeemed).toLocaleString("en-IN")} pts
          </Text>
          <Text style={styles.muted}>Estimated balance across recorded reward activity</Text>
          <View style={styles.rewardsStats}>
            <View style={styles.rewardsStat}>
              <Text style={styles.muted}>Earned</Text>
              <Text style={[styles.rewardsStatValue, darkMode && styles.darkText]}>
                {rewardEarned.toLocaleString("en-IN")} pts
              </Text>
            </View>
            <View style={styles.rewardsStat}>
              <Text style={styles.muted}>Redeemed</Text>
              <Text style={[styles.rewardsStatValue, darkMode && styles.darkText]}>
                {rewardRedeemed.toLocaleString("en-IN")} pts
              </Text>
            </View>
            <View style={styles.rewardsStat}>
              <Text style={styles.muted}>Activity</Text>
              <Text style={[styles.rewardsStatValue, darkMode && styles.darkText]}>{items.length}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.moduleSummary, darkMode && styles.darkSummary]}>
          <Text style={styles.cardOverline}>
            {module === "income"
              ? "MATCHING INCOME"
              : module === "reconciliation"
                ? "TO VERIFY"
                : "TOTAL RECORDS"}
          </Text>
          <Text style={[styles.summaryAmount, darkMode && styles.darkText]}>
            {module === "income"
              ? money(filtered.reduce((sum, item) => sum + (item.amount ?? 0), 0))
              : module === "reconciliation"
                ? items.filter((item) => item.status === "To verify").length
                : items.length}
          </Text>
          <Text style={styles.muted}>
            {module === "income"
              ? `${filtered.length} matching entries · ${money(incomeTotal)} all-time`
              : module === "budgets"
                ? "rules currently configured"
                : module === "reconciliation"
                  ? "transactions awaiting statement review"
                  : "records in this module"}
          </Text>
        </View>
      )}

      <View style={[styles.searchBox, darkMode && styles.darkSearchBox]}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${moduleLabels[module].toLowerCase()}`}
          placeholderTextColor="#95a2b1"
          style={[styles.searchInput, darkMode && styles.darkInputText]}
        />
      </View>

      {module === "income" && (
        <View style={[styles.incomeFilters, darkMode && styles.darkSurface]}>
          <Text style={[styles.fieldLabel, darkMode && styles.darkMuted]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {["All", ...incomeCategories].map((category) => (
              <Pressable
                key={category}
                onPress={() => setCategoryFilter(category)}
                style={[styles.filterChip, darkMode && styles.darkFilterChip, categoryFilter === category && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, darkMode && styles.darkMuted, categoryFilter === category && styles.filterTextActive]}>
                  {category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {!!incomeAccounts.length && <>
            <Text style={[styles.fieldLabel, darkMode && styles.darkMuted]}>Account</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {["All", ...incomeAccounts].map((accountId) => (
                <Pressable
                  key={accountId}
                  onPress={() => setAccountFilter(accountId)}
                  style={[styles.filterChip, darkMode && styles.darkFilterChip, accountFilter === accountId && styles.filterChipActive]}
                >
                  <Text style={[styles.filterText, darkMode && styles.darkMuted, accountFilter === accountId && styles.filterTextActive]}>
                    {accountId === "All" ? "All accounts" : accounts.find((account) => account.id === accountId)?.title ?? "Account"}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>}
          <Text style={[styles.fieldLabel, darkMode && styles.darkMuted]}>Date range</Text>
          <View style={styles.filterRow}>
            {["All time", "This month", "This year"].map((period) => (
              <Pressable
                key={period}
                onPress={() => setPeriodFilter(period)}
                style={[styles.filterChip, darkMode && styles.darkFilterChip, periodFilter === period && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, darkMode && styles.darkMuted, periodFilter === period && styles.filterTextActive]}>
                  {period}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.amountFilterRow}>
            <TextInput
              value={minAmount}
              onChangeText={setMinAmount}
              placeholder="Min amount"
              placeholderTextColor="#95a2b1"
              keyboardType="numeric"
              style={[styles.amountFilterInput, darkMode && styles.darkInput]}
            />
            <TextInput
              value={maxAmount}
              onChangeText={setMaxAmount}
              placeholder="Max amount"
              placeholderTextColor="#95a2b1"
              keyboardType="numeric"
              style={[styles.amountFilterInput, darkMode && styles.darkInput]}
            />
          </View>
        </View>
      )}

      {(module === "payments" || module === "reconciliation") && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(module === "payments" ? ["All", "Pending", "Paid"] : ["All", "To verify", "Verified"]).map((status) => (
            <Pressable
              key={status}
              onPress={() => setStatusFilter(status)}
              style={[styles.filterChip, darkMode && styles.darkFilterChip, statusFilter === status && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, darkMode && styles.darkMuted, statusFilter === status && styles.filterTextActive]}>
                {status}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.listHeader}>
        <Text style={[styles.sectionTitle, darkMode && styles.darkText]}>
          {module === "rewards" ? "Reward activity" : `${filtered.length} ${module === "income" ? "income entries" : "records"}`}
        </Text>
        {module === "reconciliation" && (
          <Text style={styles.statusPending}>
            {items.filter((item) => item.status === "To verify").length} to verify
          </Text>
        )}
      </View>

      <View style={[styles.moduleCard, darkMode && styles.darkSurface]}>
        {filtered.map((item) => {
          const canToggle =
            !!item.status &&
            (module === "payments" ||
              module === "reconciliation" ||
              module === "bills" ||
              module === "budgets");
          const positiveStatus =
            item.status === "Paid" ||
            item.status === "Completed" ||
            item.status === "Active" ||
            item.status === "Verified" ||
            item.status === "Received" ||
            item.enabled;
          return (
            <View key={item.id} style={[styles.moduleRow, darkMode && styles.darkBorder]}>
              <Pressable
                disabled={!canToggle || updatingItemId === item.id}
                onPress={() => void toggleItemStatus(item)}
                style={({ pressed }) => [
                  styles.moduleTouch,
                  pressed && (darkMode ? styles.darkRowPressed : styles.rowPressed),
                  canToggle && styles.statusTouch,
                ]}
              >
                <View style={[styles.moreIcon, darkMode && styles.darkMoreIcon]}>
                  <Text style={styles.moreIconText}>{item.title.slice(0, 1)}</Text>
                </View>
                <View style={styles.moduleCopy}>
                  <Text style={[styles.transactionTitle, darkMode && styles.darkText]}>{item.title}</Text>
                  <Text style={darkMode ? styles.darkMuted : styles.muted}>{item.detail}</Text>
                </View>
                <View style={styles.moduleValue}>
                  {typeof item.amount === "number" && (
                    <Text style={[styles.transactionAmount, darkMode && styles.darkText]}>
                      {module === "rewards"
                        ? `${item.amount.toLocaleString("en-IN")} pts`
                        : money(item.amount)}
                    </Text>
                  )}
                  {!!item.status && (
                    <Text style={[styles.statusText, positiveStatus ? styles.statusPositive : styles.statusPending]}>
                      {item.status}
                    </Text>
                  )}
                </View>
                {updatingItemId === item.id && (
                  <ActivityIndicator size="small" color="#0f766e" style={styles.rowLoader} />
                )}
              </Pressable>
              {module !== "reconciliation" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.title}`}
                  onPress={() =>
                    Alert.alert("Delete record", `Delete ${item.title}?`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => onDelete(item.id) },
                    ])
                  }
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteButtonText}>×</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      {!filtered.length && (
        <View style={[styles.empty, darkMode && styles.darkSurface]}>
          <Text style={[styles.sectionTitle, darkMode && styles.darkText]}>No records found</Text>
          <Text style={styles.muted}>Try another search or adjust your filters.</Text>
        </View>
      )}

      {showForm && (
        <ModuleForm
          module={module}
          onClose={() => setShowForm(false)}
          onSave={(item) => {
            onAdd(item);
            setShowForm(false);
          }}
        />
      )}
    </ScrollView>
  );
}

export function TransactionList({ expenses, onSelect, darkMode = false }: { expenses: Expense[]; onSelect: (expense: Expense) => void; darkMode?: boolean }) {
  if (!expenses.length) return <View style={styles.empty}><Text style={styles.emptyIcon}>⌕</Text><Text style={styles.sectionTitle}>No expenses found</Text><Text style={styles.muted}>Try another search or reset your filters.</Text></View>;
  const groups = expenses.reduce((result, expense) => {
    const group = result.get(expense.date) ?? [];
    group.push(expense);
    result.set(expense.date, group);
    return result;
  }, new Map<string, Expense[]>());
  return <View style={[styles.transactionCard, darkMode && styles.darkSurface]}>{Array.from(groups, ([date, rows]) => <View key={date}><View style={[styles.expenseDateHeader, darkMode && styles.darkDateHeader]}><Text style={[styles.expenseDateText, darkMode && styles.darkText]}>{date}</Text><Text style={styles.expenseDateTotal}>{money(rows.reduce((sum, row) => sum + row.amount, 0))}</Text></View>{rows.map((expense) => <Pressable key={expense.id} onPress={() => onSelect(expense)} style={({ pressed }) => [styles.transactionRow, darkMode && styles.darkBorder, pressed && (darkMode ? styles.darkRowPressed : styles.rowPressed)]} android_ripple={{ color: darkMode ? "#314550" : "#e4f3ef" }}><View style={[styles.categoryIcon, { backgroundColor: `${categoryColors[expense.category] ?? "#a6b3c2"}44` }]}><Text style={styles.categoryIconText}>{expense.title.slice(0, 1)}</Text></View><View style={styles.transactionCopy}><Text style={[styles.transactionTitle, darkMode && styles.darkText]}>{expense.title.trim()}</Text><Text style={darkMode ? styles.darkMuted : styles.muted}>{expense.category}{expense.isEmi ? " · Tap for schedule" : ""}</Text></View><View><Text style={[styles.transactionAmount, darkMode && styles.darkText]}>-{money(expense.amount)}</Text>{expense.isEmi && <Text style={styles.emiTag}>EMI</Text>}</View></Pressable>)}</View>)}</View>;
}

export function Stat({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) { return <View style={styles.stat}><Text style={[styles.statIcon, { color }]}>{icon}</Text><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>; }

export function SectionHeader({ title, action, onPress }: { title: string; action: string; onPress: () => void }) { return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text><Pressable onPress={onPress}><Text style={styles.link}>{action} ›</Text></Pressable></View>; }

export function BudgetForecastRow({ title, expenses, limit, color }: { title: string; expenses: Expense[]; limit: number; color: string }) { const forecast = forecastBudget({ title, budgetAmount: limit, budgetMode: "monthly" }, expenses); const percentage = Math.min(100, forecast.percentage); return <View style={styles.budgetRow}><View style={styles.budgetLabels}><Text style={styles.budgetLabel}>{title}</Text><Text style={[styles.muted, forecast.willExceed && styles.negative]}>{money(forecast.spent)} / {money(limit)}{forecast.willExceed ? " · forecast over" : ""}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: forecast.willExceed ? "#c65353" : color }]} /></View></View>; }

export function GoalMini({ goal }: { goal: Goal }) { return <View style={styles.goalMini}><View style={[styles.goalDot, { backgroundColor: goal.color }]} /><Text style={styles.goalMiniTitle}>{goal.title}</Text><Text style={styles.goalMiniValue}>{Math.round((goal.saved / goal.target) * 100)}%</Text></View>; }

export function GoalCard({ goal }: { goal: Goal }) { const percentage = Math.round((goal.saved / goal.target) * 100); return <View style={styles.goalCard}><View style={styles.goalHeader}><View style={[styles.goalLargeIcon, { backgroundColor: `${goal.color}20` }]}><Text style={[styles.goalLargeIconText, { color: goal.color }]}>◎</Text></View><View style={styles.goalCardCopy}><Text style={styles.goalTitle}>{goal.title}</Text><Text style={styles.muted}>{money(goal.saved)} saved of {money(goal.target)}</Text></View><Text style={[styles.goalPercentage, { color: goal.color }]}>{percentage}%</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: goal.color }]} /></View><Text style={styles.goalHint}>{money(goal.target - goal.saved)} left to reach your goal</Text></View>; }

export function AccountCard({ title, type, amount, icon, color }: { title: string; type: string; amount: string; icon: string; color: string }) { return <View style={styles.accountCard}><View style={[styles.accountIcon, { backgroundColor: color }]}><Text style={styles.accountIconText}>{icon}</Text></View><View style={styles.accountCopy}><Text style={styles.transactionTitle}>{title}</Text><Text style={styles.muted}>{type}</Text></View><Text style={[styles.accountAmount, amount.startsWith("-") && styles.negative]}>{amount}</Text></View>; }
