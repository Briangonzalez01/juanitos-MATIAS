import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("idx_categories_name").on(table.name)],
);

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    role: text("role").notNull(),
    area: text("area"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_users_role_active").on(table.role, table.active)],
);

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    area: text("area").notNull(),
    categoryId: integer("category_id").notNull(),
    unit: text("unit").notNull(),
    currentQuantity: real("current_quantity").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_products_area_active_name").on(table.area, table.active, table.name),
    index("idx_products_category_id").on(table.categoryId),
  ],
);

export const movements = sqliteTable(
  "movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id"),
    productName: text("product_name").notNull(),
    area: text("area").notNull(),
    userId: integer("user_id"),
    userName: text("user_name").notNull(),
    operation: text("operation").notNull(),
    result: text("result").notNull(),
    previousQuantity: real("previous_quantity").notNull(),
    informedQuantity: real("informed_quantity").notNull(),
    difference: real("difference").notNull(),
    newQuantity: real("new_quantity").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_movements_created_at").on(table.createdAt),
    index("idx_movements_product_id").on(table.productId),
  ],
);

export const purchaseRequests = sqliteTable(
  "purchase_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    status: text("status").notNull(),
    openedAt: text("opened_at").notNull(),
    closedAt: text("closed_at"),
    closedByUserId: integer("closed_by_user_id"),
    closedByName: text("closed_by_name"),
    note: text("note"),
  },
  (table) => [index("idx_purchase_requests_status").on(table.status)],
);

export const purchaseItems = sqliteTable(
  "purchase_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requestId: integer("request_id").notNull(),
    productId: integer("product_id"),
    productName: text("product_name").notNull(),
    quantity: real("quantity").notNull(),
    area: text("area").notNull(),
    addedByUserId: integer("added_by_user_id"),
    addedByName: text("added_by_name").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_purchase_items_request_id").on(table.requestId)],
);
