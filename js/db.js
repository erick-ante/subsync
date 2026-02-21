// Funciones y configuraciones para la conexion y manipulacion de la base local SQLite

let db = null;
let SQL = null;

// Inicializar base de datos
async function initDatabase() {
  try {
    SQL = await initSqlJs({
      locateFile: (file) =>
        `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`,
    });

    // Migración: IndexedDB y compresión para evitar límite 5MB
    let compressedData = await idbKeyval.get("subsync_db");

    if (compressedData) {
      const binaryString = LZString.decompressFromUTF16(compressedData);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      db = new SQL.Database(uint8Array);
    } else {
      const savedDb = localStorage.getItem("subsync_db");
      if (savedDb) {
        // Migración transparente desde localStorage
        const uint8Array = new Uint8Array(JSON.parse(savedDb));
        db = new SQL.Database(uint8Array);
        await saveDatabase(); // Guardar en IDB
      } else {
        db = new SQL.Database();
        await createTables();
      }
    }

    console.log("SQLite V13 initialized");
    return true;
  } catch (error) {
    console.error("DB Error:", error);
    return false;
  }
}

// Crear tablas
async function createTables() {
  try {
    db.run(`
          CREATE TABLE IF NOT EXISTS user (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              name TEXT,
              photo TEXT,
              currency TEXT DEFAULT 'USD',
              theme TEXT DEFAULT 'dark'
          )
      `);

    db.run(`
          CREATE TABLE IF NOT EXISTS subscriptions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              price REAL NOT NULL,
              category TEXT NOT NULL,
              billing_date TEXT NOT NULL,
              icon TEXT DEFAULT '📱',
              shared INTEGER DEFAULT 0,
              cycle TEXT DEFAULT 'monthly'
          )
      `);

    db.run(`
          CREATE TABLE IF NOT EXISTS shared_people (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              subscription_id INTEGER NOT NULL,
              name TEXT NOT NULL,
              FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
          )
      `);

    db.run(
      `INSERT OR IGNORE INTO user (id, name, photo, currency, theme) VALUES (1, '', NULL, 'USD', 'dark')`,
    );
    await saveDatabase();
  } catch (error) {
    console.error("Error creating tables:", error);
    throw error;
  }
}

// Guardar base de datos
async function saveDatabase() {
  if (!db) return;
  try {
    const data = db.export();

    // Migración: compresión LZ-String antes de guardar
    let binaryString = "";
    for (let i = 0; i < data.length; i++) {
      binaryString += String.fromCharCode(data[i]);
    }

    const compressed = LZString.compressToUTF16(binaryString);

    // Transacciones atómicas: Usar setMany de idb-keyval para guardar DB y versión juntas
    await idbKeyval.setMany([
      ["subsync_db", compressed],
      ["db_version", 1],
    ]);
  } catch (error) {
    console.error("Storage Error:", error);
    if (error.name === "QuotaExceededError") {
      alert("Límite de almacenamiento alcanzado. Por favor, libere espacio.");
      try {
        const data = db.export();
        const array = Array.from(data);
        localStorage.setItem("subsync_db", JSON.stringify(array));
      } catch (fallbackError) {
        console.error("Fallback storage error", fallbackError);
      }
    }
  }
}

// Consultas relacionadas a la informacion del usuario

async function getUser() {
  try {
    const result = db.exec("SELECT * FROM user WHERE id = 1");
    let userParams = { name: "", photo: null, currency: "USD", theme: "dark" };
    if (result.length > 0 && result[0].values.length > 0) {
      const row = result[0].values[0];
      userParams = {
        name: row[1] || "",
        has_photo: row[2] === "1",
        currency: row[3] || "USD",
        theme: row[4] || "dark",
      };
    }

    // Migración: cargar foto desde IndexedDB para no saturar SQLite
    if (userParams.has_photo) {
      const photoData = await idbKeyval.get("user_photo");
      userParams.photo = photoData;
    }

    return userParams;
  } catch (error) {
    console.error("DB Error in getUser", error);
    throw error;
  }
}

async function updateUser(name, photo, currency, theme) {
  try {
    const hasPhoto = photo ? "1" : "0";
    db.run(
      `
          UPDATE user SET name = ?, photo = ?, currency = ?, theme = ? WHERE id = 1
      `,
      [name || "", hasPhoto, currency || "USD", theme || "dark"],
    );

    if (photo) {
      await idbKeyval.set("user_photo", photo);
    } else {
      await idbKeyval.del("user_photo");
    }

    await saveDatabase();
  } catch (error) {
    console.error("DB Error in updateUser", error);
    throw error;
  }
}

// Operaciones CRUD principales para las suscripciones

async function getAllSubscriptions() {
  try {
    const result = db.exec(`
          SELECT s.*, GROUP_CONCAT(sp.name) as shared_names
          FROM subscriptions s
          LEFT JOIN shared_people sp ON s.id = sp.subscription_id
          GROUP BY s.id
          ORDER BY s.id DESC
      `);

    if (result.length === 0 || result[0].values.length === 0) {
      return [];
    }

    return result[0].values.map((row) => ({
      id: row[0],
      name: row[1],
      price: row[2],
      category: row[3],
      billingDate: row[4],
      icon: row[5],
      shared: row[6] === 1,
      cycle: row[7],
      sharedWith: row[8] ? row[8].split(",") : [],
    }));
  } catch (error) {
    console.error("DB Error in getAllSubscriptions", error);
    throw error;
  }
}

async function getSubscriptionById(id) {
  try {
    const result = db.exec(
      `
          SELECT s.*, GROUP_CONCAT(sp.name) as shared_names
          FROM subscriptions s
          LEFT JOIN shared_people sp ON s.id = sp.subscription_id
          WHERE s.id = ?
          GROUP BY s.id
      `,
      [id],
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const row = result[0].values[0];
    return {
      id: row[0],
      name: row[1],
      price: row[2],
      category: row[3],
      billingDate: row[4],
      icon: row[5],
      shared: row[6] === 1,
      cycle: row[7],
      sharedWith: row[8] ? row[8].split(",") : [],
    };
  } catch (error) {
    console.error("DB Error in getSubscriptionById", error);
    throw error;
  }
}

async function addSubscription(subscription) {
  try {
    db.run(
      `
          INSERT INTO subscriptions (name, price, category, billing_date, icon, shared, cycle)
          VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        subscription.name,
        subscription.price,
        subscription.category,
        subscription.billingDate,
        subscription.icon,
        subscription.shared ? 1 : 0,
        subscription.cycle || "monthly",
      ],
    );

    const idRes = db.exec("SELECT last_insert_rowid()");
    const id = idRes[0].values[0][0];

    if (subscription.sharedWith && subscription.sharedWith.length > 0) {
      subscription.sharedWith.forEach((person) => {
        db.run(
          `INSERT INTO shared_people (subscription_id, name) VALUES (?, ?)`,
          [id, person],
        );
      });
    }

    await saveDatabase();
    return id;
  } catch (error) {
    console.error("DB Error in addSubscription", error);
    throw error;
  }
}

async function updateSubscriptionDB(id, subscription) {
  try {
    db.run(
      `
          UPDATE subscriptions SET
              name = ?, price = ?, category = ?, billing_date = ?, icon = ?, shared = ?, cycle = ?
          WHERE id = ?
      `,
      [
        subscription.name,
        subscription.price,
        subscription.category,
        subscription.billingDate,
        subscription.icon,
        subscription.shared ? 1 : 0,
        subscription.cycle || "monthly",
        id,
      ],
    );

    db.run(`DELETE FROM shared_people WHERE subscription_id = ?`, [id]);

    if (subscription.sharedWith && subscription.sharedWith.length > 0) {
      subscription.sharedWith.forEach((person) => {
        db.run(
          `INSERT INTO shared_people (subscription_id, name) VALUES (?, ?)`,
          [id, person],
        );
      });
    }

    await saveDatabase();
  } catch (error) {
    console.error("DB Error in updateSubscriptionDB", error);
    throw error;
  }
}

async function deleteSubscriptionDB(id) {
  try {
    db.run(`DELETE FROM subscriptions WHERE id = ?`, [id]);
    await saveDatabase();
  } catch (error) {
    console.error("DB Error in deleteSubscriptionDB", error);
    throw error;
  }
}

// Rutinas para importar o exportar el JSON general

async function exportToJSON() {
  try {
    const user = await getUser();
    const subscriptions = await getAllSubscriptions();

    const data = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      user: user,
      subscriptions: subscriptions,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subsync_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting to JSON", error);
    throw error;
  }
}

async function importFromJSON(jsonData) {
  try {
    const data = JSON.parse(jsonData);

    // Validación estructura JSON
    if (!data.version || !data.user || !data.subscriptions) {
      throw new Error("Formato inválido: la estructura JSON no es correcta. Faltan propiedades principales (version, user o subscriptions).");
    }

    await updateUser(
      data.user.name,
      data.user.photo,
      data.user.currency,
      data.user.theme,
    );

    db.run(`DELETE FROM shared_people`);
    db.run(`DELETE FROM subscriptions`);

    data.subscriptions.forEach((sub) => {
      db.run(
        `
              INSERT INTO subscriptions(id, name, price, category, billing_date, icon, shared, cycle)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?)
          `,
        [
          sub.id,
          sub.name,
          sub.price,
          sub.category,
          sub.billingDate,
          sub.icon,
          sub.shared ? 1 : 0,
          sub.cycle || "monthly",
        ],
      );

      if (sub.sharedWith && sub.sharedWith.length > 0) {
        sub.sharedWith.forEach((person) => {
          db.run(
            `INSERT INTO shared_people(subscription_id, name) VALUES(?, ?)`,
            [sub.id, person],
          );
        });
      }
    });

    await saveDatabase();
  } catch (error) {
    console.error("Error importing from JSON:", error);
    throw error;
  }
}

async function clearDatabase() {
  localStorage.removeItem("subsync_db");
  try {
    await idbKeyval.del("subsync_db");
    await idbKeyval.del("db_version");
    await idbKeyval.del("user_photo");
  } catch (e) {
    console.error("Error clearing DB", e);
  }
}
