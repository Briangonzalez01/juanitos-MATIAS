"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Area = "Cocina" | "Barra";
type Role = "encargado" | "dueno" | "administrador";
type Section = "movement" | "inventory" | "request" | "ownerRequest" | "ownerInventory" | "history" | "products" | "categories" | "users";

type User = { id: number; name: string; role: Role; area: Area | null; active: number };
type Category = { id: number; name: string; active: number };
type Product = {
  id: number;
  name: string;
  area: Area;
  category_id: number;
  category_name: string;
  unit: string;
  current_quantity: number;
  active: number;
};
type Movement = {
  id: number;
  product_name: string;
  area: Area;
  user_name: string;
  operation: string;
  result: string;
  previous_quantity: number;
  informed_quantity: number;
  difference: number;
  new_quantity: number;
  note: string | null;
  created_at: string;
};
type PurchaseItem = {
  id: number;
  product_name: string;
  quantity: number;
  area: Area;
  added_by_name: string;
  note: string | null;
  created_at: string;
};
type PurchaseRequest = {
  id: number;
  status: "Abierta" | "Cerrada";
  opened_at: string;
  closed_at: string | null;
  closed_by_name: string | null;
  note: string | null;
  items: PurchaseItem[];
};
type AppState = {
  users: User[];
  categories: Category[];
  products: Product[];
  movements: Movement[];
  openRequest: PurchaseRequest | null;
  currentRequest: PurchaseRequest | null;
  archivedRequestCount: number;
};

const starterUsers: User[] = [
  { id: 1, name: "Encargado de cocina", role: "encargado", area: "Cocina", active: 1 },
  { id: 2, name: "Encargado de barra", role: "encargado", area: "Barra", active: 1 },
  { id: 3, name: "Dueño", role: "dueno", area: null, active: 1 },
  { id: 4, name: "Administrador", role: "administrador", area: null, active: 1 },
];

const navByRole: Record<Role, Array<{ id: Section; label: string }>> = {
  encargado: [
    { id: "movement", label: "Registrar movimiento de stock" },
    { id: "inventory", label: "Ver inventario" },
    { id: "request", label: "Gestionar Solicitud de compra" },
  ],
  dueno: [
    { id: "ownerRequest", label: "Ver Solicitud de compra" },
    { id: "ownerInventory", label: "Ver estado del inventario" },
  ],
  administrador: [
    { id: "inventory", label: "Inventario" },
    { id: "request", label: "Solicitudes" },
    { id: "history", label: "Historial" },
    { id: "products", label: "Productos" },
    { id: "categories", label: "Categorías" },
    { id: "users", label: "Usuarios" },
  ],
};

const headings: Record<Section, { title: string; description: string }> = {
  movement: { title: "Registrar movimiento de stock", description: "Cargá ingresos o conteos para los productos de tu área." },
  inventory: { title: "Inventario", description: "Últimas cantidades conocidas por el sistema." },
  request: { title: "Gestionar Solicitud de compra", description: "Agregá faltantes o cerrá la lista cuando termine el conteo." },
  ownerRequest: { title: "Solicitud de compra", description: "La lista más reciente de lo que hace falta comprar." },
  ownerInventory: { title: "Estado del inventario", description: "Cantidades registradas de cocina y barra." },
  history: { title: "Historial", description: "Registro individual de ingresos y conteos." },
  products: { title: "Productos", description: "Configuración simple de las existencias controladas." },
  categories: { title: "Categorías", description: "Organizá los productos con una lista breve y clara." },
  users: { title: "Usuarios", description: "Administrá las personas disponibles en la selección inicial." },
};

function initialSection(role: Role): Section {
  return role === "dueno" ? "ownerRequest" : role === "administrador" ? "inventory" : "movement";
}

function roleLabel(user: User) {
  if (user.role === "administrador") return "Administrador";
  if (user.role === "dueno") return "Dueño";
  return `Encargado · ${user.area}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function InventoryApp() {
  const [data, setData] = useState<AppState | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [section, setSection] = useState<Section>("movement");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/inventory", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar la información.");
      setData(payload);
      setCurrentUser((selected) => selected ? payload.users.find((user: User) => user.id === selected.id) ?? null : null);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "No se pudo cargar la información." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function post(payload: Record<string, unknown>, success: string) {
    if (!currentUser) return false;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, userId: currentUser.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo completar la operación.");
      await load();
      setNotice({ type: "success", message: success });
      return true;
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "No se pudo completar la operación." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser) {
    const users = data?.users ?? starterUsers;
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand login-brand"><span className="brand-mark">J</span><span><strong>Juanitos</strong><small>Inventario y Solicitudes</small></span></div>
          <span className="eyebrow">Prototipo operativo</span>
          <h1>Seleccioná tu usuario</h1>
          <p>La app mostrará solamente las funciones que corresponden a cada persona.</p>
          <div className="user-grid">
            {users.map((user) => (
              <button key={user.id} className="user-card" disabled={loading} onClick={() => { setCurrentUser(user); setSection(initialSection(user.role)); setNotice(null); }}>
                <span className={`user-avatar ${user.role}`}>{user.name.charAt(0)}</span>
                <strong>{user.name}</strong>
                <small>{roleLabel(user)}</small>
              </button>
            ))}
          </div>
          {loading && <div className="loading-state" role="status">Preparando los datos de prueba…</div>}
          {notice && <div className={`notice ${notice.type}`} role="status">{notice.message}</div>}
          <p className="login-note">El stock cambia únicamente cuando alguien registra un ingreso o un conteo.</p>
        </section>
      </main>
    );
  }

  const heading = headings[section];
  const nav = navByRole[currentUser.role];
  const activeProducts = data?.products.filter((product) => product.active && (currentUser.role !== "encargado" || product.area === currentUser.area)) ?? [];
  const inventoryProducts = data?.products.filter((product) => currentUser.role === "administrador" || product.active).filter((product) => currentUser.role !== "encargado" || product.area === currentUser.area) ?? [];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">J</span><span><strong>Juanitos</strong><small>Inventario y Solicitudes</small></span></div>
        <nav className="side-nav" aria-label="Secciones principales">
          {nav.map((item) => <button key={item.id} className={section === item.id ? "nav-item active" : "nav-item"} onClick={() => { setSection(item.id); setNotice(null); }}>{item.label}</button>)}
        </nav>
        <div className="sidebar-note"><strong>Actualización manual</strong><span>No se descuentan ventas ni consumos automáticamente.</span></div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div><span className="eyebrow">{roleLabel(currentUser)}</span><h1>{heading.title}</h1><p>{heading.description}</p></div>
          <button className="user-switch" onClick={() => { setCurrentUser(null); setNotice(null); }}><span>{currentUser.name}</span><small>Cambiar usuario</small></button>
        </header>
        {notice && <div className={`notice ${notice.type}`} role="status">{notice.message}</div>}
        {!data ? <div className="loading-state" role="status">Cargando la información…</div> : (
          <div className="content-area">
            {section === "movement" && <MovementSection products={activeProducts} busy={busy} post={post} />}
            {(section === "inventory" || section === "ownerInventory") && <InventorySection products={inventoryProducts} />}
            {section === "request" && <RequestSection request={data.openRequest} products={activeProducts} archivedCount={data.archivedRequestCount} busy={busy} post={post} />}
            {section === "ownerRequest" && <OwnerRequestSection request={data.currentRequest} />}
            {section === "history" && <HistorySection movements={data.movements} />}
            {section === "products" && <ProductsSection products={data.products} categories={data.categories} busy={busy} post={post} />}
            {section === "categories" && <CategoriesSection categories={data.categories} busy={busy} post={post} />}
            {section === "users" && <UsersSection users={data.users} currentUser={currentUser} busy={busy} post={post} />}
          </div>
        )}
      </section>
    </main>
  );
}

function MovementSection({ products, busy, post }: { products: Product[]; busy: boolean; post: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const [mode, setMode] = useState<"entry" | "count">("entry");
  const [values, setValues] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entries = products.filter((product) => (values[product.id] ?? "").trim() !== "").map((product) => ({ productId: product.id, quantity: values[product.id], note: notes[product.id] ?? "" }));
    const ok = await post({ action: "registerBatch", mode, entries }, mode === "entry" ? "Ingresos registrados correctamente." : "Conteo registrado y existencias actualizadas.");
    if (ok) { setValues({}); setNotes({}); }
  }

  return (
    <section className="panel movement-panel">
      <div className="mode-picker" role="group" aria-label="Tipo de registro">
        <button type="button" className={mode === "entry" ? "mode-card active" : "mode-card"} onClick={() => setMode("entry")}><strong>Ingreso de mercadería</strong><span>Sumar cantidades que llegaron</span></button>
        <button type="button" className={mode === "count" ? "mode-card active" : "mode-card"} onClick={() => setMode("count")}><strong>Conteo de stock</strong><span>Reemplazar por la cantidad contada</span></button>
      </div>
      <div className="panel-heading"><div><h2>{mode === "entry" ? "Cantidades que ingresaron" : "Cantidades contadas"}</h2><p>Completá solamente los productos que quieras registrar. Las filas vacías no cambian.</p></div><span className="status-chip">{products.length} productos</span></div>
      {!products.length ? <Empty message="No hay productos activos en esta área." /> : (
        <form onSubmit={submit}>
          <div className="table-wrap batch-table"><table><thead><tr><th>Producto</th><th>Categoría</th><th>Unidad</th><th>Actual</th><th>{mode === "entry" ? "Ingresó" : "Contado"}</th><th>Nota opcional</th></tr></thead><tbody>
            {products.map((product) => <tr key={product.id}><td><strong>{product.name}</strong></td><td>{product.category_name}</td><td>{product.unit}</td><td><strong>{formatNumber(product.current_quantity)}</strong></td><td><input aria-label={`${mode === "entry" ? "Ingreso" : "Conteo"} de ${product.name}`} type="number" min="0" step="0.01" placeholder="—" value={values[product.id] ?? ""} onChange={(event) => setValues({ ...values, [product.id]: event.target.value })} /></td><td><input aria-label={`Nota de ${product.name}`} placeholder="Opcional" value={notes[product.id] ?? ""} onChange={(event) => setNotes({ ...notes, [product.id]: event.target.value })} /></td></tr>)}
          </tbody></table></div>
          <div className="form-actions"><span>Los campos vacíos no se interpretan como cero.</span><button className="button primary" disabled={busy}>{busy ? "Guardando…" : mode === "entry" ? "Registrar ingresos" : "Registrar conteo"}</button></div>
        </form>
      )}
    </section>
  );
}

function InventorySection({ products }: { products: Product[] }) {
  return <section className="panel"><div className="panel-heading"><div><h2>Existencias registradas</h2><p>La última cantidad conocida, no stock en tiempo real.</p></div><span className="status-chip">{products.length} productos</span></div>
    {!products.length ? <Empty message="Todavía no hay productos para mostrar." /> : <div className="table-wrap"><table><thead><tr><th>Producto</th><th>Área</th><th>Categoría</th><th>Unidad</th><th>Cantidad actual</th><th>Estado</th></tr></thead><tbody>{products.map((product) => <tr key={product.id} className={!product.active ? "muted-row" : ""}><td><strong>{product.name}</strong></td><td>{product.area}</td><td>{product.category_name}</td><td>{product.unit}</td><td className="quantity-cell">{formatNumber(product.current_quantity)}</td><td><span className={`status-chip ${product.active ? "active-status" : "inactive-status"}`}>{product.active ? "Activo" : "Inactivo"}</span></td></tr>)}</tbody></table></div>}
  </section>;
}

function RequestSection({ request, products, archivedCount, busy, post }: { request: PurchaseRequest | null; products: Product[]; archivedCount: number; busy: boolean; post: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const [productId, setProductId] = useState(products[0]?.id ?? 0);
  useEffect(() => { if (!products.some((product) => product.id === productId)) setProductId(products[0]?.id ?? 0); }, [products, productId]);
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const ok = await post({ action: "addPurchaseItem", productId, quantity: values.get("quantity"), note: values.get("note") }, "Producto agregado a la Solicitud.");
    if (ok) form.reset();
  }
  if (!request) return <section className="panel centered-panel"><span className="empty-icon">+</span><h2>No hay una Solicitud abierta</h2><p>Abrí una nueva cuando comience el próximo ciclo de compra.</p><button className="button primary" disabled={busy} onClick={() => void post({ action: "openRequest" }, "Nueva Solicitud de compra abierta.")}>Abrir nueva Solicitud</button><small>{archivedCount} solicitudes archivadas</small></section>;
  return <div className="two-column request-layout">
    <section className="panel form-panel compact"><div className="form-copy"><div><h2>Agregar faltante</h2><p>Agregarlo no modifica el inventario.</p></div></div>
      {!products.length ? <Empty message="No hay productos disponibles para este usuario." /> : <form className="simple-form" onSubmit={add}><label><span>Producto</span><select value={productId} onChange={(event) => setProductId(Number(event.target.value))}>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.unit}</option>)}</select></label><label><span>Cantidad solicitada</span><input name="quantity" type="number" min="0.01" step="0.01" required /></label><label><span>Nota <em>opcional</em></span><textarea name="note" rows={3} placeholder="Marca, presentación u otra aclaración" /></label><button className="button primary wide" disabled={busy}>{busy ? "Agregando…" : "Agregar a Solicitud"}</button></form>}
    </section>
    <div><RequestList request={request} /><form className="close-request" onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void post({ action: "closeRequest", note: values.get("note") }, "Solicitud cerrada y archivada."); }}><label><span>Nota de cierre <em>opcional</em></span><input name="note" placeholder="Aclaración general" /></label><button className="button secondary" disabled={busy}>Cerrar Solicitud</button></form></div>
  </div>;
}

function OwnerRequestSection({ request }: { request: PurchaseRequest | null }) {
  return <><div className="owner-summary"><div><span>Solicitud consultada</span><strong>{request ? `#${request.id}` : "Sin solicitudes"}</strong></div><div><span>Estado</span><strong>{request?.status ?? "—"}</strong></div><div><span>Productos solicitados</span><strong>{request?.items.length ?? 0}</strong></div></div><RequestList request={request} ownerView /></>;
}

function RequestList({ request, ownerView = false }: { request: PurchaseRequest | null; ownerView?: boolean }) {
  return <section className="panel request-panel"><div className="panel-heading"><div><h2>Solicitud de compra</h2><p>{request ? `${request.status} · abierta ${formatDate(request.opened_at)}` : "No hay una Solicitud registrada"}</p></div>{request && <span className={`status-chip ${request.status === "Abierta" ? "open" : "closed"}`}>{request.status}</span>}</div>
    {!request?.items.length ? <Empty message={request ? "Todavía no se agregaron productos." : "No hay información para mostrar."} /> : <div className="request-list">{request.items.map((item) => <article className="request-item" key={item.id}><div><strong>{item.product_name}</strong><span>{item.area}{ownerView ? "" : ` · ${item.added_by_name}`}</span>{item.note && <small>{item.note}</small>}</div><b>{formatNumber(item.quantity)}</b></article>)}</div>}
    {request?.status === "Cerrada" && <div className="request-footer"><span>Cerrada {request.closed_at ? formatDate(request.closed_at) : ""}{request.closed_by_name ? ` por ${request.closed_by_name}` : ""}</span>{request.note && <strong>{request.note}</strong>}</div>}
  </section>;
}

function HistorySection({ movements }: { movements: Movement[] }) {
  return <section className="panel"><div className="panel-heading"><div><h2>Últimos registros</h2><p>Cada producto genera un movimiento individual.</p></div><span className="status-chip">{movements.length} movimientos</span></div>{!movements.length ? <Empty message="Todavía no hay movimientos." /> : <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Producto</th><th>Operación</th><th>Anterior</th><th>Informada</th><th>Diferencia</th><th>Nueva</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{formatDate(movement.created_at)}</td><td>{movement.user_name}</td><td><strong>{movement.product_name}</strong><small>{movement.area}</small></td><td>{movement.operation}<small>{movement.result}{movement.note ? ` · ${movement.note}` : ""}</small></td><td>{formatNumber(movement.previous_quantity)}</td><td>{formatNumber(movement.informed_quantity)}</td><td className={movement.difference < 0 ? "negative" : movement.difference > 0 ? "positive" : ""}>{movement.difference > 0 ? "+" : ""}{formatNumber(movement.difference)}</td><td><strong>{formatNumber(movement.new_quantity)}</strong></td></tr>)}</tbody></table></div>}</section>;
}

function ProductsSection({ products, categories, busy, post }: { products: Product[]; categories: Category[]; busy: boolean; post: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const activeCategories = categories.filter((category) => category.active);
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); const ok = await post({ action: "createProduct", name: values.get("name"), area: values.get("area"), categoryId: values.get("categoryId"), unit: values.get("unit"), quantity: values.get("quantity") }, "Producto creado correctamente."); if (ok) form.reset(); }
  async function update(event: FormEvent<HTMLFormElement>, product: Product) { event.preventDefault(); const values = new FormData(event.currentTarget); await post({ action: "updateProduct", id: product.id, name: values.get("name"), area: values.get("area"), categoryId: values.get("categoryId"), unit: values.get("unit"), quantity: values.get("quantity") }, "Producto actualizado."); }
  return <div className="stacked-content"><section className="panel form-panel compact"><div className="form-copy"><div><h2>Nuevo producto</h2><p>Definí sus datos y la cantidad inicial.</p></div></div><form className="inline-create" onSubmit={create}><label><span>Nombre</span><input name="name" required /></label><label><span>Área</span><select name="area"><option>Cocina</option><option>Barra</option></select></label><label><span>Categoría</span><select name="categoryId">{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label><span>Unidad</span><input name="unit" required placeholder="Kg, unidad, paquete" /></label><label><span>Cantidad inicial</span><input name="quantity" type="number" min="0" step="0.01" defaultValue="0" required /></label><button className="button primary" disabled={busy}>Crear producto</button></form></section>
    <section className="panel"><div className="panel-heading"><div><h2>Productos configurados</h2><p>Podés editar o desactivar sin perder registros anteriores.</p></div></div><div className="editable-list product-editor">{products.map((product) => <form key={product.id} className={`editable-row product-row ${!product.active ? "inactive-row" : ""}`} onSubmit={(event) => void update(event, product)}><input name="name" defaultValue={product.name} aria-label={`Nombre de ${product.name}`} required /><select name="area" defaultValue={product.area} aria-label={`Área de ${product.name}`}><option>Cocina</option><option>Barra</option></select><select name="categoryId" defaultValue={product.category_id} aria-label={`Categoría de ${product.name}`}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><input name="unit" defaultValue={product.unit} aria-label={`Unidad de ${product.name}`} required /><input name="quantity" type="number" min="0" step="0.01" defaultValue={product.current_quantity} aria-label={`Cantidad de ${product.name}`} required /><button className="text-button" disabled={busy}>Guardar</button><button type="button" className={`text-button ${product.active ? "danger" : ""}`} disabled={busy} onClick={() => void post({ action: "toggleProduct", id: product.id, active: !product.active }, product.active ? "Producto desactivado." : "Producto reactivado.")}>{product.active ? "Desactivar" : "Reactivar"}</button></form>)}</div></section>
  </div>;
}

function CategoriesSection({ categories, busy, post }: { categories: Category[]; busy: boolean; post: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); const ok = await post({ action: "createCategory", name: values.get("name") }, "Categoría creada."); if (ok) form.reset(); }
  return <div className="two-column"><section className="panel form-panel compact"><div className="form-copy"><div><h2>Nueva categoría</h2><p>Usá nombres simples y fáciles de reconocer.</p></div></div><form className="simple-form" onSubmit={create}><label><span>Nombre</span><input name="name" required placeholder="Ej. Envases" /></label><button className="button primary wide" disabled={busy}>Crear categoría</button></form></section><section className="panel"><div className="panel-heading"><div><h2>Categorías</h2><p>{categories.length} configuradas</p></div></div><div className="editable-list">{categories.map((category) => <form key={category.id} className={`editable-row category-row ${!category.active ? "inactive-row" : ""}`} onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void post({ action: "updateCategory", id: category.id, name: values.get("name") }, "Categoría actualizada."); }}><input name="name" defaultValue={category.name} aria-label={`Nombre de ${category.name}`} required /><span>{category.active ? "Activa" : "Inactiva"}</span><button className="text-button" disabled={busy}>Guardar</button><button type="button" className={`text-button ${category.active ? "danger" : ""}`} disabled={busy} onClick={() => void post({ action: "toggleCategory", id: category.id, active: !category.active }, category.active ? "Categoría desactivada." : "Categoría reactivada.")}>{category.active ? "Desactivar" : "Reactivar"}</button></form>)}</div></section></div>;
}

function UsersSection({ users, currentUser, busy, post }: { users: User[]; currentUser: User; busy: boolean; post: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const [role, setRole] = useState<Role>("encargado");
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); const ok = await post({ action: "createUser", name: values.get("name"), role, area: values.get("area") }, "Usuario creado."); if (ok) form.reset(); }
  return <div className="two-column"><section className="panel form-panel compact"><div className="form-copy"><div><h2>Nuevo usuario</h2><p>Quedará disponible en la pantalla inicial.</p></div></div><form className="simple-form" onSubmit={create}><label><span>Nombre visible</span><input name="name" required placeholder="Ej. Martina · Cocina" /></label><label><span>Rol</span><select value={role} onChange={(event) => setRole(event.target.value as Role)}><option value="encargado">Encargado</option><option value="dueno">Dueño</option><option value="administrador">Administrador</option></select></label>{role === "encargado" && <label><span>Área</span><select name="area"><option>Cocina</option><option>Barra</option></select></label>}<button className="button primary wide" disabled={busy}>Crear usuario</button></form></section><section className="panel"><div className="panel-heading"><div><h2>Usuarios disponibles</h2><p>{users.length} usuarios activos</p></div></div><div className="user-list">{users.map((user) => <article key={user.id} className="user-list-item"><span className={`user-avatar ${user.role}`}>{user.name.charAt(0)}</span><div><strong>{user.name}</strong><small>{roleLabel(user)}</small></div><button className="text-button danger" disabled={busy || user.id === currentUser.id} onClick={() => { if (window.confirm(`¿Eliminar ${user.name}?`)) void post({ action: "deleteUser", id: user.id }, "Usuario eliminado."); }}>Eliminar</button></article>)}</div></section></div>;
}

function Empty({ message }: { message: string }) {
  return <div className="empty-inline">{message}</div>;
}
