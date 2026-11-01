import { useState } from "react";
import { Alert, Pressable, RefreshControl, SafeAreaView, ScrollView, Switch, Text, TextInput, View } from "react-native";
import * as Calendar from "expo-calendar";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { acceptHouseholdInvite, fetchHousehold, inviteHouseholdMember, leaveHousehold, login, removeHouseholdMember, signup } from "../api";
import { calcMonthlyEmi, compareMonthlySpending, getEmiSchedule, getMonthlyExpenseAmount, forecastBudget } from "../calculations";
import { categoryColors, moduleLabels, money } from "./constants";
import { Field, ModuleForm } from "./forms";
import { styles } from "./styles";
import type { AccountOption, Expense, Goal, ModuleItem, ModuleKey, Screen } from "./types";

export function isModuleScreen(screen: Screen): screen is ModuleKey {
  return screen !== "dashboard" && screen !== "expenses" && screen !== "accounts" && screen !== "goals" && screen !== "more";
}

export function Dashboard({ darkMode, expenses, goals, onRefresh, refreshing, onAddExpense, onVoiceExpense, onReceipt, onOpenExpenses, onOpenGoals, onNavigate }: { darkMode: boolean; expenses: Expense[]; goals: Goal[]; onRefresh: () => Promise<void>; refreshing: boolean; onAddExpense: () => void; onVoiceExpense: () => void; onReceipt: () => void; onOpenExpenses: () => void; onOpenGoals: () => void; onNavigate: (screen: Screen) => void }) {
  const spent = expenses.reduce((sum, expense) => sum + getMonthlyExpenseAmount({ amount: expense.amount, date: expense.date, isEmi: expense.isEmi, emiMonths: expense.months }, new Date()), 0);
  const monthlyComparison = compareMonthlySpending(expenses);
  return <ScrollView contentContainerStyle={[styles.scroll, darkMode && styles.darkScroll]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} colors={["#0f766e"]} />}>
    <View style={styles.monthRow}><View><Text style={[styles.monthLabel, darkMode && styles.darkText]}>June 2025</Text><Text style={styles.muted}>Monthly overview</Text></View><Pressable style={[styles.monthButton, darkMode && styles.darkControl]}><Text style={[styles.monthButtonText, darkMode && styles.darkText]}>This month⌄</Text></Pressable></View>
    <View style={styles.balanceCard}><View style={styles.balanceGlowOne} /><View style={styles.balanceGlowTwo} /><View style={styles.balanceCardContent}><View><Text style={styles.cardOverline}>TOTAL BALANCE</Text><Text style={styles.balance}>{money(184250)}</Text><Text style={styles.positive}>{monthlyComparison.changePercent >= 0 ? "↑" : "↓"} {Math.abs(monthlyComparison.changePercent).toFixed(1)}% spending vs last month</Text></View><View style={styles.balanceRing}><Text style={styles.ringValue}>68%</Text><Text style={styles.ringLabel}>saved</Text></View></View></View>
    <View style={styles.statsRow}><Stat label="Income" value={money(275000)} color="#0f766e" icon="↗" /><Stat label="Spent" value={money(spent)} color="#c65353" icon="↘" /><Stat label="Left to spend" value={money(Math.max(0, 90000 - spent))} color="#2563eb" icon="◌" /></View>
    <SectionHeader title="Spending this month" action="View details" onPress={onOpenExpenses} />
    <View style={styles.chartCard}><View style={styles.chartBars}>{[42, 68, 51, 82, 61, 93, 73].map((height, index) => <View key={index} style={styles.barColumn}><View style={[styles.bar, { height }]} /><Text style={styles.barLabel}>{["M", "T", "W", "T", "F", "S", "S"][index]}</Text></View>)}</View><View style={styles.chartLegend}><Text style={styles.muted}>Budget used</Text><Text style={styles.chartAmount}>{money(spent)} <Text style={styles.muted}>of {money(90000)}</Text></Text></View></View>
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
    <View style={styles.expenseSummary}><View><Text style={styles.cardOverline}>JUNE SPENDING</Text><Text style={styles.summaryAmount}>{money(expenses.reduce((sum, item) => sum + item.amount, 0))}</Text></View><Text style={styles.summaryChange}>↓ 12% vs May</Text></View>
    <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search expenses" placeholderTextColor="#95a2b1" style={styles.searchInput} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{["All", "Food & dining", "Housing", "Transport", "Groceries"].map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filterChip, filter === item && styles.filterChipActive]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text></Pressable>)}</ScrollView>
    <View style={styles.listHeader}><Text style={styles.sectionTitle}>{filtered.length} transactions</Text><Pressable onPress={onAdd}><Text style={styles.link}>+ Add</Text></Pressable></View>
    <TransactionList expenses={filtered} onSelect={onSelect} emptyQuery={query} />
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

export function ModuleScreen({ darkMode, module, items, household, onHouseholdChange, onRefresh, refreshing, onAdd, onUpdate, onDelete, onExport, onImport }: { darkMode: boolean; module: ModuleKey; items: ModuleItem[]; household: { role: "owner" | "member" | "none"; members: { email: string; status: string }[] }; onHouseholdChange: (value: { role: "owner" | "member" | "none"; members: { email: string; status: string }[] }) => void; onRefresh: () => Promise<void>; refreshing: boolean; onAdd: (item: ModuleItem) => void; onUpdate: (id: string, patch: Partial<ModuleItem>) => void; onDelete: (id: string) => void; onExport: () => void; onImport: () => void }) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ModuleItem | null>(null);
  const filtered = items.filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(query.toLowerCase()));
  const isReadOnly = module === "calendar" || module === "visualize" || module === "export" || module === "import" || module === "about" || module === "netWorth";
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
  return <ScrollView contentContainerStyle={[styles.scroll, darkMode && styles.darkScroll]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} colors={["#0f766e"]} />}><View style={styles.pageIntroRow}><View><Text style={[styles.pageTitle, darkMode && styles.darkText]}>{moduleLabels[module]}</Text><Text style={styles.muted}>{moduleDescription(module)}</Text></View>{!isReadOnly && <Pressable onPress={() => setShowForm(true)} style={styles.smallAdd}><Text style={styles.smallAddText}>＋</Text></Pressable>}</View>{module === "household" && <View style={styles.householdCard}><Text style={styles.sectionTitle}>{household.role === "member" ? "Shared household" : "Household access"}</Text><Text style={styles.muted}>{household.role === "member" ? "You are viewing another owner's shared data." : "Invite people with full access to this workspace."}</Text>  {household.role !== "member" && <Pressable style={styles.primaryButton} onPress={() => void invite()}><Text style={styles.primaryButtonText}>Invite by email</Text></Pressable>}{household.role === "none" && <Pressable style={styles.secondaryButton} onPress={() => void accept()}><Text style={styles.secondaryButtonText}>Accept invitation</Text></Pressable>}{household.members.map((member) => <View key={member.email} style={styles.memberRow}><View style={styles.moduleCopy}><Text style={styles.transactionTitle}>{member.email}</Text><Text style={styles.muted}>{member.status}</Text></View><Pressable onPress={() => void removeHouseholdMember(member.email).then(() => onHouseholdChange({ ...household, members: household.members.filter((item) => item.email !== member.email) }))}><Text style={styles.deleteButtonText}>×</Text></Pressable></View>)}{household.role === "member" && <Pressable style={styles.secondaryButton} onPress={() => void leave()}><Text style={styles.secondaryButtonText}>Leave household</Text></Pressable>}</View>}{(module === "import" || module === "export") && <View style={styles.actionRow}><Pressable style={styles.primaryButton} onPress={module === "export" ? onExport : onImport}><Text style={styles.primaryButtonText}>{module === "export" ? "Export JSON" : "Import CSV / JSON"}</Text></Pressable></View>}<View style={styles.moduleSummary}><Text style={styles.cardOverline}>{module === "visualize" ? "THIS MONTH" : "TOTAL RECORDS"}</Text><Text style={styles.summaryAmount}>{module === "visualize" ? money(items.reduce((sum, item) => sum + (item.amount ?? 0), 0)) : items.length}</Text><Text style={styles.muted}>{module === "budgets" ? "rules currently configured" : module === "reconciliation" ? "items waiting for review" : "local records in this module"}</Text></View><View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder={`Search ${moduleLabels[module].toLowerCase()}`} placeholderTextColor="#95a2b1" style={styles.searchInput} /></View><View style={styles.moduleCard}>{filtered.map((item) => <View key={item.id} style={styles.moduleRow}><Pressable onPress={() => item.status && (module === "bills" || module === "budgets" || module === "reconciliation") ? onUpdate(item.id, { status: item.status === "Paid" || item.status === "Completed" ? "Pending" : "Paid", enabled: !item.enabled }) : undefined} style={styles.moduleTouch}><View style={styles.moreIcon}><Text style={styles.moreIconText}>{item.title.slice(0, 1)}</Text></View><View style={styles.moduleCopy}><Text style={styles.transactionTitle}>{item.title}</Text><Text style={styles.muted}>{item.detail}</Text></View><View style={styles.moduleValue}>{typeof item.amount === "number" && <Text style={styles.transactionAmount}>{money(item.amount)}</Text>}<Text style={[styles.statusText, item.status === "Paid" || item.status === "Completed" || item.status === "Active" || item.enabled ? styles.statusPositive : styles.statusPending]}>{item.status}</Text></View></Pressable><Pressable onPress={() => Alert.alert("Delete record", `Delete ${item.title}?`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => onDelete(item.id) }])} style={styles.deleteButton}><Text style={styles.deleteButtonText}>×</Text></Pressable></View>)}</View>{!filtered.length && <View style={styles.empty}><Text style={styles.sectionTitle}>No records found</Text><Text style={styles.muted}>Try another search or add a new record.</Text></View>}{showForm && <ModuleForm module={module} onClose={() => setShowForm(false)} onSave={(item) => { onAdd(item); setShowForm(false); }} />}</ScrollView>;
}

export async function promptText(title: string, message: string) {
  return new Promise<string | null>((resolve) => {
    Alert.prompt(title, message, (value) => resolve(value), "plain-text");
  });
}

export function moduleDescription(module: ModuleKey) {
  const descriptions: Record<ModuleKey, string> = { bills: "Track due dates and recurring payments.", payments: "Record payments against your cards.", transfers: "Move money between your accounts.", income: "Keep salary and other inflows organized.", loans: "Track principal, interest, and repayments.", insurance: "Manage policies and premium payments.", budgets: "Set thresholds and get spending alerts.", categories: "Manage your spending categories.", investments: "Track holdings and current value.", rewards: "Monitor earned, redeemed, and expired points.", subscriptions: "Keep recurring services visible.", reconciliation: "Review and reconcile account activity.", calendar: "See bills, payments, and financial events.", visualize: "Understand trends and spending patterns.", import: "Bring records into Budget Tracker.", export: "Download your financial records.", household: "Manage shared household access.", netWorth: "Review snapshots of your financial position.", about: "Privacy, version, and app information." }; return descriptions[module];
}

export function TransactionList({ expenses, onSelect, emptyQuery }: { expenses: Expense[]; onSelect: (expense: Expense) => void; emptyQuery?: string }) {
  if (!expenses.length) return <View style={styles.empty}><Text style={styles.emptyIcon}>⌕</Text><Text style={styles.sectionTitle}>No expenses found</Text><Text style={styles.muted}>Try another search or reset your filters.</Text></View>;
  return <View style={styles.transactionCard}>{expenses.map((expense) => <Pressable key={expense.id} onPress={() => onSelect(expense)} style={styles.transactionRow}><View style={[styles.categoryIcon, { backgroundColor: `${categoryColors[expense.category] ?? "#a6b3c2"}44` }]}><Text style={styles.categoryIconText}>{expense.title.slice(0, 1)}</Text></View><View style={styles.transactionCopy}><Text style={styles.transactionTitle}>{expense.title}</Text><Text style={styles.muted}>{expense.category} · {expense.date}{expense.isEmi ? " · Tap for schedule" : ""}</Text></View><View><Text style={styles.transactionAmount}>-{money(expense.amount)}</Text>{expense.isEmi && <Text style={styles.emiTag}>EMI</Text>}</View></Pressable>)}</View>;
}

export function Stat({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) { return <View style={styles.stat}><Text style={[styles.statIcon, { color }]}>{icon}</Text><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>; }

export function SectionHeader({ title, action, onPress }: { title: string; action: string; onPress: () => void }) { return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text><Pressable onPress={onPress}><Text style={styles.link}>{action} ›</Text></Pressable></View>; }

export function BudgetForecastRow({ title, expenses, limit, color }: { title: string; expenses: Expense[]; limit: number; color: string }) { const forecast = forecastBudget({ title, budgetAmount: limit, budgetMode: "monthly" }, expenses); const percentage = Math.min(100, forecast.percentage); return <View style={styles.budgetRow}><View style={styles.budgetLabels}><Text style={styles.budgetLabel}>{title}</Text><Text style={[styles.muted, forecast.willExceed && styles.negative]}>{money(forecast.spent)} / {money(limit)}{forecast.willExceed ? " · forecast over" : ""}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: forecast.willExceed ? "#c65353" : color }]} /></View></View>; }

export function GoalMini({ goal }: { goal: Goal }) { return <View style={styles.goalMini}><View style={[styles.goalDot, { backgroundColor: goal.color }]} /><Text style={styles.goalMiniTitle}>{goal.title}</Text><Text style={styles.goalMiniValue}>{Math.round((goal.saved / goal.target) * 100)}%</Text></View>; }

export function GoalCard({ goal }: { goal: Goal }) { const percentage = Math.round((goal.saved / goal.target) * 100); return <View style={styles.goalCard}><View style={styles.goalHeader}><View style={[styles.goalLargeIcon, { backgroundColor: `${goal.color}20` }]}><Text style={[styles.goalLargeIconText, { color: goal.color }]}>◎</Text></View><View style={styles.goalCardCopy}><Text style={styles.goalTitle}>{goal.title}</Text><Text style={styles.muted}>{money(goal.saved)} saved of {money(goal.target)}</Text></View><Text style={[styles.goalPercentage, { color: goal.color }]}>{percentage}%</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: goal.color }]} /></View><Text style={styles.goalHint}>{money(goal.target - goal.saved)} left to reach your goal</Text></View>; }

export function AccountCard({ title, type, amount, icon, color }: { title: string; type: string; amount: string; icon: string; color: string }) { return <View style={styles.accountCard}><View style={[styles.accountIcon, { backgroundColor: color }]}><Text style={styles.accountIconText}>{icon}</Text></View><View style={styles.accountCopy}><Text style={styles.transactionTitle}>{title}</Text><Text style={styles.muted}>{type}</Text></View><Text style={[styles.accountAmount, amount.startsWith("-") && styles.negative]}>{amount}</Text></View>; }
