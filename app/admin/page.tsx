"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { casesSeed, statusLabels, type CaseItem, type InventoryItem } from "../demo-data";

type AdminView = "dashboard" | "cases" | "handovers" | "map" | "inventory" | "notices" | "reports" | "settings";

const navItems: { key: AdminView; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "⌂" },
  { key: "cases", label: "Koffer", icon: "▣" },
  { key: "handovers", label: "Übergaben", icon: "⇄" },
  { key: "map", label: "Karte", icon: "⌖" },
  { key: "inventory", label: "Inhaltsübersicht", icon: "▤" },
  { key: "notices", label: "Hinweise", icon: "!" },
  { key: "reports", label: "Berichte", icon: "▥" },
  { key: "settings", label: "Einstellungen", icon: "⚙" },
];

const blankInventory: InventoryItem[] = [
  { name: "Server", expected: 1, actual: 1, icon: "▤" },
  { name: "Drucker", expected: 3, actual: 3, icon: "▣" },
  { name: "Handys", expected: 4, actual: 4, icon: "▯" },
  { name: "USV", expected: 1, actual: 1, icon: "▰" },
  { name: "Tablets", expected: 2, actual: 2, icon: "▭" },
  { name: "Router", expected: 1, actual: 1, icon: "⌁" },
  { name: "Kabel & Zubehör", expected: 15, actual: 15, icon: "⌇" },
];

export default function AdminPage() {
  const [view, setView] = useState<AdminView>("dashboard");
  const [cases, setCases] = useState<CaseItem[]>(casesSeed);
  const [selected, setSelected] = useState<CaseItem | null>(null);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("koena-cases");
    if (saved) {
      try { setCases(JSON.parse(saved)); } catch { /* ignore corrupt local data */ }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("koena-cases", JSON.stringify(cases));
  }, [cases]);

  const rows = useMemo(() => cases.filter(c => `${c.id} ${c.name} ${c.holder} ${c.location}`.toLowerCase().includes(query.toLowerCase())), [cases, query]);
  const issues = cases.filter(c => c.inventory.some(x => x.actual !== x.expected));

  function addCase(input: { id: string; name: string; location: string; inventory: InventoryItem[] }) {
    const item: CaseItem = {
      id: input.id,
      name: input.name,
      status: "available",
      holder: "–",
      address: input.location,
      location: input.location,
      updated: new Intl.DateTimeFormat("de-AT", { dateStyle: "short", timeStyle: "short" }).format(new Date()),
      inventory: input.inventory,
      history: [{ date: new Intl.DateTimeFormat("de-AT", { dateStyle: "short", timeStyle: "short" }).format(new Date()), title: "Koffer angelegt", detail: input.location }],
    };
    setCases(prev => [...prev, item]);
    setShowCreate(false);
    setView("cases");
    setSelected(item);
  }

  return <main className="admin-app">
    <aside className="admin-sidebar">
      <div className="admin-logo"><span>▣</span><div><b>KÖNA</b><small>Koffer Übergabe</small></div></div>
      <nav>{navItems.map(item => <button className={view === item.key ? "active" : ""} key={item.key} onClick={() => { setView(item.key); setSelected(null); }}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <div className="refresh"><small>Letzte Aktualisierung</small><b>gerade eben</b></div>
      <div className="admin-user"><b>JL</b><div>Jakub Leitner<small>Administrator</small></div><span>⌄</span></div>
    </aside>

    <section className="admin-content">
      <header className="dashboard-header">
        <div><h1>{view === "dashboard" ? "Dashboard" : navItems.find(x => x.key === view)?.label}</h1><p>{view === "cases" ? "Alle Koffer verwalten, öffnen und neue Koffer anlegen" : "Übersicht aller Koffer und Übergaben"}</p></div>
        <div className="header-tools">{view === "cases" && <button className="add-case-button" onClick={() => setShowCreate(true)}>＋ Neuer Koffer</button>}<button className="bell">♢<i>{issues.length}</i></button></div>
      </header>

      {view === "dashboard" && <Dashboard cases={cases} setView={setView} setSelected={setSelected} />}
      {view === "cases" && <CasesView rows={rows} query={query} setQuery={setQuery} onSelect={setSelected} onCreate={() => setShowCreate(true)} />}
      {view === "handovers" && <SimplePage title="Übergaben" text="Alle abgeschlossenen und offenen Übergaben werden hier chronologisch angezeigt." cases={cases} />}
      {view === "map" && <SimplePage title="Koffer auf der Karte" text="Standorte aller Koffer auf einen Blick." cases={cases} />}
      {view === "inventory" && <InventoryOverview cases={cases} />}
      {view === "notices" && <Notices cases={issues} />}
      {view === "reports" && <EmptyState title="Berichte" text="Auswertungen und Exporte werden hier gesammelt." />}
      {view === "settings" && <EmptyState title="Einstellungen" text="Allgemeine Einstellungen zur Kofferverwaltung." />}
    </section>

    {selected && <CaseDrawer selected={selected} onClose={() => setSelected(null)} />}
    {showCreate && <CreateCaseModal cases={cases} onClose={() => setShowCreate(false)} onCreate={addCase} />}
  </main>;
}

function Dashboard({ cases, setView, setSelected }: { cases: CaseItem[]; setView: (view: AdminView) => void; setSelected: (item: CaseItem) => void }) {
  const assigned = cases.filter(c => c.status === "in_use").length;
  const waiting = cases.filter(c => c.status === "awaiting_acceptance").length;
  const available = cases.filter(c => c.status === "available").length;
  const issues = cases.filter(c => c.inventory.some(x => x.actual !== x.expected)).length;
  return <>
    <section className="metric-grid"><Metric icon="▣" label="Gesamt Koffer" value={String(cases.length)} text="Alle Koffer im System" tone="teal"/><Metric icon="✓" label="Aktuell vergeben" value={String(assigned)} text="In Nutzung" tone="green"/><Metric icon="◷" label="Wartet auf Übernahme" value={String(waiting)} text="Bereit zur Abholung" tone="orange"/><Metric icon="▣" label="Verfügbar" value={String(available)} text="Frei und bereit" tone="gray"/><Metric icon="!" label="Hinweise" value={String(issues)} text="Abweichungen / Fehler" tone="red"/></section>
    <section className="dashboard-panels"><div className="panel map-panel"><PanelTitle title="Koffer auf der Karte" action="Karte öffnen" onAction={() => setView("map")}/><div className="real-map"><span className="road r1"/><span className="road r2"/><span className="road r3"/><label className="place p-f">Freistadt</label><label className="place p-r">Rainbach</label><label className="place p-s">Sandl</label><label className="place p-g">Grünbach</label><button className="cluster green m1">{Math.max(1, cases.length - 2)}</button><button className="cluster orange m2">{Math.max(1, cases.filter(c => c.status === "in_use").length)}</button><button className="cluster red m3">{issues}</button><button className="map-control">＋<br/>−<br/>◎</button></div></div>
    <div className="panel"><PanelTitle title="Letzte Übergaben" action="Alle anzeigen" onAction={() => setView("handovers")}/>{cases.slice(0,5).map(c => <button className="activity" key={c.id} onClick={() => setSelected(c)}><i className={c.status === "awaiting_acceptance" ? "orange" : "green"}/><span><b>{c.id}</b><small>{c.history[0]?.title ?? "Keine Übergabe"}</small></span><time>{c.updated}</time></button>)}</div>
    <div className="panel"><PanelTitle title="Hinweise" action="Alle anzeigen" onAction={() => setView("notices")}/>{cases.filter(c => c.inventory.some(x => x.actual !== x.expected)).map(c => <button className="notice-row" key={c.id} onClick={() => setSelected(c)}><i className="red"/><span><b>{c.id}</b><small>Abweichung beim Kofferinhalt</small></span><time>{c.updated}</time></button>)}</div></section>
    <section className="panel all-cases"><div className="table-header"><h2>Alle Koffer</h2><button className="text-action" onClick={() => setView("cases")}>Alle Koffer verwalten ›</button></div><CaseTable rows={cases.slice(0,6)} onSelect={setSelected}/></section>
  </>;
}

function CasesView({ rows, query, setQuery, onSelect, onCreate }: { rows: CaseItem[]; query: string; setQuery: (v: string) => void; onSelect: (c: CaseItem) => void; onCreate: () => void }) {
  return <section className="panel all-cases cases-page"><div className="table-header"><div><h2>Alle Koffer</h2><p>{rows.length} Koffer im System</p></div><div><label>⌕<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Koffer suchen..."/></label><button>⚗ Filter</button><button onClick={onCreate} className="add-inline">＋ Neuer Koffer</button></div></div><CaseTable rows={rows} onSelect={onSelect}/></section>;
}

function CaseTable({ rows, onSelect }: { rows: CaseItem[]; onSelect: (c: CaseItem) => void }) {
  return <div className="table-scroll"><table><thead><tr><th>Koffer ID</th><th>Bezeichnung</th><th>Status</th><th>Aktueller Besitzer</th><th>Standort</th><th>Letzte Übergabe</th><th>Hinweise</th><th/></tr></thead><tbody>{rows.map(c => <tr key={c.id} onClick={() => onSelect(c)}><td><b>{c.id}</b></td><td>{c.name}</td><td><span className={`status-pill ${c.status}`}>{statusLabels[c.status]}</span></td><td>{c.holder}</td><td>⌖ {c.location}</td><td>{c.updated}</td><td>{c.inventory.some(x => x.actual !== x.expected) ? <span className="issue-count">● 1</span> : "–"}</td><td>›</td></tr>)}</tbody></table></div>;
}

function CaseDrawer({ selected, onClose }: { selected: CaseItem; onClose: () => void }) {
  const qrRef = useRef<SVGSVGElement | null>(null);
  const qrUrl = `https://koena-kofferverwaltung.netlify.app/koffer/${selected.id}`;

  function downloadQr() {
    const svg = qrRef.current;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${selected.id}-qr-code.svg`; link.click();
    URL.revokeObjectURL(url);
  }

  function printQr() {
    const svg = qrRef.current;
    if (!svg) return;
    const popup = window.open("", "_blank", "width=500,height=650");
    if (!popup) return;
    popup.document.write(`<html><head><title>${selected.id} QR-Code</title><style>body{font-family:Arial;text-align:center;padding:40px}svg{width:280px;height:280px}.id{font-size:28px;font-weight:800;margin:18px}.name{font-size:18px;color:#475467}</style></head><body>${svg.outerHTML}<div class="id">${selected.id}</div><div class="name">${selected.name}</div><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }

  return <div className="drawer-overlay" onClick={onClose}><aside className="case-drawer wide" onClick={e => e.stopPropagation()}><button className="drawer-close" onClick={onClose}>×</button><p>{selected.id}</p><h2>{selected.name}</h2><span className={`status-pill ${selected.status}`}>{statusLabels[selected.status]}</span>
    <div className="drawer-columns"><div><div className="drawer-info"><small>Aktueller Besitzer</small><b>{selected.holder}</b><small>Aktueller Standort</small><b>{selected.address}</b><small>Letzte Übergabe</small><b>{selected.updated}</b></div><h3>Kofferinhalt</h3>{selected.inventory.map(x => <div className="drawer-item" key={x.name}><span>{x.icon} {x.name}</span><b className={x.actual !== x.expected ? "danger" : ""}>{x.actual} / {x.expected}</b></div>)}</div>
    <div><div className="qr-card"><QRCodeSVG ref={qrRef} value={qrUrl} size={190} fgColor="#073f3f"/><b>QR-Code für {selected.id}</b><small>{qrUrl}</small><div><button onClick={downloadQr}>⇩ Herunterladen</button><button onClick={printQr}>⎙ Drucken</button></div></div><h3>Historie</h3>{selected.history.map((h, i) => <div className="history-item" key={`${h.date}-${i}`}><b>{h.title}</b><small>{h.date} · {h.detail}</small></div>)}</div></div>
    <a className="open-case" href={`/koffer/${selected.id}`} target="_blank">Öffentliche Kofferseite öffnen ↗</a></aside></div>;
}

function CreateCaseModal({ cases, onClose, onCreate }: { cases: CaseItem[]; onClose: () => void; onCreate: (input: { id: string; name: string; location: string; inventory: InventoryItem[] }) => void }) {
  const nextNumber = Math.max(0, ...cases.map(c => Number(c.id.replace(/\D/g, "")) || 0)) + 1;
  const [id, setId] = useState(`KFR-${String(nextNumber).padStart(3, "0")}`);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("Lager Freistadt");
  const [inventory, setInventory] = useState(blankInventory.map(x => ({ ...x })));

  function updateItem(index: number, field: "name" | "expected", value: string) {
    setInventory(items => items.map((item, i) => i === index ? { ...item, [field]: field === "expected" ? Math.max(0, Number(value)) : value, actual: field === "expected" ? Math.max(0, Number(value)) : item.actual } : item));
  }

  return <div className="modal-backdrop" onClick={onClose}><section className="create-modal" onClick={e => e.stopPropagation()}><header><div><p>Neuer Koffer</p><h2>Koffer anlegen</h2></div><button onClick={onClose}>×</button></header><div className="create-grid"><label>Koffer-ID<input value={id} onChange={e => setId(e.target.value.toUpperCase())}/></label><label>Bezeichnung<input value={name} onChange={e => setName(e.target.value)} placeholder="z. B. Technikkoffer Nord"/></label><label className="full">Startstandort<input value={location} onChange={e => setLocation(e.target.value)} placeholder="Lager Freistadt"/></label></div><div className="inventory-editor"><div className="inventory-editor-head"><h3>Inventar</h3><button onClick={() => setInventory(items => [...items, { name: "Neuer Gegenstand", expected: 1, actual: 1, icon: "•" }])}>＋ Gegenstand</button></div>{inventory.map((item, index) => <div className="inventory-edit-row" key={index}><input value={item.name} onChange={e => updateItem(index, "name", e.target.value)}/><input type="number" min="0" value={item.expected} onChange={e => updateItem(index, "expected", e.target.value)}/><button onClick={() => setInventory(items => items.filter((_, i) => i !== index))}>×</button></div>)}</div><footer><button className="secondary-modal" onClick={onClose}>Abbrechen</button><button className="primary-modal" disabled={!id.trim() || !name.trim()} onClick={() => onCreate({ id: id.trim(), name: name.trim(), location: location.trim(), inventory })}>Koffer anlegen</button></footer></section></div>;
}

function InventoryOverview({ cases }: { cases: CaseItem[] }) { const totals = new Map<string, number>(); cases.forEach(c => c.inventory.forEach(i => totals.set(i.name, (totals.get(i.name) ?? 0) + i.actual))); return <section className="panel content-page"><h2>Inhaltsübersicht</h2><p>Gesamter Bestand über alle Koffer.</p><div className="inventory-summary">{[...totals].map(([name, count]) => <div key={name}><span>{name}</span><b>{count}</b></div>)}</div></section>; }
function Notices({ cases }: { cases: CaseItem[] }) { return <section className="panel content-page"><h2>Hinweise</h2><p>Abweichungen und fehlende Gegenstände.</p>{cases.length ? cases.map(c => <div className="notice-card" key={c.id}><b>{c.id} · {c.name}</b><span>{c.inventory.filter(i => i.actual !== i.expected).map(i => `${i.name}: ${i.actual}/${i.expected}`).join(" · ")}</span></div>) : <EmptyState title="Keine Hinweise" text="Aktuell wurden keine Abweichungen gemeldet."/>}</section>; }
function SimplePage({ title, text, cases }: { title: string; text: string; cases: CaseItem[] }) { return <section className="panel content-page"><h2>{title}</h2><p>{text}</p>{cases.map(c => <div className="simple-row" key={c.id}><b>{c.id}</b><span>{c.name}</span><small>{c.location}</small></div>)}</section>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <section className="panel empty-page"><div>▣</div><h2>{title}</h2><p>{text}</p></section>; }
function Metric({ icon, label, value, text, tone }: { icon: string; label: string; value: string; text: string; tone: string }) { return <div className="metric"><span className={tone}>{icon}</span><div><small>{label}</small><b>{value}</b><p>{text}</p></div></div>; }
function PanelTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) { return <div className="panel-title"><h2>{title}</h2>{action && <button onClick={onAction}>{action}</button>}</div>; }
