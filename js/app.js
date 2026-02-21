// Estado global de la aplicacion

window.appState = {
  user: { name: "", photo: null },
  settings: { currency: "USD", theme: "dark" },
  currentMonth: new Date(),
  selectedCategory: "entertainment",
  selectedEditCategory: "entertainment",
  tempSharedWith: [],
  tempEditSharedWith: [],
  selectedIcon: "📱",
  iconSelectorMode: "add",
  editingId: null,
};

// Inicializamos la aplicacion al cargar el documento

document.addEventListener("DOMContentLoaded", async () => {
  const initialized = await initDatabase();

  if (!initialized) {
    alert("Error al inicializar la base de datos");
    return;
  }

  initEventListeners();

  const user = await getUser();
  window.appState.user = user;
  window.appState.settings.currency = user.currency;
  window.appState.settings.theme = user.theme;

  applyTheme(user.theme);
  hideLoadingScreen();

  if (user.name) {
    await showView("dashboard");
  } else {
    await showView("login");
  }
});

// Configuramos todos los event listeners de la interfaz

function initEventListeners() {
  // Foto de perfil
  document
    .getElementById("profile-photo")
    ?.addEventListener("change", handlePhotoUpload);
  document
    .getElementById("profile-photo-update")
    ?.addEventListener("change", handlePhotoUploadUpdate);

  // Login con Enter
  document.getElementById("user-name")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") login();
  });

  // Precios - calcular parte
  document
    .getElementById("add-price")
    ?.addEventListener("input", () => updateSharedSection());
  document
    .getElementById("edit-price")
    ?.addEventListener("input", () => updateEditSharedSection());

  // Personas compartiendo con Enter
  document.getElementById("new-person")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addPerson();
  });
  document
    .getElementById("edit-new-person")
    ?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") addEditPerson();
    });

  // Cambio de moneda
  document
    .getElementById("currency-select")
    ?.addEventListener("change", async (e) => {
      window.appState.settings.currency = e.target.value;
      try {
        await updateUser(
          window.appState.user.name,
          window.appState.user.photo,
          e.target.value,
          window.appState.settings.theme,
        );
        await updateDashboard();
      } catch (error) {
        console.error(error);
      }
    });
}

// Funciones para manejar el inicio y cierre de sesion, asi como la foto del usuario

async function login() {
  const nameInput = document.getElementById("user-name");
  const name = nameInput.value.trim();

  if (!name) {
    alert("Por favor ingresa tu nombre");
    return;
  }

  try {
    await updateUser(
      name,
      window.appState.user.photo,
      window.appState.settings.currency,
      window.appState.settings.theme,
    );
    window.location.reload();
  } catch (error) {
    alert("Error guardando usario");
  }
}

async function logout() {
  if (confirm("Estas seguro de que quieres cerrar sesion?")) {
    await clearDatabase();
    window.location.reload();
  }
}

async function handlePhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const dataUrl = await resizeImage(file);
    window.appState.user.photo = dataUrl;
    document.getElementById("profile-preview").innerHTML =
      `<img src="${escapeHtml(dataUrl)}" class="w-full h-full object-cover">`;
  } catch (error) {
    console.error("Error loading photo:", error);
  }
}

async function handlePhotoUploadUpdate(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const dataUrl = await resizeImage(file);
    await updateUser(
      window.appState.user.name,
      dataUrl,
      window.appState.settings.currency,
      window.appState.settings.theme,
    );
    window.appState.user.photo = dataUrl;
    await updateProfileView();
  } catch (error) {
    console.error("Error loading photo:", error);
  }
}

// Funciones relacionadas con la actualizacion del perfil del usuario

async function saveProfileName() {
  const name = document.getElementById("edit-profile-name").value.trim();
  if (!name) {
    alert("Por favor ingresa un nombre valido");
    return;
  }

  try {
    await updateUser(
      name,
      window.appState.user.photo,
      window.appState.settings.currency,
      window.appState.settings.theme,
    );
    window.appState.user.name = name;
    await updateProfileView();
    alert("Nombre actualizado correctamente");
  } catch (error) {
    alert("Error guardando");
  }
}

async function setTheme(theme) {
  window.appState.settings.theme = theme;
  try {
    await updateUser(
      window.appState.user.name,
      window.appState.user.photo,
      window.appState.settings.currency,
      theme,
    );
    applyTheme(theme);
    updateThemeButtons(theme);
  } catch (error) {
    console.error(error);
  }
}

// Funciones para manipular el calendario de la dashboard

async function changeMonth(delta) {
  window.appState.currentMonth.setMonth(
    window.appState.currentMonth.getMonth() + delta,
  );
  renderCalendar(await getAllSubscriptions());
}

// Funciones para manejar el flujo de anadir nuevas suscripciones

function openAddModal() {
  window.appState.selectedCategory = "entertainment";
  window.appState.tempSharedWith = [];
  window.appState.selectedIcon = "📱";

  document.getElementById("add-name").value = "";
  document.getElementById("add-price").value = "";
  document.getElementById("add-date").value = new Date()
    .toISOString()
    .split("T")[0];
  document.getElementById("add-selected-icon").textContent = "📱";
  document.getElementById("shared-toggle").classList.remove("active");
  document.getElementById("shared-section").classList.add("hidden");

  updateCategoryButtons();
  updateSharedSection();
  openModal("modal-add");
}

function selectCategory(category) {
  window.appState.selectedCategory = category;
  updateCategoryButtons();
}

function toggleShared() {
  const toggle = document.getElementById("shared-toggle");
  toggle.classList.toggle("active");
  document.getElementById("shared-section").classList.toggle("hidden");
}

function addPerson() {
  const input = document.getElementById("new-person");
  const name = input.value.trim();
  if (name) {
    window.appState.tempSharedWith.push(name);
    input.value = "";
    updateSharedSection();
  }
}

function removePerson(index) {
  window.appState.tempSharedWith.splice(index, 1);
  updateSharedSection();
}

async function saveSubscription() {
  const name = document.getElementById("add-name").value.trim();
  const price = parseFloat(document.getElementById("add-price").value);
  const billingDate = document.getElementById("add-date").value;

  if (!name) {
    alert("Por favor ingresa el nombre del servicio");
    return;
  }
  if (!price || price <= 0) {
    alert("Por favor ingresa un precio valido");
    return;
  }
  if (!billingDate) {
    alert("Por favor selecciona la fecha de cobro");
    return;
  }

  const subscription = {
    name,
    price,
    category: window.appState.selectedCategory,
    billingDate,
    icon: window.appState.selectedIcon,
    shared: window.appState.tempSharedWith.length > 0,
    sharedWith: window.appState.tempSharedWith,
    cycle: "monthly",
  };

  try {
    await addSubscription(subscription);
    closeModal("modal-add");
    await updateDashboard();
  } catch (error) {
    console.error("Error saving subscription:", error);
    alert("Error guardando suscripcion: " + (error.message || error));
  }
}

// Funciones para manejar la edicion y eliminacion de suscripciones existentes

async function openEditModal(id) {
  try {
    const sub = await getSubscriptionById(id);
    if (!sub) return;

    window.appState.editingId = id;
    window.appState.selectedEditCategory = sub.category;
    window.appState.tempEditSharedWith = [...sub.sharedWith];
    window.appState.selectedIcon = sub.icon;

    document.getElementById("edit-id").value = id;
    document.getElementById("edit-name").value = sub.name;
    document.getElementById("edit-price").value = sub.price;
    document.getElementById("edit-cycle").value = sub.cycle;
    document.getElementById("edit-selected-icon").textContent = sub.icon;

    updateEditCategoryButtons();
    updateEditSharedSection();
    openModal("modal-edit");
  } catch (error) {
    console.error(error);
  }
}

function selectEditCategory(category) {
  window.appState.selectedEditCategory = category;
  updateEditCategoryButtons();
}

function toggleEditShared() {
  const toggle = document.getElementById("edit-shared-toggle");
  toggle.classList.toggle("active");
}

function addEditPerson() {
  const input = document.getElementById("edit-new-person");
  const name = input.value.trim();
  if (name) {
    window.appState.tempEditSharedWith.push(name);
    input.value = "";
    updateEditSharedSection();
  }
}

function removeEditPerson(index) {
  window.appState.tempEditSharedWith.splice(index, 1);
  updateEditSharedSection();
}

async function updateSubscription() {
  const id = parseInt(document.getElementById("edit-id").value);
  const name = document.getElementById("edit-name").value.trim();
  const price = parseFloat(document.getElementById("edit-price").value);
  const cycle = document.getElementById("edit-cycle").value;

  if (!name) {
    alert("Por favor ingresa el nombre del servicio");
    return;
  }
  if (!price || price <= 0) {
    alert("Por favor ingresa un precio valido");
    return;
  }

  try {
    const sub = await getSubscriptionById(id);

    const subscription = {
      name,
      price,
      category: window.appState.selectedEditCategory,
      billingDate: sub.billingDate,
      icon: window.appState.selectedIcon,
      shared: window.appState.tempEditSharedWith.length > 0,
      sharedWith: window.appState.tempEditSharedWith,
      cycle,
    };

    await updateSubscriptionDB(id, subscription);
    closeModal("modal-edit");
    await updateDashboard();
  } catch (error) {
    console.error("Error updating subscription:", error);
    alert("Error actualizando: " + (error.message || error));
  }
}

async function confirmDelete() {
  try {
    const id = parseInt(document.getElementById("edit-id").value);
    const sub = await getSubscriptionById(id);
    if (sub) {
      document.getElementById("delete-name").textContent = sub.name;
      openModal("modal-delete");
    }
  } catch (error) {
    console.error(error);
  }
}

async function deleteSubscription() {
  try {
    const id = parseInt(document.getElementById("edit-id").value);
    await deleteSubscriptionDB(id);
    closeModal("modal-delete");
    closeModal("modal-edit");
    await updateDashboard();
  } catch (error) {
    console.error(error);
  }
}

// Funciones para seleccionar los iconos al crear o editar una suscripcion

function openIconSelector(mode) {
  window.appState.iconSelectorMode = mode;
  renderIconGrid();
  openModal("modal-icons");
}

function selectIcon(icon) {
  window.appState.selectedIcon = icon;
  if (window.appState.iconSelectorMode === "add") {
    document.getElementById("add-selected-icon").textContent = icon;
  } else {
    document.getElementById("edit-selected-icon").textContent = icon;
  }
  closeModal("modal-icons");
}

// Funciones para exportar e importar los datos de la app

async function exportData() {
  try {
    await exportToJSON();
  } catch (error) {
    console.error(error);
  }
}

function importData() {
  document.getElementById("import-file").click();
}

async function handleImport(input) {
  const file = input.files[0];
  if (!file) return;

  try {
    const text = await readFileAsText(file);
    await importFromJSON(text);
    alert("Datos importados correctamente");
    window.location.reload();
  } catch (error) {
    alert("Error al importar: " + error.message);
  }
}
