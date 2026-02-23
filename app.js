const STORAGE_KEY = "bloombudget.expenses.v1";
const SESSION_KEY = "bloombudget.session.v1";
const OTP_KEY = "bloombudget.otp.v1";
const OTP_TTL_MS = 5 * 60 * 1000;

const CATEGORY_COLORS = {
  Food: "#7d83ff",
  Transport: "#30d5c8",
  Utilities: "#66d98f",
  Shopping: "#ffbf69",
  Health: "#ff6b7d",
  Entertainment: "#a282ff",
  Other: "#8aa3c2",
};

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

const authShell = document.getElementById("authShell");
const appShell = document.getElementById("appShell");
const authForm = document.getElementById("authForm");
const otpForm = document.getElementById("otpForm");
const authMessage = document.getElementById("authMessage");
const otpMessage = document.getElementById("otpMessage");
const emailInput = document.getElementById("email");
const otpInput = document.getElementById("otp");
const resendOtpBtn = document.getElementById("resendOtp");
const providerButtons = Array.from(document.querySelectorAll(".provider-btn"));

const expenseForm = document.getElementById("expenseForm");
const formMessage = document.getElementById("formMessage");
const expenseList = document.getElementById("expenseList");
const emptyState = document.getElementById("emptyState");
const filterCategory = document.getElementById("filterCategory");
const exportButton = document.getElementById("exportButton");
const logoutButton = document.getElementById("logoutButton");
const totalSpentEl = document.getElementById("totalSpent");
const monthSpentEl = document.getElementById("monthSpent");
const dailyAverageEl = document.getElementById("dailyAverage");
const legendEl = document.getElementById("legend");
const template = document.getElementById("expenseItemTemplate");
const sessionMeta = document.getElementById("sessionMeta");

const chart = document.getElementById("categoryChart");
const ctx = chart.getContext("2d");

document.getElementById("date").value = getTodayIsoDate();

let selectedProvider = "Google";
let pendingAuth = null;
let expenses = loadExpenses();

providerButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedProvider = button.dataset.provider || "Google";
    providerButtons.forEach((btn) => btn.classList.toggle("active", btn === button));
  });
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  if (!isValidEmail(email)) {
    setAuthMessage("Please provide a valid email address.", true);
    return;
  }

  const otp = createOtp();
  const otpHash = await hashText(otp);
  const challenge = {
    email,
    provider: selectedProvider,
    otpHash,
    expiresAt: Date.now() + OTP_TTL_MS,
  };
  localStorage.setItem(OTP_KEY, JSON.stringify(challenge));
  pendingAuth = challenge;

  showOtpStep();
  setAuthMessage(`OTP sent to ${maskEmail(email)} via ${selectedProvider} sign-in flow.`);
  setOtpMessage(`For this demo app, OTP is shown here: ${otp}`);
});

otpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const enteredOtp = otpInput.value.trim();
  if (!/^\d{6}$/.test(enteredOtp)) {
    setOtpMessage("Please enter a valid 6-digit OTP.", true);
    return;
  }

  const activeChallenge = pendingAuth || loadOtpChallenge();
  if (!activeChallenge) {
    setOtpMessage("No active OTP challenge. Please request a new OTP.", true);
    return;
  }

  if (Date.now() > activeChallenge.expiresAt) {
    localStorage.removeItem(OTP_KEY);
    setOtpMessage("OTP expired. Please request a new OTP.", true);
    return;
  }

  const enteredHash = await hashText(enteredOtp);
  if (enteredHash !== activeChallenge.otpHash) {
    setOtpMessage("Invalid OTP. Please try again.", true);
    return;
  }

  const session = {
    email: activeChallenge.email,
    provider: activeChallenge.provider,
    loginAt: Date.now(),
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.removeItem(OTP_KEY);
  pendingAuth = null;
  otpForm.reset();
  authForm.reset();
  setOtpMessage("Verification successful. Redirecting...");
  initializeAppSession(session);
});

resendOtpBtn.addEventListener("click", () => {
  authForm.requestSubmit();
});

logoutButton.addEventListener("click", () => {
  localStorage.removeItem(SESSION_KEY);
  sessionMeta.textContent = "";
  appShell.classList.add("hidden");
  authShell.classList.remove("hidden");
  otpForm.classList.add("hidden");
  authForm.classList.remove("hidden");
  pendingAuth = null;
  setAuthMessage("You are signed out.");
  setOtpMessage("");
});

expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(expenseForm);
  const title = (data.get("title") || "").toString().trim();
  const amount = Number(data.get("amount"));
  const category = (data.get("category") || "Other").toString();
  const date = (data.get("date") || "").toString();
  const notes = (data.get("notes") || "").toString().trim();

  if (!title || !Number.isFinite(amount) || amount <= 0 || !date) {
    setFormMessage("Please provide a valid title, amount, and date.", true);
    return;
  }

  expenses.unshift({
    id: crypto.randomUUID(),
    title,
    amount: Math.round(amount * 100) / 100,
    category,
    date,
    notes,
    createdAt: Date.now(),
  });

  saveExpenses(expenses);
  expenseForm.reset();
  document.getElementById("date").value = getTodayIsoDate();
  setFormMessage("Expense added successfully.");
  render();
});

filterCategory.addEventListener("change", render);

exportButton.addEventListener("click", () => {
  if (!expenses.length) {
    setFormMessage("Add at least one expense before exporting.", true);
    return;
  }

  const header = ["Title", "Amount", "Category", "Date", "Notes"];
  const lines = expenses.map((expense) =>
    [expense.title, expense.amount.toFixed(2), expense.category, expense.date, expense.notes]
      .map(csvEscape)
      .join(","),
  );

  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `expenses-${getTodayIsoDate()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  setFormMessage("CSV exported.");
});

expenseList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains("delete-btn")) {
    return;
  }
  expenses = expenses.filter((item) => item.id !== target.dataset.id);
  saveExpenses(expenses);
  render();
});

const activeSession = loadSession();
if (activeSession) {
  initializeAppSession(activeSession);
} else {
  authShell.classList.remove("hidden");
  appShell.classList.add("hidden");
}

function initializeAppSession(session) {
  authShell.classList.add("hidden");
  appShell.classList.remove("hidden");
  authForm.classList.remove("hidden");
  otpForm.classList.add("hidden");
  sessionMeta.textContent = `Signed in as ${session.email} with ${session.provider}`;
  render();
}

function showOtpStep() {
  authForm.classList.add("hidden");
  otpForm.classList.remove("hidden");
  otpInput.focus();
}

function render() {
  const selectedCategory = filterCategory.value;
  const visibleExpenses = selectedCategory === "All"
    ? expenses
    : expenses.filter((expense) => expense.category === selectedCategory);
  renderList(visibleExpenses);
  renderStats(expenses);
  renderChart(expenses);
}

function renderList(items) {
  expenseList.innerHTML = "";
  items.forEach((expense) => {
    const fragment = template.content.cloneNode(true);
    const root = fragment.querySelector(".expense-item");
    fragment.querySelector(".expense-title").textContent = expense.title;
    fragment.querySelector(".expense-meta").textContent = `${expense.category} • ${formatDate(expense.date)}`;
    fragment.querySelector(".expense-notes").textContent = expense.notes || "";
    fragment.querySelector(".expense-amount").textContent = currency.format(expense.amount);
    const button = fragment.querySelector(".delete-btn");
    button.dataset.id = expense.id;
    button.setAttribute("aria-label", `Delete expense ${expense.title}`);
    expenseList.append(root);
  });
  emptyState.style.display = items.length ? "none" : "block";
}

function renderStats(allExpenses) {
  const total = sum(allExpenses.map((expense) => expense.amount));
  totalSpentEl.textContent = currency.format(total);
  const now = new Date();
  const monthly = sum(
    allExpenses
      .filter((expense) => {
        const date = new Date(`${expense.date}T00:00:00`);
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      })
      .map((expense) => expense.amount),
  );
  monthSpentEl.textContent = currency.format(monthly);
  const oldestDate = getOldestExpenseDate(allExpenses);
  const daysCovered = oldestDate
    ? Math.max(1, Math.round((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 1;
  dailyAverageEl.textContent = currency.format(total / daysCovered);
}

function renderChart(allExpenses) {
  const totalsByCategory = allExpenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});

  const entries = Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1]);
  const total = sum(entries.map((entry) => entry[1]));
  ctx.clearRect(0, 0, chart.width, chart.height);

  if (!entries.length || total <= 0) {
    drawEmptyChart();
    legendEl.innerHTML = "";
    return;
  }

  let angleStart = -Math.PI / 2;
  entries.forEach(([category, amount]) => {
    const angle = (amount / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(chart.width / 2, chart.height / 2);
    ctx.arc(chart.width / 2, chart.height / 2, 110, angleStart, angleStart + angle);
    ctx.closePath();
    ctx.fillStyle = CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
    ctx.fill();
    angleStart += angle;
  });

  ctx.beginPath();
  ctx.arc(chart.width / 2, chart.height / 2, 58, 0, Math.PI * 2);
  ctx.fillStyle = "#121733";
  ctx.fill();
  ctx.fillStyle = "#dce3ff";
  ctx.font = "700 20px Inter";
  ctx.textAlign = "center";
  ctx.fillText(currency.format(total), chart.width / 2, chart.height / 2 + 7);

  legendEl.innerHTML = entries
    .map(([category, amount]) => {
      const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
      return `<li><span><span class="swatch" style="background:${color}"></span>${category}</span><span>${currency.format(amount)}</span></li>`;
    })
    .join("");
}

function drawEmptyChart() {
  ctx.fillStyle = "#7d86b0";
  ctx.font = "600 18px Inter";
  ctx.textAlign = "center";
  ctx.fillText("No data yet", chart.width / 2, chart.height / 2);
}

function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => ({
        id: String(item.id || crypto.randomUUID()),
        title: String(item.title || ""),
        amount: Number(item.amount) || 0,
        category: String(item.category || "Other"),
        date: String(item.date || getTodayIsoDate()),
        notes: String(item.notes || ""),
        createdAt: Number(item.createdAt) || Date.now(),
      }))
      .filter((item) => item.title && item.amount > 0)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function saveExpenses(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.email || !parsed?.provider) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function loadOtpChallenge() {
  try {
    const raw = localStorage.getItem(OTP_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.email || !parsed?.otpHash || !parsed?.expiresAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sum(values) {
  return values.reduce((total, current) => total + current, 0);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function setFormMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.style.color = isError ? "#ff9db0" : "#30d5c8";
}

function setAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#ff9db0" : "#30d5c8";
}

function setOtpMessage(message, isError = false) {
  otpMessage.textContent = message;
  otpMessage.style.color = isError ? "#ff9db0" : "#30d5c8";
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getOldestExpenseDate(allExpenses) {
  if (!allExpenses.length) {
    return null;
  }
  return allExpenses.reduce((oldest, expense) => {
    const expenseDate = new Date(`${expense.date}T00:00:00`);
    if (Number.isNaN(expenseDate.getTime())) {
      return oldest;
    }
    return !oldest || expenseDate < oldest ? expenseDate : oldest;
  }, null);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createOtp() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function maskEmail(email) {
  const [name, domain] = email.split("@");
  if (!name || !domain) {
    return email;
  }
  const maskedName = `${name.slice(0, 1)}${"*".repeat(Math.max(1, name.length - 2))}${name.slice(-1)}`;
  return `${maskedName}@${domain}`;
}

async function hashText(text) {
  const bytes = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer)).map((value) => value.toString(16).padStart(2, "0")).join("");
}
