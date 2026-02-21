// Funciones para manipular la interfaz de usuario en general

// Controles de visibilidad de las diferentes vistas de la aplicacion

async function showView(viewName) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.remove("active");
  });

  document.getElementById(`view-${viewName}`)?.classList.add("active");
  window.scrollTo(0, 0);

  if (viewName === "dashboard") {
    await updateDashboard();
  } else if (viewName === "profile") {
    await updateProfileView();
  }
}

function openModal(modalId) {
  document.getElementById(modalId)?.classList.add("active");
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove("active");
}

function hideLoadingScreen() {
  document.getElementById("loading-screen").style.display = "none";
}

// Actualiza el contenido de la pantalla principal (dashboard)

async function updateDashboard() {
  const subscriptions = await getAllSubscriptions();
  const user = await getUser();

  await updateHeaderAvatar();
  updateSummaryCards(subscriptions);
  updateCategoriesGrid(subscriptions, user.currency);
  renderCalendar(subscriptions);
  updateUpcomingList(subscriptions);
  updateSubscriptionsList(subscriptions);
}

function updateSummaryCards(subscriptions) {
  const totalMonthly = calculateTotalMonthly(subscriptions);
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcoming = subscriptions.filter((sub) => {
    const billingDate = new Date(sub.billingDate);
    return billingDate >= today && billingDate <= nextWeek;
  });

  document.getElementById("total-expenses").textContent =
    formatCurrency(totalMonthly);
  document.getElementById("active-subs").textContent = subscriptions.length;
  document.getElementById("upcoming-subs").textContent = upcoming.length;
}

function updateCategoriesGrid(subscriptions, currency) {
  const grid = document.getElementById("categories-grid");
  grid.innerHTML = "";

  Object.entries(categories).forEach(([key, cat]) => {
    const catTotal = calculateCategoryTotal(subscriptions, key);

    const card = document.createElement("div");
    card.className = "glass-card rounded-xl p-4";
    card.innerHTML = `
            <div class="flex items-center gap-2 mb-2">
                <span class="category-${escapeHtml(key)} w-8 h-8 rounded-lg flex items-center justify-center text-sm">${escapeHtml(cat.icon)}</span>
                <span class="text-sm font-medium">${escapeHtml(cat.name)}</span>
            </div>
            <p class="text-xl font-bold">${escapeHtml(formatCurrency(catTotal, currency))}</p>
        `;
    grid.appendChild(card);
  });
}

function renderCalendar(subscriptions) {
  const currentMonth = window.appState?.currentMonth || new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  document.getElementById("calendar-month").textContent =
    getMonthName(currentMonth);

  const firstDay = getFirstDayOfMonth(year, month);
  const daysInMonth = getDaysInMonth(year, month);

  const grid = document.getElementById("calendar-grid");
  grid.innerHTML = "";

  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(document.createElement("div"));
  }

  const today = new Date();

  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement("div");
    dayEl.className = "calendar-day";

    const isToday =
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year;
    if (isToday) dayEl.classList.add("today");

    const daySubs = getSubscriptionsByDay(subscriptions, day, month, year);

    if (daySubs.length > 0) {
      dayEl.classList.add("active");
    }

    dayEl.innerHTML = `
            <span class="font-medium">${day}</span>
            ${daySubs
        .slice(0, 2)
        .map(
          (sub) => `
                <span class="subscription-chip category-${escapeHtml(sub.category)}">${escapeHtml(sub.icon)}</span>
            `,
        )
        .join("")}
            ${daySubs.length > 2 ? `<span class="subscription-chip bg-gray-700">+${daySubs.length - 2}</span>` : ""}
        `;

    dayEl.onclick = () => showDaySubscriptions(day, daySubs);
    grid.appendChild(dayEl);
  }
}

function updateUpcomingList(subscriptions) {
  const list = document.getElementById("upcoming-list");
  list.innerHTML = "";

  const today = new Date();
  const sorted = subscriptions
    .map((sub) => ({
      ...sub,
      daysUntil: getDaysUntil(new Date(sub.billingDate)),
    }))
    .filter((sub) => sub.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  if (sorted.length === 0) {
    list.innerHTML =
      '<p class="text-gray-500 text-center py-4">No hay pagos proximos</p>';
    return;
  }

  sorted.forEach((sub) => {
    const item = document.createElement("div");
    item.className =
      "flex items-center justify-between p-3 rounded-xl sub-card";
    item.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-xl">${escapeHtml(sub.icon)}</span>
                <div>
                    <p class="font-medium text-sm">${escapeHtml(sub.name)}</p>
                    <p class="text-xs text-gray-500">${escapeHtml(getRelativeTime(sub.daysUntil))}</p>
                </div>
            </div>
            <p class="font-semibold text-sm">${escapeHtml(formatCurrency(sub.price))}</p>
        `;
    list.appendChild(item);
  });
}

function updateSubscriptionsList(subscriptions) {
  const list = document.getElementById("subscriptions-list");
  list.innerHTML = "";

  if (subscriptions.length === 0) {
    list.innerHTML =
      '<p class="text-gray-500 text-center py-4">No tienes suscripciones aun</p>';
    return;
  }

  subscriptions.forEach((sub) => {
    const item = document.createElement("div");
    item.className =
      "flex items-center justify-between p-3 rounded-xl sub-card cursor-pointer transition-colors";
    item.onclick = () => openEditModal(sub.id);
    item.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-xl">${escapeHtml(sub.icon)}</span>
                <div>
                    <p class="font-medium text-sm">${escapeHtml(sub.name)}</p>
                    <p class="text-xs text-gray-500">${escapeHtml(formatCurrency(sub.price))}/mes</p>
                </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
        `;
    list.appendChild(item);
  });
}

function showDaySubscriptions(day, subscriptions) {
  const currentMonth = window.appState?.currentMonth || new Date();
  const date = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    day,
  );

  document.getElementById("day-subs-title").textContent =
    date.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  const list = document.getElementById("day-subs-list");
  list.innerHTML = "";

  if (subscriptions.length === 0) {
    list.innerHTML =
      '<p class="text-gray-500 text-center py-4">No hay suscripciones para este dia</p>';
  } else {
    subscriptions.forEach((sub) => {
      const item = document.createElement("div");
      item.className =
        "glass-card rounded-xl p-4 flex items-center justify-between";
      item.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="text-2xl">${escapeHtml(sub.icon)}</span>
                    <div>
                        <p class="font-medium">${escapeHtml(sub.name)}</p>
                        <p class="text-sm text-gray-500">${escapeHtml(categories[sub.category]?.name || sub.category)}</p>
                    </div>
                </div>
                <p class="font-semibold">${escapeHtml(formatCurrency(sub.price))}</p>
            `;
      list.appendChild(item);
    });
  }

  openModal("modal-day-subs");
}

// Funciones encargadas de pintar la vista de edicion y visualizacion del perfil

async function updateProfileView() {
  const user = await getUser();
  window.appState.user = user;
  window.appState.settings.currency = user.currency;
  window.appState.settings.theme = user.theme;

  document.getElementById("profile-name-display").textContent = user.name;
  document.getElementById("edit-profile-name").value = user.name;
  document.getElementById("currency-select").value = user.currency;

  const imgLarge = document.getElementById("profile-img-large");
  const initialLarge = document.getElementById("profile-initial-large");

  if (user.photo) {
    imgLarge.src = user.photo;
    imgLarge.classList.remove("hidden");
    initialLarge.classList.add("hidden");
  } else {
    imgLarge.classList.add("hidden");
    initialLarge.classList.remove("hidden");
    initialLarge.textContent = user.name ? user.name.charAt(0).toUpperCase() : "";
  }

  updateThemeButtons(user.theme);
  await updateHeaderAvatar();
}

async function updateHeaderAvatar() {
  const user = await getUser();
  const img = document.getElementById("header-avatar");
  const initial = document.getElementById("header-initial");

  if (user.photo) {
    img.src = user.photo;
    img.classList.remove("hidden");
    initial.classList.add("hidden");
  } else {
    img.classList.add("hidden");
    initial.classList.remove("hidden");
    initial.textContent = user.name ? user.name.charAt(0).toUpperCase() : "";
  }
}

function updateThemeButtons(activeTheme) {
  const buttons = {
    light: document.getElementById("theme-light"),
    dark: document.getElementById("theme-dark"),
    system: document.getElementById("theme-system"),
  };

  Object.entries(buttons).forEach(([theme, btn]) => {
    if (btn) {
      if (theme === activeTheme) {
        btn.classList.add("active", "bg-gray-700", "text-white");
        btn.classList.remove("text-gray-500");
      } else {
        btn.classList.remove("active", "bg-gray-700", "text-white");
        btn.classList.add("text-gray-500");
      }
    }
  });
}

// Preparativos de los modales para añadir o editar una suscripcion

function updateCategoryButtons() {
  document.querySelectorAll("[data-category]").forEach((btn) => {
    if (btn.dataset.category === window.appState.selectedCategory) {
      btn.classList.add("bg-primary/20", "border-primary");
    } else {
      btn.classList.remove("bg-primary/20", "border-primary");
    }
  });
}

function updateEditCategoryButtons() {
  document.querySelectorAll("[data-edit-category]").forEach((btn) => {
    if (btn.dataset.editCategory === window.appState.selectedEditCategory) {
      btn.classList.add("bg-primary/20", "border-primary");
    } else {
      btn.classList.remove("bg-primary/20", "border-primary");
    }
  });
}

function updateSharedSection() {
  const container = document.getElementById("shared-people");
  container.innerHTML = "";

  window.appState.tempSharedWith.forEach((person, index) => {
    const tag = document.createElement("span");
    tag.className =
      "px-3 py-1 rounded-full bg-primary/20 text-primary text-sm flex items-center gap-2";
    tag.innerHTML = `
            ${escapeHtml(person)}
            <button onclick="removePerson(${index})" class="hover:text-white">×</button>
        `;
    container.appendChild(tag);
  });

  const price = parseFloat(document.getElementById("add-price")?.value) || 0;
  const share = calculatePersonalShare(
    price,
    window.appState.tempSharedWith.length,
  );
  document.getElementById("your-share").textContent = formatCurrency(share);
}

function updateEditSharedSection() {
  const container = document.getElementById("edit-shared-people");
  container.innerHTML = "";

  window.appState.tempEditSharedWith.forEach((person, index) => {
    const tag = document.createElement("span");
    tag.className =
      "px-3 py-1 rounded-full bg-primary/20 text-primary text-sm flex items-center gap-2";
    tag.innerHTML = `
            ${escapeHtml(person)}
            <button onclick="removeEditPerson(${index})" class="hover:text-white">×</button>
        `;
    container.appendChild(tag);
  });

  const price = parseFloat(document.getElementById("edit-price")?.value) || 0;
  const share = calculatePersonalShare(
    price,
    window.appState.tempEditSharedWith.length,
  );
  if (document.getElementById("edit-your-share")) {
    document.getElementById("edit-your-share").textContent =
      formatCurrency(share);
  }
  if (document.getElementById("edit-people-count")) {
    document.getElementById("edit-people-count").textContent =
      window.appState.tempEditSharedWith.length + 1;
  }
}

function renderIconGrid() {
  const grid = document.getElementById("icon-grid");
  grid.innerHTML = "";

  availableIcons.forEach((icon) => {
    const btn = document.createElement("button");
    btn.className =
      "w-9 h-9 text-xl flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors";
    btn.textContent = icon;
    btn.onclick = () => selectIcon(icon);
    grid.appendChild(btn);
  });
}
