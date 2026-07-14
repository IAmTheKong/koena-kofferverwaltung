"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { User } from "@supabase/supabase-js";
import type { Booking, CaseItem, InventoryItem } from "../../lib/domain";
import { statusHelp, statusLabels } from "../../lib/domain";
import { createBooking, createCase, deleteCase, loadAdminData, updateCase } from "../../lib/supabase/admin-data";
import { getSupabaseClient } from "../../lib/supabase/client";
import CaseMap from "./CaseMap";

type AdminView = "dashboard" | "cases" | "bookings" | "handovers" | "map" | "inventory" | "notices";
type Flash = { tone: "success" | "error" | "info"; text: string } | null;

const navItems: { key: AdminView; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "⌂" },
  { key: "cases", label: "Koffer", icon: "▣" },
  { key: "bookings", label: "Buchungen", icon: "▦" },
  { key: "handovers", label: "Übergaben", icon: "⇄" },
  { key: "map", label: "Standorte", icon: "⌖" },
  { key: "inventory", label: "Inhaltsübersicht", icon: "▤" },
  { key: "notices", label: "Hinweise", icon: "!" },
];

const starterInventory: InventoryItem[] = [
  { name: "Server", expected: 1, actual: 1 },
  { name: "Drucker", expected: 3, actual: 3 },
  { name: "Handys", expected: 4, actual: 4 },
  { name: "Tablets", expected: 2, actual: 2 },
  { name: "Router", expected: 1, actual: 1 },
  { name: "CAT-Kabel", expected: 8, actual: 8 },
  { name: "Stromkabel", expected: 7, actual: 7 },
];

function readableError(error: unknown) {
  const value = error as { code?: string; message?: string };
  if (value.code === "23505") return "Diese Koffer-ID ist bereits vergeben.";
  if (value.code === "23P01") return "Der Koffer ist in diesem Zeitraum bereits gebucht.";
  if (value.code === "42501") return "Dein Konto hat keine Administrator-Berechtigung.";
  if (value.code === "PGRST202") return "Die Datenbankmigration für das Anlegen von Koffern fehlt noch.";
  return value.message || "Die Aktion konnte nicht abgeschlossen werden.";
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [view, setView] = useState<AdminView>("dashboard");
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<CaseItem | null>(null);
  const [editing, setEditing] = useState<CaseItem | null>(null);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<Flash>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadAdminData();
      setCases(data.cases);
      setBookings(data.bookings);
      setUpdatedAt(new Date());
    } catch (error) {
      setFlash({ tone: "error", text: readableError(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) void refresh();
    else if (user === null) setLoading(false);
  }, [user, refresh]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cases.filter((item) => `${item.id} ${item.name} ${item.holder} ${item.location}`.toLowerCase().includes(needle));
  }, [cases, query]);
  const issues = cases.filter((item) => item.status === "deviation" || item.inventory.some((entry) => entry.actual !== entry.expected));

  if (user === undefined || (loading && !user)) return <LoadingScreen />;
  if (!user) return <LoginScreen onMessage={setFlash} flash={flash} />;
  if (user.app_metadata.role !== "admin") return <AccessDenied email={user.email ?? "dieses Konto"} />;

  async function handleCreate(input: { id: string; name: string; description: string; inventory: InventoryItem[] }) {
    try {
      await createCase(input);
      await refresh();
      setShowCreate(false);
      setView("cases");
      setFlash({ tone: "success", text: `${input.id} wurde mit ${input.inventory.length} Inhaltspositionen gespeichert.` });
    } catch (error) {
      throw new Error(readableError(error));
    }
  }

  async function handleUpdate(input: { databaseId: string; name: string; description: string; status: CaseItem["status"]; inventory: InventoryItem[] }) {
    try {
      await updateCase(input);
      setEditing(null);
      setSelected(null);
      await refresh();
      setFlash({ tone: "success", text: "Koffer und individuelle Befüllung wurden aktualisiert." });
    } catch (error) {
      throw new Error(readableError(error));
    }
  }

  async function handleDelete(item: CaseItem) {
    if (!window.confirm(`${item.id} dauerhaft löschen? Zugehörige Buchungen, Übergaben und die Historie werden ebenfalls entfernt. Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
    try {
      await deleteCase(item.databaseId);
      setEditing(null);
      setSelected(null);
      await refresh();
      setFlash({ tone: "success", text: `${item.id} wurde dauerhaft gelöscht.` });
    } catch (error) {
      setFlash({ tone: "error", text: readableError(error) });
    }
  }

  return <main className="admin-app">
    <aside className="admin-sidebar">
      <div className="admin-logo"><span>▣</span><div><b>KÖNA</b><small>Kofferverwaltung</small></div></div>
      <nav>{navItems.map((item) => <button className={view === item.key ? "active" : ""} key={item.key} onClick={() => { setView(item.key); setSelected(null); }}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <div className="refresh"><small>Letzte Synchronisierung</small><b>{updatedAt ? updatedAt.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" }) : "Noch nicht synchronisiert"}</b><button onClick={() => void refresh()}>↻ Aktualisieren</button></div>
      <div className="admin-user"><b>{(user.email?.slice(0, 2) ?? "AD").toUpperCase()}</b><div>{user.email}<small>Administrator</small></div><button title="Abmelden" onClick={() => void getSupabaseClient().auth.signOut()}>↪</button></div>
    </aside>

    <section className="admin-content">
      <header className="dashboard-header">
        <div><h1>{view === "dashboard" ? "Dashboard" : navItems.find((item) => item.key === view)?.label}</h1><p>{subtitleFor(view)}</p></div>
        <div className="header-tools"><button className="add-case-button" onClick={() => setShowCreate(true)}>＋ Koffer hinzufügen</button><button className="bell" onClick={() => setView("notices")}>!<i>{issues.length}</i></button></div>
      </header>

      {flash && <div className={`admin-flash ${flash.tone}`} role="status"><span>{flash.tone === "success" ? "✓" : flash.tone === "error" ? "!" : "i"} {flash.text}</span><button onClick={() => setFlash(null)}>×</button></div>}
      {loading && <div className="sync-line">Daten werden mit Supabase synchronisiert …</div>}

      {view === "dashboard" && <Dashboard cases={cases} bookings={bookings} issues={issues} setView={setView} setSelected={setSelected} />}
      {view === "cases" && <CasesView rows={rows} query={query} setQuery={setQuery} onSelect={setSelected} onCreate={() => setShowCreate(true)} />}
      {view === "bookings" && <BookingsView cases={cases} bookings={bookings} onCreated={async (text) => { await refresh(); setFlash({ tone: "success", text }); }} />}
      {view === "handovers" && <HandoversView cases={cases} />}
      {view === "map" && <LocationsView cases={cases} onSelect={setSelected} />}
      {view === "inventory" && <InventoryOverview cases={cases} />}
      {view === "notices" && <Notices cases={issues} onSelect={setSelected} />}
    </section>

    {selected && <CaseDrawer selected={selected} bookings={bookings.filter((booking) => booking.suitcaseId === selected.databaseId)} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null); }} onDelete={() => void handleDelete(selected)} />}
    {showCreate && <CreateCaseModal cases={cases} onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    {editing && <EditCaseModal item={editing} onClose={() => setEditing(null)} onUpdate={handleUpdate} onDelete={() => void handleDelete(editing)} />}
  </main>;
}

function subtitleFor(view: AdminView) {
  const subtitles: Record<AdminView, string> = {
    dashboard: "Echte Bestände, Termine und offene Aufgaben auf einen Blick",
    cases: "Koffer, Inhalt, QR-Code und Historie verwalten",
    bookings: "Zeiträume planen und Überschneidungen verhindern",
    handovers: "Übergaben und unabhängige Übernahmen getrennt verfolgen",
    map: "Konkrete Koffer nach ihrem zuletzt bestätigten Standort",
    inventory: "Soll- und Ist-Bestand über alle Koffer durchsuchen",
    notices: "Fehlbestände und Schäden dauerhaft bearbeiten",
  };
  return subtitles[view];
}

function LoginScreen({ flash, onMessage }: { flash: Flash; onMessage: (flash: Flash) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    if (error) onMessage({ tone: "error", text: "Anmeldung fehlgeschlagen. Bitte Zugangsdaten und Admin-Rolle prüfen." });
    setBusy(false);
  }

  return <main className="login-shell"><form className="login-card" onSubmit={login}><div className="login-mark">▣</div><p className="kicker">KÖNA Kofferverwaltung</p><h1>Admin-Anmeldung</h1><p>Verwaltungsdaten sind geschützt und werden erst nach erfolgreicher Anmeldung aus Supabase geladen.</p>{flash && <div className={`admin-flash ${flash.tone}`}>{flash.text}</div>}<label>E-Mail<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Passwort<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="primary-modal" disabled={busy}>{busy ? "Anmeldung läuft …" : "Anmelden"}</button></form></main>;
}

function LoadingScreen() { return <main className="login-shell"><div className="login-card loading-card"><div className="login-mark">▣</div><h1>KÖNA</h1><p>Sichere Verbindung wird hergestellt …</p></div></main>; }
function AccessDenied({ email }: { email: string }) { return <main className="login-shell"><div className="login-card"><div className="login-mark">!</div><p className="kicker">Zugriff verweigert</p><h1>Keine Admin-Rolle</h1><p>{email} ist angemeldet, besitzt aber nicht <b>app_metadata.role = admin</b>.</p><button className="primary-modal" onClick={() => void getSupabaseClient().auth.signOut()}>Abmelden</button></div></main>; }

function Dashboard({ cases, bookings, issues, setView, setSelected }: { cases: CaseItem[]; bookings: Booking[]; issues: CaseItem[]; setView: (view: AdminView) => void; setSelected: (item: CaseItem) => void }) {
  const waiting = cases.filter((item) => item.status === "awaiting_takeover");
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter((booking) => booking.status === "confirmed" && booking.startsOn >= today).slice(0, 4);
  return <>
    <section className="metric-grid"><Metric icon="▣" label="Gesamt" value={cases.length} text="aktive Koffer" tone="teal"/><Metric icon="✓" label="Heute verfügbar" value={cases.filter((item) => item.status === "available").length} text="sofort einsetzbar" tone="green"/><Metric icon="▦" label="Reserviert" value={cases.filter((item) => item.status === "reserved").length} text="kommende Buchung" tone="gray"/><Metric icon="◷" label="Offene Übernahmen" value={waiting.length} text="zweite Zählung fehlt" tone="orange"/><Metric icon="!" label="Hinweise" value={issues.length} text="Bestand prüfen" tone="red"/></section>
    <section className="panel dashboard-map"><PanelTitle title="Aktuelle Kofferstandorte" action="Standorte öffnen ›" onAction={() => setView("map")}/><CaseMap cases={cases}/><p className="map-caption">Die Marker zeigen die zuletzt bestätigten Koordinaten; die Adresse wird direkt am Marker angezeigt. Kartendaten © OpenStreetMap.</p></section>
    <section className="dashboard-panels logical"><div className="panel"><PanelTitle title="Jetzt bearbeiten" action="Alle Hinweise" onAction={() => setView("notices")}/>{[...waiting, ...issues].slice(0, 6).map((item) => <button className="notice-row" key={item.id} onClick={() => setSelected(item)}><i className={item.status === "awaiting_takeover" ? "orange" : "red"}/><span><b>{item.id} · {statusLabels[item.status]}</b><small>{item.status === "awaiting_takeover" ? `Seit ${item.updated} offen · ${item.location}` : "Soll- und Ist-Bestand weichen ab"}</small></span><time>Öffnen ›</time></button>)}{!waiting.length && !issues.length && <InlineEmpty text="Keine offenen Aufgaben." />}</div>
    <div className="panel"><PanelTitle title="Kommende Buchungen" action="Planung öffnen" onAction={() => setView("bookings")}/>{upcoming.map((booking) => <div className="activity" key={booking.id}><i className="green"/><span><b>{booking.caseNumber} · {booking.customerName}</b><small>{booking.startsOn} bis {booking.endsOn} · {booking.location}</small></span></div>)}{!upcoming.length && <InlineEmpty text="Keine kommenden Buchungen." />}</div></section>
    <section className="panel all-cases"><div className="table-header"><div><h2>Aktive Koffer</h2><p>{cases.length} Datensätze aus Supabase</p></div><button className="text-action" onClick={() => setView("cases")}>Alle verwalten ›</button></div><CaseTable rows={cases.slice(0, 8)} onSelect={setSelected}/></section>
  </>;
}

function CasesView({ rows, query, setQuery, onSelect, onCreate }: { rows: CaseItem[]; query: string; setQuery: (value: string) => void; onSelect: (item: CaseItem) => void; onCreate: () => void }) {
  return <section className="panel all-cases cases-page"><div className="table-header"><div><h2>Alle Koffer</h2><p>{rows.length} Treffer</p></div><div><label>⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ID, Name, Person oder Ort"/></label><button onClick={onCreate} className="add-inline">＋ Neuer Koffer</button></div></div>{rows.length ? <CaseTable rows={rows} onSelect={onSelect}/> : <InlineEmpty text="Keine Koffer gefunden. Lege den ersten Koffer an oder ändere die Suche."/>}</section>;
}

function CaseTable({ rows, onSelect }: { rows: CaseItem[]; onSelect: (item: CaseItem) => void }) {
  return <div className="table-scroll"><table><thead><tr><th>Koffer-ID</th><th>Bezeichnung</th><th>Status</th><th>Aktuell bei</th><th>Standort</th><th>Aktualisiert</th><th>Inhalt</th><th>Aktion</th></tr></thead><tbody>{rows.map((item) => { const deviations = item.inventory.filter((entry) => entry.actual !== entry.expected).length; return <tr key={item.databaseId} onClick={() => onSelect(item)}><td><b>{item.id}</b></td><td>{item.name}</td><td><span className={`status-pill ${item.status}`}>{statusLabels[item.status]}</span></td><td>{item.holder}</td><td>⌖ {item.location}</td><td>{item.updated}</td><td>{deviations ? <span className="issue-count">● {deviations} Abweichung{deviations === 1 ? "" : "en"}</span> : <span className="inventory-ok">✓ Soll = Ist</span>}</td><td><button className="row-action" aria-label={`${item.id} öffnen`}>Details ›</button></td></tr>; })}</tbody></table></div>;
}

function BookingsView({ cases, bookings, onCreated }: { cases: CaseItem[]; bookings: Booking[]; onCreated: (text: string) => Promise<void> }) {
  const today = new Date().toISOString().slice(0, 10);
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(today);
  const [suitcaseId, setSuitcaseId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const available = cases.filter((item) => item.status !== "out_of_service" && !bookings.some((booking) => booking.suitcaseId === item.databaseId && ["requested", "confirmed"].includes(booking.status) && booking.startsOn <= endsOn && booking.endsOn >= startsOn));

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await createBooking({ suitcaseId, customerName, location, startsOn, endsOn });
      await onCreated("Buchung wurde gespeichert. Die Überschneidungsprüfung ist zusätzlich in PostgreSQL erzwungen.");
      setCustomerName(""); setSuitcaseId("");
    } catch (problem) { setError(readableError(problem)); }
    finally { setBusy(false); }
  }

  return <div className="booking-layout"><form className="panel booking-form" onSubmit={submit}><h2>Neue Buchung</h2><p>Zeitraum wählen – ungeeignete Koffer werden automatisch ausgeschlossen.</p><div className="create-grid"><label>Von<input type="date" min={today} required value={startsOn} onChange={(event) => { setStartsOn(event.target.value); if (event.target.value > endsOn) setEndsOn(event.target.value); }}/></label><label>Bis<input type="date" min={startsOn} required value={endsOn} onChange={(event) => setEndsOn(event.target.value)}/></label><label className="full">Verfügbarer Koffer<select required value={suitcaseId} onChange={(event) => setSuitcaseId(event.target.value)}><option value="">Bitte wählen ({available.length} verfügbar)</option>{available.map((item) => <option key={item.databaseId} value={item.databaseId}>{item.id} · {item.name}</option>)}</select></label><label>Verantwortliche Person<input required value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label><label>Einsatzort<input value={location} onChange={(event) => setLocation(event.target.value)} /></label></div>{error && <div className="form-error">{error}</div>}<button className="primary-modal" disabled={busy || !available.length}>{busy ? "Speichert …" : "Buchung speichern"}</button></form>
  <section className="panel content-page"><h2>Geplante Buchungen</h2><p>{bookings.filter((booking) => booking.status !== "cancelled").length} aktive Vorgänge</p>{bookings.filter((booking) => booking.status !== "cancelled").map((booking) => <div className="booking-card" key={booking.id}><span><b>{booking.caseNumber}</b><small>{booking.customerName} · {booking.location}</small></span><time>{booking.startsOn}<br/>bis {booking.endsOn}</time><span className={`status-pill ${booking.status === "confirmed" ? "reserved" : "available"}`}>{booking.status === "confirmed" ? "Bestätigt" : "Angefragt"}</span></div>)}</section></div>;
}

function HandoversView({ cases }: { cases: CaseItem[] }) { const events = cases.flatMap((item) => item.history.map((event) => ({ ...event, caseNumber: item.id }))).sort((a, b) => b.date.localeCompare(a.date)); return <section className="panel content-page"><h2>Übergabeverlauf</h2><p>Kofferstatus und Vorgangsstatus bleiben getrennt. Jede Abschluss- und Übernahmezählung wird als eigenes Ereignis geführt.</p>{events.map((event, index) => <div className="timeline-row" key={`${event.caseNumber}-${event.date}-${index}`}><span>⇄</span><div><b>{event.caseNumber} · {event.title}</b><small>{event.detail || "Keine Zusatzinformation"}</small></div><time>{event.date}</time></div>)}{!events.length && <InlineEmpty text="Noch keine Übergabeereignisse vorhanden."/>}</section>; }

function LocationsView({ cases, onSelect }: { cases: CaseItem[]; onSelect: (item: CaseItem) => void }) { const groups = cases.reduce<Map<string, CaseItem[]>>((result, item) => result.set(item.location, [...(result.get(item.location) ?? []), item]), new Map()); return <div className="locations-layout"><section className="panel location-map-panel"><div className="content-head"><div><h2>Adressen auf der Karte</h2><p>OpenStreetMap mit den zuletzt bestätigten Kofferstandorten.</p></div></div><CaseMap cases={cases}/></section><section className="location-grid">{[...groups].map(([location, items]) => <div className="panel location-card" key={location}><div><span>⌖</span><div><h2>{location}</h2><p>{items.length} Koffer</p></div></div>{items.map((item) => <button key={item.databaseId} onClick={() => onSelect(item)}><span><b>{item.id}</b><small>{item.address || (item.holder === "–" ? item.name : `Aktuell bei ${item.holder}`)}</small></span><span className={`status-pill ${item.status}`}>{statusLabels[item.status]}</span></button>)}</div>)}</section></div>; }

function InventoryOverview({ cases }: { cases: CaseItem[] }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const totals = new Map<string, { name: string; expected: number; actual: number; cases: Set<string> }>();
    cases.forEach((item) => item.inventory.forEach((inventory) => {
      const key = inventory.name.trim().toLocaleLowerCase("de-AT");
      const current = totals.get(key) ?? { name: inventory.name.trim(), expected: 0, actual: 0, cases: new Set<string>() };
      current.expected += inventory.expected;
      current.actual += inventory.actual;
      current.cases.add(item.id);
      totals.set(key, current);
    }));
    return [...totals.values()].filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [cases, query]);
  return <section className="panel content-page"><div className="content-head"><div><h2>Gesamtbestand aller Koffer</h2><p>Gleich benannte Gegenstände werden über alle Koffer zusammengerechnet.</p></div><label className="search-field">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="z. B. CAT-Kabel"/></label></div><div className="table-scroll"><table><thead><tr><th>Gegenstand</th><th>Enthalten in</th><th>Soll gesamt</th><th>Ist gesamt</th><th>Status</th></tr></thead><tbody>{rows.map((item) => <tr key={item.name}><td><b>{item.name}</b></td><td>{[...item.cases].join(", ")}</td><td>{item.expected}</td><td>{item.actual}</td><td>{item.actual === item.expected ? <span className="inventory-ok">✓ Soll = Ist</span> : <span className="issue-count">● Differenz {item.actual - item.expected}</span>}</td></tr>)}</tbody></table></div>{!rows.length && <InlineEmpty text="Keine passenden Gegenstände gefunden."/>}</section>;
}

function Notices({ cases, onSelect }: { cases: CaseItem[]; onSelect: (item: CaseItem) => void }) { return <section className="panel content-page"><h2>Offene Hinweise</h2><p>Hinweise bleiben sichtbar, bis sie im zugrunde liegenden Kofferbestand behoben wurden.</p>{cases.map((item) => <button className="notice-card actionable" key={item.databaseId} onClick={() => onSelect(item)}><span><b>{item.id} · {item.name}</b><small>{item.inventory.filter((entry) => entry.actual !== entry.expected).map((entry) => `${entry.name}: ${entry.actual}/${entry.expected}`).join(" · ") || statusHelp[item.status]}</small></span><span>Prüfen ›</span></button>)}{!cases.length && <InlineEmpty text="Aktuell sind keine Abweichungen offen."/>}</section>; }


function CaseDrawer({ selected, bookings, onClose, onEdit, onDelete }: { selected: CaseItem; bookings: Booking[]; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const qrRef = useRef<SVGSVGElement | null>(null);
  const qrUrl = `${window.location.origin}/koffer/${selected.publicId}`;
  function printQr() { const popup = window.open("", "_blank", "width=500,height=650"); if (!popup || !qrRef.current) return; popup.document.write(`<title>${selected.id}</title><style>body{text-align:center;font-family:Arial;padding:50px}svg{width:280px;height:280px}h1{margin:20px 0 5px}</style>${qrRef.current.outerHTML}<h1>${selected.id}</h1><p>${selected.name}</p><script>onload=()=>print()</script>`); popup.document.close(); }
  return <div className="drawer-overlay" onClick={onClose}><aside className="case-drawer wide" onClick={(event) => event.stopPropagation()}><button className="drawer-close" onClick={onClose}>×</button><p>{selected.id}</p><h2>{selected.name}</h2><div className="drawer-management"><span className={`status-pill ${selected.status}`}>{statusLabels[selected.status]}</span><button className="secondary-modal" onClick={onEdit}>✎ Koffer bearbeiten</button></div><p className="status-explanation">{statusHelp[selected.status]}</p><div className="drawer-columns"><div><div className="drawer-info"><small>Aktuell bei</small><b>{selected.holder}</b><small>Adresse / letzter Standort</small><b>{selected.address}</b><small>Zuletzt aktualisiert</small><b>{selected.updated}</b><small>Nächste Buchung</small><b>{bookings[0] ? `${bookings[0].startsOn} bis ${bookings[0].endsOn}` : "Keine geplant"}</b></div><h3>Kofferinhalt</h3>{selected.inventory.map((item) => <div className="drawer-item" key={item.id ?? item.name}><span>{item.name}</span><b className={item.actual !== item.expected ? "danger" : "inventory-ok"}>{item.actual === item.expected ? "✓ " : ""}{item.actual} / {item.expected}</b></div>)}</div><div><div className="qr-card"><QRCodeSVG ref={qrRef} value={qrUrl} size={190} fgColor="#073f3f"/><b>QR-Code für {selected.id}</b><small>{qrUrl}</small><button onClick={printQr}>⎙ QR-Code drucken</button></div><h3>Historie</h3>{selected.history.map((event, index) => <div className="history-item" key={`${event.date}-${index}`}><b>{event.title}</b><small>{event.date} · {event.detail}</small></div>)}{!selected.history.length && <InlineEmpty text="Noch keine Ereignisse."/>}</div></div><div className="danger-zone"><div><b>Koffer dauerhaft löschen</b><small>Entfernt auch Buchungen, Übergaben und Historie. Der QR-Code dieses Cases ist danach ungültig.</small></div><button onClick={onDelete}>Löschen</button></div></aside></div>;
}

function CreateCaseModal({ cases, onClose, onCreate }: { cases: CaseItem[]; onClose: () => void; onCreate: (input: { id: string; name: string; description: string; inventory: InventoryItem[] }) => Promise<void> }) {
  const nextNumber = Math.max(0, ...cases.map((item) => Number(item.id.replace(/\D/g, "")) || 0)) + 1;
  const [id, setId] = useState(`KFR-${String(nextNumber).padStart(3, "0")}`);
  const [name, setName] = useState(""); const [description, setDescription] = useState("");
  const [inventory, setInventory] = useState(starterInventory.map((item) => ({ ...item })));
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  function updateItem(index: number, field: "name" | "expected", value: string) { setInventory((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: field === "expected" ? Math.max(0, Number(value)) : value, actual: field === "expected" ? Math.max(0, Number(value)) : item.actual } : item)); }
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(""); if (!/^K(FR)?-\d{3}$/.test(id)) { setError("Die Koffer-ID muss dem Format KFR-001 entsprechen."); return; } if (!inventory.length || inventory.some((item) => !item.name.trim())) { setError("Mindestens eine vollständig bezeichnete Inhaltsposition ist erforderlich."); return; } setBusy(true); try { await onCreate({ id: id.trim().toUpperCase(), name: name.trim(), description: description.trim(), inventory }); } catch (problem) { setError((problem as Error).message); } finally { setBusy(false); } }
  return <div className="modal-backdrop" onClick={onClose}><form className="create-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}><header><div><p>Neuer Koffer</p><h2>Koffer mit individuellem Inhalt anlegen</h2></div><button type="button" onClick={onClose}>×</button></header><div className="create-grid"><label>Koffer-ID *<input required value={id} onChange={(event) => setId(event.target.value.toUpperCase())}/><small>Der feste QR-Code bleibt mit dieser Case-ID verbunden.</small></label><label>Bezeichnung *<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="z. B. Technikkoffer Nord"/></label><label className="full">Beschreibung<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optionaler Einsatzzweck oder Besonderheiten"/></label></div><div className="fixed-location-note">⌖ Ausgangsstandort: <b>Summerau</b> (wird automatisch gespeichert)</div><div className="inventory-editor"><div className="inventory-editor-head"><div><h3>Individuelle Befüllung</h3><small>Gegenstand und Soll-Menge; die Ist-Menge startet gleich dem Soll.</small></div><button type="button" onClick={() => setInventory((items) => [...items, { name: "", expected: 1, actual: 1 }])}>＋ Gegenstand</button></div>{inventory.map((item, index) => <div className="inventory-edit-row compact" key={index}><input aria-label="Gegenstand" value={item.name} onChange={(event) => updateItem(index, "name", event.target.value)} placeholder="Gegenstand"/><input aria-label="Soll-Menge" type="number" min="0" value={item.expected} onChange={(event) => updateItem(index, "expected", event.target.value)}/><button type="button" aria-label="Position entfernen" onClick={() => setInventory((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}</div>{error && <div className="form-error">! {error}</div>}<footer><button type="button" className="secondary-modal" onClick={onClose}>Abbrechen</button><button className="primary-modal" disabled={busy}>{busy ? "Wird in Supabase gespeichert …" : "Koffer speichern"}</button></footer></form></div>;
}

function EditCaseModal({ item, onClose, onUpdate, onDelete }: { item: CaseItem; onClose: () => void; onUpdate: (input: { databaseId: string; name: string; description: string; status: CaseItem["status"]; inventory: InventoryItem[] }) => Promise<void>; onDelete: () => void }) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [status, setStatus] = useState<CaseItem["status"]>(item.status);
  const [inventory, setInventory] = useState(item.inventory.map((entry) => ({ ...entry })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function updateItem(index: number, field: "name" | "expected", value: string) { setInventory((items) => items.map((entry, itemIndex) => itemIndex === index ? { ...entry, [field]: field === "expected" ? Math.max(0, Number(value)) : value, actual: field === "expected" ? Math.max(0, Number(value)) : entry.actual } : entry)); }
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(""); if (!inventory.length || inventory.some((entry) => !entry.name.trim())) { setError("Mindestens eine vollständig bezeichnete Inhaltsposition ist erforderlich."); return; } setBusy(true); try { await onUpdate({ databaseId: item.databaseId, name: name.trim(), description: description.trim(), status, inventory }); } catch (problem) { setError((problem as Error).message); } finally { setBusy(false); } }
  return <div className="modal-backdrop" onClick={onClose}><form className="create-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}><header><div><p>{item.id}</p><h2>Koffer und Befüllung bearbeiten</h2></div><button type="button" onClick={onClose}>×</button></header><div className="create-grid"><label>Koffer-ID<input disabled value={item.id}/><small>Bleibt wegen des festen QR-Codes unverändert.</small></label><label>Bezeichnung *<input required value={name} onChange={(event) => setName(event.target.value)}/></label><label className="full">Beschreibung<textarea value={description} onChange={(event) => setDescription(event.target.value)}/></label><label className="full">Kofferstatus<select value={status} onChange={(event) => setStatus(event.target.value as CaseItem["status"])}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><div className="inventory-editor"><div className="inventory-editor-head"><div><h3>Individuelle Befüllung</h3><small>Änderungen setzen den zuletzt bestätigten Ist-Bestand auf den neuen Soll-Bestand.</small></div><button type="button" onClick={() => setInventory((items) => [...items, { name: "", expected: 1, actual: 1 }])}>＋ Gegenstand</button></div>{inventory.map((entry, index) => <div className="inventory-edit-row compact" key={entry.id ?? index}><input aria-label="Gegenstand" value={entry.name} onChange={(event) => updateItem(index, "name", event.target.value)}/><input aria-label="Soll-Menge" type="number" min="0" value={entry.expected} onChange={(event) => updateItem(index, "expected", event.target.value)}/><button type="button" aria-label="Position entfernen" onClick={() => setInventory((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}</div>{error && <div className="form-error">! {error}</div>}<footer className="edit-modal-footer"><button type="button" className="delete-modal" onClick={onDelete}>Koffer löschen</button><span/><button type="button" className="secondary-modal" onClick={onClose}>Abbrechen</button><button className="primary-modal" disabled={busy}>{busy ? "Speichert …" : "Änderungen speichern"}</button></footer></form></div>;
}

function Metric({ icon, label, value, text, tone }: { icon: string; label: string; value: number; text: string; tone: string }) { return <div className="metric"><span className={tone}>{icon}</span><div><small>{label}</small><b>{value}</b><p>{text}</p></div></div>; }
function PanelTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) { return <div className="panel-title"><h2>{title}</h2>{action && <button onClick={onAction}>{action}</button>}</div>; }
function InlineEmpty({ text }: { text: string }) { return <div className="inline-empty">✓ {text}</div>; }
