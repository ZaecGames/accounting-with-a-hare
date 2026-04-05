import { useCallback, useEffect, useState } from "react";

const LS = "ma_token";

const TABS = [
  { id: "nom", label: "Номенклатура" },
  { id: "wh", label: "Склады" },
  { id: "mov", label: "Движения" },
  { id: "bal", label: "Остатки" },
];

const movTypeLabel = (t) =>
  ({ receipt: "Приход", issue: "Расход", transfer: "Перемещение" }[t] || t);

function AuthScreen({ onLoggedIn }) {
  const [mode, setMode] = useState("login");
  const [msg, setMsg] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [regForm, setRegForm] = useState({
    username: "",
    full_name: "",
    password: "",
    password2: "",
  });

  async function postAuth(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const detail =
        data && typeof data === "object" && data.detail
          ? typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail)
          : String(data || res.statusText);
      throw new Error(detail);
    }
    return data;
  }

  async function onLogin(e) {
    e.preventDefault();
    setMsg(null);
    try {
      const data = await postAuth("/api/auth/login", {
        username: loginForm.username,
        password: loginForm.password,
      });
      onLoggedIn(data.access_token, data);
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    }
  }

  async function onRegister(e) {
    e.preventDefault();
    setMsg(null);
    if (regForm.password !== regForm.password2) {
      setMsg({ type: "error", text: "Пароли не совпадают" });
      return;
    }
    try {
      const data = await postAuth("/api/auth/register", {
        username: regForm.username.trim(),
        password: regForm.password,
        full_name: regForm.full_name.trim() || null,
      });
      onLoggedIn(data.access_token, data);
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon">📦</div>
          <h1>Учёт материалов</h1>
          <p>Войдите или зарегистрируйтесь как сотрудник</p>
        </div>
        <div className="auth-switch">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setMsg(null);
            }}
          >
            Вход
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setMsg(null);
            }}
          >
            Регистрация
          </button>
        </div>
        {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
        {mode === "login" ? (
          <form onSubmit={onLogin}>
            <div className="field">
              <label>Логин</label>
              <input
                value={loginForm.username}
                onChange={(e) =>
                  setLoginForm((f) => ({ ...f, username: e.target.value }))
                }
                autoComplete="username"
                required
              />
            </div>
            <div className="field">
              <label>Пароль</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm((f) => ({ ...f, password: e.target.value }))
                }
                autoComplete="current-password"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Войти
            </button>
          </form>
        ) : (
          <form onSubmit={onRegister}>
            <div className="field">
              <label>Логин</label>
              <input
                value={regForm.username}
                onChange={(e) =>
                  setRegForm((f) => ({ ...f, username: e.target.value }))
                }
                minLength={3}
                autoComplete="username"
                required
              />
            </div>
            <div className="field">
              <label>Как к вам обращаться</label>
              <input
                value={regForm.full_name}
                onChange={(e) =>
                  setRegForm((f) => ({ ...f, full_name: e.target.value }))
                }
                placeholder="Необязательно"
              />
            </div>
            <div className="field">
              <label>Пароль</label>
              <input
                type="password"
                value={regForm.password}
                onChange={(e) =>
                  setRegForm((f) => ({ ...f, password: e.target.value }))
                }
                minLength={6}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="field">
              <label>Повтор пароля</label>
              <input
                type="password"
                value={regForm.password2}
                onChange={(e) =>
                  setRegForm((f) => ({ ...f, password2: e.target.value }))
                }
                minLength={6}
                autoComplete="new-password"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Создать аккаунт
            </button>
          </form>
        )}
        <p className="hint-admin">
          <strong>Админ по умолчанию:</strong> <code>admin</code> / <code>admin</code>{" "}
          при пустой базе. Для продакшена задайте{" "}
          <code>INITIAL_ADMIN_PASSWORD</code> и <code>JWT_SECRET</code>.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(LS));
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(!!localStorage.getItem(LS));

  const logout = useCallback(() => {
    localStorage.removeItem(LS);
    setToken(null);
    setUser(null);
  }, []);

  const api = useCallback(
    async (path, options = {}) => {
      const headers = {
        "Content-Type": "application/json",
        ...options.headers,
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(path, { ...options, headers });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      if (res.status === 401) {
        logout();
        throw new Error("Сессия истекла — войдите снова");
      }
      if (!res.ok) {
        const detail =
          data && typeof data === "object" && data.detail
            ? typeof data.detail === "string"
              ? data.detail
              : JSON.stringify(data.detail)
            : String(data || res.statusText);
        throw new Error(detail);
      }
      return data;
    },
    [token, logout]
  );

  useEffect(() => {
    if (!token) {
      setUser(null);
      setBooting(false);
      return;
    }
    let cancel = false;
    setBooting(true);
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 401) {
          logout();
          return null;
        }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((me) => {
        if (!cancel && me) setUser(me);
      })
      .catch(() => {
        if (!cancel) logout();
      })
      .finally(() => {
        if (!cancel) setBooting(false);
      });
    return () => {
      cancel = true;
    };
  }, [token, logout]);

  function onLoggedIn(accessToken, payload) {
    localStorage.setItem(LS, accessToken);
    setToken(accessToken);
    setUser({
      username: payload.username,
      full_name: payload.full_name,
      role: payload.role,
      id: 0,
    });
  }

  if (booting) {
    return (
      <div className="auth-wrap">
        <p style={{ color: "var(--muted)" }}>Загрузка…</p>
      </div>
    );
  }

  if (!token || !user) {
    return <AuthScreen onLoggedIn={onLoggedIn} />;
  }

  return (
    <MainApp user={user} logout={logout} api={api} token={token} />
  );
}

function MainApp({ user, logout, api, token }) {
  const [tab, setTab] = useState("nom");
  const [message, setMessage] = useState(null);
  const [nomenclature, setNomenclature] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [movements, setMovements] = useState([]);
  const [balances, setBalances] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);

  const isAdmin = user.role === "admin";
  const displayName = user.full_name || user.username;
  const avatarLetter = (displayName[0] || "?").toUpperCase();

  const showErr = (e) =>
    setMessage({ type: "error", text: e.message || String(e) });
  const showOk = (text) => setMessage({ type: "ok", text });

  const refreshAll = useCallback(async () => {
    try {
      const [n, w, m, b] = await Promise.all([
        api("/api/nomenclature"),
        api("/api/warehouses"),
        api("/api/movements"),
        api("/api/balances"),
      ]);
      setNomenclature(n);
      setWarehouses(w);
      setMovements(m);
      setBalances(b);
      if (isAdmin) {
        const u = await api("/api/admin/users");
        setAdminUsers(u);
      }
    } catch (e) {
      showErr(e);
    }
  }, [api, isAdmin]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(t);
  }, [message]);

  const [nomForm, setNomForm] = useState({ sku: "", name: "", unit: "шт" });
  const [whForm, setWhForm] = useState({ code: "", name: "" });
  const [movForm, setMovForm] = useState({
    doc_number: "",
    movement_type: "receipt",
    nomenclature_id: "",
    quantity: "",
    warehouse_to_id: "",
    warehouse_from_id: "",
    note: "",
  });
  const [adminForm, setAdminForm] = useState({
    username: "",
    full_name: "",
    password: "",
    role: "user",
  });

  async function addNomenclature(e) {
    e.preventDefault();
    try {
      await api("/api/nomenclature", {
        method: "POST",
        body: JSON.stringify({
          sku: nomForm.sku.trim(),
          name: nomForm.name.trim(),
          unit: nomForm.unit.trim() || "шт",
        }),
      });
      setNomForm({ sku: "", name: "", unit: "шт" });
      showOk("Номенклатура добавлена");
      refreshAll();
    } catch (e) {
      showErr(e);
    }
  }

  async function addWarehouse(e) {
    e.preventDefault();
    try {
      await api("/api/warehouses", {
        method: "POST",
        body: JSON.stringify({
          code: whForm.code.trim(),
          name: whForm.name.trim(),
        }),
      });
      setWhForm({ code: "", name: "" });
      showOk("Склад добавлен");
      refreshAll();
    } catch (e) {
      showErr(e);
    }
  }

  async function addMovement(e) {
    e.preventDefault();
    const body = {
      doc_number: movForm.doc_number.trim(),
      movement_type: movForm.movement_type,
      nomenclature_id: Number(movForm.nomenclature_id),
      quantity: Number(movForm.quantity),
      warehouse_to_id: movForm.warehouse_to_id
        ? Number(movForm.warehouse_to_id)
        : null,
      warehouse_from_id: movForm.warehouse_from_id
        ? Number(movForm.warehouse_from_id)
        : null,
      note: movForm.note.trim() || null,
    };
    try {
      await api("/api/movements", { method: "POST", body: JSON.stringify(body) });
      setMovForm((f) => ({
        ...f,
        doc_number: "",
        quantity: "",
        note: "",
      }));
      showOk("Документ проведён");
      refreshAll();
    } catch (e) {
      showErr(e);
    }
  }

  async function delNom(id) {
    if (!confirm("Удалить номенклатуру?")) return;
    try {
      await api(`/api/nomenclature/${id}`, { method: "DELETE" });
      showOk("Удалено");
      refreshAll();
    } catch (e) {
      showErr(e);
    }
  }

  async function delWh(id) {
    if (!confirm("Удалить склад?")) return;
    try {
      await api(`/api/warehouses/${id}`, { method: "DELETE" });
      showOk("Удалено");
      refreshAll();
    } catch (e) {
      showErr(e);
    }
  }

  async function addAdminUser(e) {
    e.preventDefault();
    try {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          username: adminForm.username.trim(),
          password: adminForm.password,
          full_name: adminForm.full_name.trim() || null,
          role: adminForm.role,
        }),
      });
      setAdminForm({ username: "", full_name: "", password: "", role: "user" });
      showOk("Пользователь создан");
      refreshAll();
    } catch (e) {
      showErr(e);
    }
  }

  async function exportXml() {
    try {
      const res = await fetch("/api/export/1c-commerceml", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) throw new Error("Не удалось скачать файл");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "material_balances_commerceml.xml";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showErr(e);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-dot" />
          Учёт ТМЦ
        </div>
        <nav className="topbar-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
          {isAdmin && (
            <button
              type="button"
              className={tab === "admin" ? "active" : ""}
              onClick={() => setTab("admin")}
            >
              Пользователи
            </button>
          )}
        </nav>
        <div className="user-area">
          <div className="user-pill">
            <div className="user-avatar">{avatarLetter}</div>
            <div>
              <div style={{ fontWeight: 600 }}>{displayName}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                @{user.username}
              </div>
            </div>
            <span className={`role-badge${isAdmin ? " admin" : ""}`}>
              {isAdmin ? "админ" : "сотрудник"}
            </span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>

      <div className="main-wrap">
        {message && (
          <div className={`msg ${message.type}`}>{message.text}</div>
        )}

        <div className="toolbar-row">
          <button type="button" className="btn btn-ghost" onClick={exportXml}>
            ⬇ Скачать XML (1С)
          </button>
          <button type="button" className="btn btn-ghost" onClick={refreshAll}>
            Обновить
          </button>
        </div>

        {tab === "nom" && (
          <div className="panel">
            <h2>Номенклатура</h2>
            <form onSubmit={addNomenclature} className="form-grid cols-2">
              <div className="field">
                <label>Артикул (SKU)</label>
                <input
                  value={nomForm.sku}
                  onChange={(e) =>
                    setNomForm((f) => ({ ...f, sku: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="field">
                <label>Ед. изм.</label>
                <input
                  value={nomForm.unit}
                  onChange={(e) =>
                    setNomForm((f) => ({ ...f, unit: e.target.value }))
                  }
                />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Наименование</label>
                <input
                  value={nomForm.name}
                  onChange={(e) =>
                    setNomForm((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>
                  Добавить
                </button>
              </div>
            </form>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Наименование</th>
                  <th>Ед.</th>
                  {isAdmin && <th />}
                </tr>
              </thead>
              <tbody>
                {nomenclature.map((n) => (
                  <tr key={n.id}>
                    <td>{n.sku}</td>
                    <td>{n.name}</td>
                    <td>{n.unit}</td>
                    {isAdmin && (
                      <td>
                        <button
                          type="button"
                          className="btn-sm-danger"
                          onClick={() => delNom(n.id)}
                        >
                          Удалить
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "wh" && (
          <div className="panel">
            <h2>Склады</h2>
            <form onSubmit={addWarehouse} className="form-grid cols-2">
              <div className="field">
                <label>Код</label>
                <input
                  value={whForm.code}
                  onChange={(e) =>
                    setWhForm((f) => ({ ...f, code: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="field">
                <label>Наименование</label>
                <input
                  value={whForm.name}
                  onChange={(e) =>
                    setWhForm((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>
                  Добавить склад
                </button>
              </div>
            </form>
            <table>
              <thead>
                <tr>
                  <th>Код</th>
                  <th>Наименование</th>
                  {isAdmin && <th />}
                </tr>
              </thead>
              <tbody>
                {warehouses.map((w) => (
                  <tr key={w.id}>
                    <td>{w.code}</td>
                    <td>{w.name}</td>
                    {isAdmin && (
                      <td>
                        <button
                          type="button"
                          className="btn-sm-danger"
                          onClick={() => delWh(w.id)}
                        >
                          Удалить
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "mov" && (
          <div className="panel">
            <h2>Движение товаров</h2>
            <form onSubmit={addMovement} className="form-grid cols-2">
              <div className="field">
                <label>№ документа</label>
                <input
                  value={movForm.doc_number}
                  onChange={(e) =>
                    setMovForm((f) => ({ ...f, doc_number: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="field">
                <label>Тип</label>
                <select
                  value={movForm.movement_type}
                  onChange={(e) => {
                    const t = e.target.value;
                    setMovForm((f) => ({
                      ...f,
                      movement_type: t,
                      warehouse_from_id: t === "receipt" ? "" : f.warehouse_from_id,
                      warehouse_to_id: t === "issue" ? "" : f.warehouse_to_id,
                    }));
                  }}
                >
                  <option value="receipt">Приход</option>
                  <option value="issue">Расход</option>
                  <option value="transfer">Перемещение</option>
                </select>
              </div>
              <div className="field">
                <label>Номенклатура</label>
                <select
                  value={movForm.nomenclature_id}
                  onChange={(e) =>
                    setMovForm((f) => ({
                      ...f,
                      nomenclature_id: e.target.value,
                    }))
                  }
                  required
                >
                  <option value="">— выберите —</option>
                  {nomenclature.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.sku} — {n.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Количество</label>
                <input
                  type="number"
                  step="any"
                  min="0.000001"
                  value={movForm.quantity}
                  onChange={(e) =>
                    setMovForm((f) => ({ ...f, quantity: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="field">
                <label>Склад «куда»</label>
                <select
                  value={movForm.warehouse_to_id}
                  onChange={(e) =>
                    setMovForm((f) => ({
                      ...f,
                      warehouse_to_id: e.target.value,
                    }))
                  }
                >
                  <option value="">—</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Склад «откуда»</label>
                <select
                  value={movForm.warehouse_from_id}
                  onChange={(e) =>
                    setMovForm((f) => ({
                      ...f,
                      warehouse_from_id: e.target.value,
                    }))
                  }
                >
                  <option value="">—</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Примечание</label>
                <input
                  value={movForm.note}
                  onChange={(e) =>
                    setMovForm((f) => ({ ...f, note: e.target.value }))
                  }
                />
              </div>
              <div>
                <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>
                  Провести документ
                </button>
              </div>
            </form>
            <p className="subtle">
              Приход — «куда». Расход — «откуда». Перемещение — оба склада.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Док.</th>
                  <th>Тип</th>
                  <th>Кол-во</th>
                  <th>Откуда → Куда</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{m.doc_number}</td>
                    <td>{movTypeLabel(m.movement_type)}</td>
                    <td>{m.quantity}</td>
                    <td>
                      {m.warehouse_from_id ?? "—"} → {m.warehouse_to_id ?? "—"}
                    </td>
                    <td>
                      {m.created_at
                        ? new Date(m.created_at).toLocaleString("ru-RU")
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "bal" && (
          <div className="panel">
            <h2>Остатки по складам</h2>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>ТМЦ</th>
                  <th>Склад</th>
                  <th>Остаток</th>
                  <th>Ед.</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b, i) => (
                  <tr key={`${b.nomenclature_id}-${b.warehouse_id}-${i}`}>
                    <td>{b.sku}</td>
                    <td>{b.name}</td>
                    <td>
                      {b.warehouse_code} — {b.warehouse_name}
                    </td>
                    <td>{b.quantity}</td>
                    <td>{b.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {balances.length === 0 && (
              <p className="subtle">Нет ненулевых остатков.</p>
            )}
          </div>
        )}

        {tab === "admin" && isAdmin && (
          <div className="panel">
            <h2>Пользователи</h2>
            <div className="admin-grid">
              <div>
                <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
                  Новый пользователь
                </h3>
                <form onSubmit={addAdminUser} className="form-grid">
                  <div className="field">
                    <label>Логин</label>
                    <input
                      value={adminForm.username}
                      onChange={(e) =>
                        setAdminForm((f) => ({ ...f, username: e.target.value }))
                      }
                      required
                      minLength={3}
                    />
                  </div>
                  <div className="field">
                    <label>Имя</label>
                    <input
                      value={adminForm.full_name}
                      onChange={(e) =>
                        setAdminForm((f) => ({ ...f, full_name: e.target.value }))
                      }
                      placeholder="Необязательно"
                    />
                  </div>
                  <div className="field">
                    <label>Пароль</label>
                    <input
                      type="password"
                      value={adminForm.password}
                      onChange={(e) =>
                        setAdminForm((f) => ({ ...f, password: e.target.value }))
                      }
                      minLength={6}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Роль</label>
                    <select
                      value={adminForm.role}
                      onChange={(e) =>
                        setAdminForm((f) => ({ ...f, role: e.target.value }))
                      }
                    >
                      <option value="user">Сотрудник</option>
                      <option value="admin">Администратор</option>
                    </select>
                  </div>
                  <div>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ width: "auto" }}
                    >
                      Создать
                    </button>
                  </div>
                </form>
              </div>
              <div>
                <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
                  Список
                </h3>
                <table>
                  <thead>
                    <tr>
                      <th>Логин</th>
                      <th>Имя</th>
                      <th>Роль</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.map((u) => (
                      <tr key={u.id}>
                        <td>{u.username}</td>
                        <td>{u.full_name || "—"}</td>
                        <td>{u.role === "admin" ? "Админ" : "Сотрудник"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <p className="footer-mini">
          <a href="/docs">API (Swagger)</a>
        </p>
      </div>
    </div>
  );
}
