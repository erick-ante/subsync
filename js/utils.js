// Archivo para pequenas funciones de ayuda que utilizamos en varias partes

const availableIcons = [
  "📱",
  "📺",
  "🎵",
  "🎬",
  "🎮",
  "📦",
  "☁",
  "🔧",
  "💻",
  "📷",
  "🏃",
  "💊",
  "📚",
  "🍿",
  "🎯",
  "🎨",
  "🎭",
  "🎪",
  "🎰",
  "🎲",
  "🚗",
  "✈️",
  "🍔",
  "☕",
  "🛒",
  "🛍️",
  "🏋️",
  "🐶",
  "🏡",
  "💡",
  "🌎",
  "🛡️",
];

const categories = {
  entertainment: { name: "Entretenimiento", icon: "🎬", color: "purple" },
  productivity: { name: "Productividad", icon: "✓", color: "blue" },
  utility: { name: "Utilidades", icon: "⚡", color: "yellow" },
  health: { name: "Salud", icon: "❤", color: "green" },
};

const currencySymbols = {
  USD: "$",
  EUR: "€",
  MXN: "$",
  COP: "$",
};

// Rutinas de formateo visual para fechas, monedas y similares

function formatCurrency(amount, currency = "USD") {
  const symbol = currencySymbols[currency] || "$";
  return `${symbol}${amount.toFixed(2)}`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function getDaysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diff = date - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getRelativeTime(days) {
  if (days === 0) return "Hoy";
  if (days === 1) return "Manana";
  if (days < 0) return "Vencido";
  return `En ${days} dias`;
}

// Matematicas del dinero y sumatorias de suscripciones

function calculatePersonalShare(price, sharedWithCount) {
  if (sharedWithCount === 0) return price;
  return price / (sharedWithCount + 1);
}

function calculateTotalMonthly(subscriptions) {
  return subscriptions.reduce((sum, sub) => {
    return sum + calculatePersonalShare(sub.price, sub.sharedWith.length);
  }, 0);
}

function calculateCategoryTotal(subscriptions, category) {
  return subscriptions
    .filter((s) => s.category === category)
    .reduce(
      (sum, sub) =>
        sum + calculatePersonalShare(sub.price, sub.sharedWith.length),
      0,
    );
}

function getUpcomingSubscriptions(subscriptions, days = 7) {
  const today = new Date();
  const nextWeek = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

  return subscriptions.filter((sub) => {
    const billingDate = new Date(sub.billingDate);
    return billingDate >= today && billingDate <= nextWeek;
  });
}

function getSubscriptionsByDay(subscriptions, day, month, year) {
  return subscriptions.filter((sub) => {
    const billingDate = new Date(sub.billingDate);
    return billingDate.getDate() === day &&
      billingDate.getMonth() === month &&
      billingDate.getFullYear() === year;
  });
}

// Resoluciones simples para trabajar con dias, meses y annos

function getMonthName(date) {
  return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

// Aplicar clases segun la preferencia del sistema o guardada

function applyTheme(theme) {
  const body = document.body;

  if (theme === "light") {
    body.setAttribute("data-theme", "light");
  } else if (theme === "dark") {
    body.removeAttribute("data-theme");
  } else if (theme === "system") {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    if (prefersDark) {
      body.removeAttribute("data-theme");
    } else {
      body.setAttribute("data-theme", "light");
    }
  }
}

// Lecturas asincronas del sistema de ficheros para imagenes o JSON

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

// Migración: Función de sanitización XSS
function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return text.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Migración: Optimización de imágenes
async function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        let width = img.width;
        let height = img.height;
        const maxSize = 200;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
