import { env } from "cloudflare:workers";

type Area = "Cocina" | "Barra";
type UserRole = "encargado" | "dueno" | "administrador";

type UserRow = { id: number; name: string; role: UserRole; area: Area | null; active: number };
type ProductRow = {
  id: number;
  name: string;
  area: Area;
  category_id: number;
  category_name: string;
  unit: string;
  current_quantity: number;
  active: number;
};
type RequestRow = {
  id: number;
  status: "Abierta" | "Cerrada";
  opened_at: string;
  closed_at: string | null;
  closed_by_user_id: number | null;
  closed_by_name: string | null;
  note: string | null;
};

const seedCategories = ["Bebidas", "Insumos", "Producción", "Limpieza"];
const seedUsers: Array<[string, UserRole, Area | null]> = [
  ["Encargado de cocina", "encargado", "Cocina"],
  ["Encargado de barra", "encargado", "Barra"],
  ["Dueño", "dueno", null],
  ["Administrador", "administrador", null],
];
const seedProducts: Array<[string, Area, string, string, number]> = [
  ["Harina", "Cocina", "Producción", "Bolsa", 3],
  ["Queso muzzarella", "Cocina", "Producción", "Kg", 5],
  ["Salsa de tomate", "Cocina", "Producción", "Lata", 8],
  ["Detergente", "Cocina", "Limpieza", "Litro", 2],
  ["Coca-Cola 1,5 L", "Barra", "Bebidas", "Botella", 12],
  ["Cerveza rubia", "Barra", "Bebidas", "Botella", 24],
  ["Servilletas", "Barra", "Insumos", "Paquete", 6],
  ["Sorbetes", "Barra", "Insumos", "Paquete", 4],
];

function database() {
  if (!env.DB) throw new Error("La base de datos no está disponible.");
  return env.DB;
}

async function ensureDatabase() {
  const db = database();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name ON categories(name)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      area TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      area TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      unit TEXT NOT NULL,
      current_quantity REAL NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_products_area_active_name ON products(area, active, name)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      area TEXT NOT NULL,
      user_id INTEGER,
      user_name TEXT NOT NULL,
      operation TEXT NOT NULL,
      result TEXT NOT NULL,
      previous_quantity REAL NOT NULL,
      informed_quantity REAL NOT NULL,
      difference REAL NOT NULL,
      new_quantity REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements(created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_movements_product_id ON movements(product_id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS purchase_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      closed_by_user_id INTEGER,
      closed_by_name TEXT,
      note TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      area TEXT NOT NULL,
      added_by_user_id INTEGER,
      added_by_name TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_purchase_items_request_id ON purchase_items(request_id)`),
  ]);

  const now = new Date().toISOString();
  const categoryCount = await db.prepare("SELECT COUNT(*) AS count FROM categories").first<{ count: number }>();
  if (!categoryCount?.count) {
    await db.batch(seedCategories.map((name) => db.prepare("INSERT INTO categories (name, active, created_at, updated_at) VALUES (?, 1, ?, ?)").bind(name, now, now)));
  }

  const userCount = await db.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
  if (!userCount?.count) {
    await db.batch(seedUsers.map(([name, role, area]) => db.prepare("INSERT INTO users (name, role, area, active, created_at) VALUES (?, ?, ?, 1, ?)").bind(name, role, area, now)));
  }

  const productCount = await db.prepare("SELECT COUNT(*) AS count FROM products").first<{ count: number }>();
  if (!productCount?.count) {
    const categoryRows = await db.prepare("SELECT id, name FROM categories").all<{ id: number; name: string }>();
    const categoryIds = new Map(categoryRows.results.map((category) => [category.name, category.id]));
    await db.batch(seedProducts.map(([name, area, category, unit, quantity]) => db.prepare(
      "INSERT INTO products (name, area, category_id, unit, current_quantity, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
    ).bind(name, area, categoryIds.get(category), unit, quantity, now, now)));
  }

  const requestCount = await db.prepare("SELECT COUNT(*) AS count FROM purchase_requests").first<{ count: number }>();
  if (!requestCount?.count) {
    await db.prepare("INSERT INTO purchase_requests (status, opened_at) VALUES ('Abierta', ?)").bind(now).run();
  }
  await db.prepare("PRAGMA optimize").run();
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function textValue(value: unknown, field: string) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new Error(`${field} es obligatorio.`);
  return result;
}

function numberValue(value: unknown, field: string, allowZero = false) {
  const result = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(result) || (allowZero ? result < 0 : result <= 0)) {
    throw new Error(`${field} debe ser ${allowZero ? "cero o mayor" : "mayor que cero"}.`);
  }
  return result;
}

function areaValue(value: unknown): Area {
  if (value !== "Cocina" && value !== "Barra") throw new Error("Área inválida.");
  return value;
}

function roleValue(value: unknown): UserRole {
  if (value !== "encargado" && value !== "dueno" && value !== "administrador") throw new Error("Rol inválido.");
  return value;
}

async function findUser(idValue: unknown) {
  const id = numberValue(idValue, "Usuario");
  const user = await database().prepare("SELECT id, name, role, area, active FROM users WHERE id = ? AND active = 1").bind(id).first<UserRow>();
  if (!user) throw new Error("El usuario seleccionado ya no está disponible.");
  return user;
}

async function findProduct(idValue: unknown) {
  const id = numberValue(idValue, "Producto");
  const product = await database().prepare(`SELECT p.*, c.name AS category_name
    FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`).bind(id).first<ProductRow>();
  if (!product) throw new Error("El producto seleccionado ya no existe.");
  return product;
}

function requireAdmin(user: UserRow) {
  if (user.role !== "administrador") throw new Error("Esta acción corresponde al administrador.");
}

function requireOperator(user: UserRow) {
  if (user.role !== "encargado" && user.role !== "administrador") throw new Error("Este usuario no puede modificar el inventario.");
}

function requireProductAccess(user: UserRow, product: ProductRow) {
  requireOperator(user);
  if (user.role === "encargado" && user.area !== product.area) throw new Error("Ese producto pertenece a otra área.");
  if (!product.active) throw new Error("Ese producto está inactivo.");
}

async function requestWithItems(request: RequestRow | null) {
  if (!request) return null;
  const items = await database().prepare("SELECT * FROM purchase_items WHERE request_id = ? ORDER BY created_at, id").bind(request.id).all();
  return { ...request, items: items.results };
}

export async function GET() {
  try {
    await ensureDatabase();
    const db = database();
    const [categories, users, products, movements, openRequest, latestRequest, archived] = await Promise.all([
      db.prepare("SELECT * FROM categories ORDER BY active DESC, name COLLATE NOCASE").all(),
      db.prepare("SELECT * FROM users WHERE active = 1 ORDER BY id").all(),
      db.prepare(`SELECT p.*, c.name AS category_name FROM products p
        JOIN categories c ON c.id = p.category_id ORDER BY p.active DESC, p.area, p.name COLLATE NOCASE`).all(),
      db.prepare("SELECT * FROM movements ORDER BY created_at DESC, id DESC LIMIT 200").all(),
      db.prepare("SELECT * FROM purchase_requests WHERE status = 'Abierta' ORDER BY id DESC LIMIT 1").first<RequestRow>(),
      db.prepare("SELECT * FROM purchase_requests ORDER BY id DESC LIMIT 1").first<RequestRow>(),
      db.prepare("SELECT COUNT(*) AS count FROM purchase_requests WHERE status = 'Cerrada'").first<{ count: number }>(),
    ]);
    return Response.json({
      categories: categories.results,
      users: users.results,
      products: products.results,
      movements: movements.results,
      openRequest: await requestWithItems(openRequest),
      currentRequest: await requestWithItems(openRequest ?? latestRequest),
      archivedRequestCount: archived?.count ?? 0,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo cargar la información.", 500);
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const payload = (await request.json()) as Record<string, unknown>;
    const action = textValue(payload.action, "Acción");
    const user = await findUser(payload.userId);
    const db = database();
    const now = new Date().toISOString();

    if (action === "registerBatch") {
      requireOperator(user);
      const mode = payload.mode === "entry" ? "entry" : payload.mode === "count" ? "count" : null;
      if (!mode) throw new Error("Elegí ingreso de mercadería o conteo de stock.");
      if (!Array.isArray(payload.entries) || !payload.entries.length) throw new Error("Cargá al menos una cantidad.");
      const statements: ReturnType<typeof db.prepare>[] = [];
      for (const rawEntry of payload.entries) {
        const entry = rawEntry as Record<string, unknown>;
        const product = await findProduct(entry.productId);
        requireProductAccess(user, product);
        const informed = numberValue(entry.quantity, mode === "entry" ? "Cantidad ingresada" : "Cantidad contada", mode === "count");
        const previous = Number(product.current_quantity);
        const difference = mode === "entry" ? informed : informed - previous;
        const next = mode === "entry" ? previous + informed : informed;
        const operation = mode === "entry" ? "Ingreso de mercadería" : "Conteo de stock";
        const result = difference > 0 ? "Ingreso" : difference < 0 ? "Egreso" : "Sin variación";
        const note = typeof entry.note === "string" ? entry.note.trim() : "";
        statements.push(db.prepare("UPDATE products SET current_quantity = ?, updated_at = ? WHERE id = ?").bind(next, now, product.id));
        statements.push(db.prepare(`INSERT INTO movements
          (product_id, product_name, area, user_id, user_name, operation, result, previous_quantity, informed_quantity, difference, new_quantity, note, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
          product.id, product.name, product.area, user.id, user.name, operation, result,
          previous, informed, difference, next, note || null, now,
        ));
      }
      await db.batch(statements);
    } else if (action === "addPurchaseItem") {
      const product = await findProduct(payload.productId);
      requireProductAccess(user, product);
      const quantity = numberValue(payload.quantity, "Cantidad solicitada");
      const note = typeof payload.note === "string" ? payload.note.trim() : "";
      const open = await db.prepare("SELECT id FROM purchase_requests WHERE status = 'Abierta' ORDER BY id DESC LIMIT 1").first<{ id: number }>();
      if (!open) throw new Error("No hay una Solicitud de compra abierta.");
      await db.prepare(`INSERT INTO purchase_items
        (request_id, product_id, product_name, quantity, area, added_by_user_id, added_by_name, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(open.id, product.id, product.name, quantity, product.area, user.id, user.name, note || null, now).run();
    } else if (action === "openRequest") {
      requireOperator(user);
      const open = await db.prepare("SELECT id FROM purchase_requests WHERE status = 'Abierta' LIMIT 1").first();
      if (open) throw new Error("Ya existe una Solicitud de compra abierta.");
      await db.prepare("INSERT INTO purchase_requests (status, opened_at) VALUES ('Abierta', ?)").bind(now).run();
    } else if (action === "closeRequest") {
      requireOperator(user);
      const open = await db.prepare("SELECT id FROM purchase_requests WHERE status = 'Abierta' ORDER BY id DESC LIMIT 1").first<{ id: number }>();
      if (!open) throw new Error("No hay una Solicitud de compra abierta.");
      const note = typeof payload.note === "string" ? payload.note.trim() : "";
      await db.prepare(`UPDATE purchase_requests SET status = 'Cerrada', closed_at = ?, closed_by_user_id = ?, closed_by_name = ?, note = ? WHERE id = ?`)
        .bind(now, user.id, user.name, note || null, open.id).run();
    } else if (action === "createProduct") {
      requireAdmin(user);
      const name = textValue(payload.name, "Nombre");
      const area = areaValue(payload.area);
      const categoryId = numberValue(payload.categoryId, "Categoría");
      const unit = textValue(payload.unit, "Unidad de conteo");
      const quantity = numberValue(payload.quantity ?? 0, "Cantidad inicial", true);
      const category = await db.prepare("SELECT id FROM categories WHERE id = ? AND active = 1").bind(categoryId).first();
      if (!category) throw new Error("La categoría seleccionada no está activa.");
      await db.prepare(`INSERT INTO products (name, area, category_id, unit, current_quantity, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)`).bind(name, area, categoryId, unit, quantity, now, now).run();
    } else if (action === "updateProduct") {
      requireAdmin(user);
      const id = numberValue(payload.id, "Producto");
      const name = textValue(payload.name, "Nombre");
      const area = areaValue(payload.area);
      const categoryId = numberValue(payload.categoryId, "Categoría");
      const unit = textValue(payload.unit, "Unidad de conteo");
      const quantity = numberValue(payload.quantity, "Cantidad actual", true);
      await db.prepare("UPDATE products SET name = ?, area = ?, category_id = ?, unit = ?, current_quantity = ?, updated_at = ? WHERE id = ?")
        .bind(name, area, categoryId, unit, quantity, now, id).run();
    } else if (action === "toggleProduct") {
      requireAdmin(user);
      const id = numberValue(payload.id, "Producto");
      const active = payload.active ? 1 : 0;
      await db.prepare("UPDATE products SET active = ?, updated_at = ? WHERE id = ?").bind(active, now, id).run();
    } else if (action === "createCategory") {
      requireAdmin(user);
      const name = textValue(payload.name, "Nombre");
      const duplicate = await db.prepare("SELECT id FROM categories WHERE lower(name) = lower(?)").bind(name).first();
      if (duplicate) throw new Error("Ya existe una categoría con ese nombre.");
      await db.prepare("INSERT INTO categories (name, active, created_at, updated_at) VALUES (?, 1, ?, ?)").bind(name, now, now).run();
    } else if (action === "updateCategory") {
      requireAdmin(user);
      const id = numberValue(payload.id, "Categoría");
      const name = textValue(payload.name, "Nombre");
      await db.prepare("UPDATE categories SET name = ?, updated_at = ? WHERE id = ?").bind(name, now, id).run();
    } else if (action === "toggleCategory") {
      requireAdmin(user);
      const id = numberValue(payload.id, "Categoría");
      const active = payload.active ? 1 : 0;
      await db.prepare("UPDATE categories SET active = ?, updated_at = ? WHERE id = ?").bind(active, now, id).run();
    } else if (action === "createUser") {
      requireAdmin(user);
      const name = textValue(payload.name, "Nombre");
      const role = roleValue(payload.role);
      const area = role === "encargado" ? areaValue(payload.area) : null;
      await db.prepare("INSERT INTO users (name, role, area, active, created_at) VALUES (?, ?, ?, 1, ?)").bind(name, role, area, now).run();
    } else if (action === "deleteUser") {
      requireAdmin(user);
      const id = numberValue(payload.id, "Usuario");
      if (id === user.id) throw new Error("No podés eliminar el usuario que estás usando.");
      await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    } else {
      return jsonError("Acción no reconocida.");
    }

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo completar la operación.");
  }
}
