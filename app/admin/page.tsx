"use client";

import { useMemo, useState } from "react";
import { casesSeed, statusLabels, type CaseItem } from "../demo-data";

type View = "dashboard" | "bookings";

export default function AdminPage() {
  const [cases, setCases] = useState(casesSeed);
  const [selected, setSelected] = useState<CaseItem | null>(cases[1]);
  const [view, setView] = useState<View>("dashboard");
  const [notice, setNotice] = useState("");
  const totals = useMemo(() => ({
    free: 8 + cases.filter((item) => item.status === "frei").length,
    out: 14 + cases.filter((item) => item.status === "unterwegs" || item.status === "abweichung").length,
    booked: 3 + cases.filter((item) => item.status === "reserviert").length,
    open: cases.filter((item) => item.status === "offen").length,
  }), [cases]);

  function reserve(id: string) {
    setCases((all) => all.map((item) => item.id === id ? { ...item, status: "reserviert", next: "20.–24. Juli" } : item));
    setNotice(`${id} wurde für 20.–24. Juli reserviert.`);
  }

  return <main className="admin-layout">
    <aside className="sidebar">
      <div className="logo"><span>◇</span><div><b>KÖNA</b><small>Kofferverwaltung</small></div></div>
      <nav>
        <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>▦ <span>Übersicht</span></button>
        <button className={view === "bookings" ? "active" : ""} onClick={() => setView("bookings")}>▣ <span>Buchungen</span></button>
        <a href="/scan">▧ <span>Übergabe öffnen</span></a>
      </nav>
      <div className="admin-user"><b>JL</b><div>Jakub Leitner<small>Administrator</small></div></div>
    </aside>

    <section className="admin-main">
      <header className="admin-header"><div><p className="eyebrow">Dienstag, 14. Juli 2026</p><h1>{view === "dashboard" ? "Koffer im Überblick" : "Buchungen"}</h1><p>{view === "dashboard" ? "Standorte, Übergaben und Abweichungen auf einen Blick." : "Verfügbarkeit prüfen und Koffer für einen Zeitraum reservieren."}</p></div><button className="btn primary" onClick={() => setView("bookings")}>＋ Koffer buchen</button></header>
      {notice && <div className="notice">✓ {notice}<button onClick={() => setNotice("")}>×</button></div>}

      {view === "dashboard" ? <>
        <section className="stats">
          <Stat value={totals.free} label="verfügbar" tone="green"/>
          <Stat value={totals.out} label="unterwegs" tone="blue"/>
          <Stat value={totals.booked} label="reserviert" tone="purple"/>
          <Stat value={totals.open} label="offene Übergaben" tone="orange"/>
        </section>
        <div className="dashboard-grid">
          <section className="card"><div className="card-head"><div><h2>Aktuelle Standorte</h2><p>Zuletzt bestätigter Standort je Koffer</p></div><button>Alle anzeigen →</button></div><div className="map"><i/><i/><i/><span className="city c1">FREISTADT</span><span className="city c2">LINZ</span><span className="city c3">WIEN</span><button className="pin p1">01</button><button className="pin p2">02</button><button className="pin p3 warn">05</button></div></section>
          <section className="card"><div className="card-head"><div><h2>Heute beachten</h2><p>3 Vorgänge benötigen Aufmerksamkeit</p></div></div>
            <Task color="orange" icon="!" title="K-003 wartet auf Übernahme" text="Abschluss durch Peter Gruber · Wels" onClick={() => setSelected(cases[2])}/>
            <Task color="red" icon="!" title="K-005: Fehlbestand gemeldet" text="1 Drucker und 1 Kabelset fehlen" onClick={() => setSelected(cases[4])}/>
            <Task color="blue" icon="↗" title="K-002 Rückgabe am 17. Juli" text="Max Huber · Linz" onClick={() => setSelected(cases[1])}/>
          </section>
        </div>
        <section className="card case-table"><div className="card-head"><div><h2>Alle Koffer</h2><p>30 Koffer im Bestand</p></div><button>Filter ▾</button></div><div className="table-wrap"><table><thead><tr><th>Koffer</th><th>Status</th><th>Aktueller Besitzer</th><th>Standort</th><th>Nächster Termin</th></tr></thead><tbody>{cases.map((item) => <tr key={item.id} onClick={() => setSelected(item)}><td><b>{item.id}</b><small>{item.name}</small></td><td><StatusTag status={item.status}/></td><td>{item.holder}</td><td>{item.address}</td><td>{item.next ?? "–"}</td></tr>)}</tbody></table></div></section>
      </> : <Bookings cases={cases} onReserve={reserve}/>} 
    </section>

    {selected && <div className="overlay" onClick={() => setSelected(null)}><aside className="drawer" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setSelected(null)}>×</button><p className="eyebrow">{selected.id}</p><h2>{selected.name}</h2><StatusTag status={selected.status}/><div className="detail"><label>Aktueller Besitzer<strong>{selected.holder}</strong></label><label>Standort<strong>{selected.address}</strong></label><label>Letzte Aktualisierung<strong>{selected.updated}</strong></label></div><h3>Kofferinhalt</h3><div className="inventory">{selected.inventory.map((item) => <div key={item.name}><span>{item.name}</span><b className={item.actual !== item.expected ? "bad" : ""}>{item.actual} / {item.expected}</b></div>)}</div><h3>Verlauf</h3><div className="timeline">{selected.history.map((entry) => <div key={entry.date + entry.title}><b>{entry.title}</b><small>{entry.date} · {entry.detail}</small></div>)}</div><a className="btn primary wide link-button" href={`/scan?id=${selected.id}`}>Übergabe für diesen Koffer öffnen</a></aside></div>}
  </main>;
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) { return <div className={`stat ${tone}`}><strong>{value}</strong><span>{label}</span></div>; }
function StatusTag({ status }: { status: CaseItem["status"] }) { return <span className={`status ${status}`}>{statusLabels[status]}</span>; }
function Task({ color, icon, title, text, onClick }: { color: string; icon: string; title: string; text: string; onClick: () => void }) { return <button className="task" onClick={onClick}><b className={color}>{icon}</b><span><strong>{title}</strong><small>{text}</small></span><i>›</i></button>; }
function Bookings({ cases, onReserve }: { cases: CaseItem[]; onReserve: (id: string) => void }) { const available = cases.filter((item) => item.status === "frei"); return <><section className="booking-hero"><p className="eyebrow">Verfügbarkeit prüfen</p><h2>Koffer für einen Zeitraum buchen</h2><div className="booking-fields"><label>Von<input type="date" defaultValue="2026-07-20"/></label><label>Bis<input type="date" defaultValue="2026-07-24"/></label><label>Einsatzort<input placeholder="z. B. Linz"/></label><button className="btn primary">Prüfen</button></div></section><section className="card"><div className="card-head"><div><h2>Verfügbare Koffer</h2><p>20.–24. Juli 2026</p></div><span className="availability-count">{available.length + 7} verfügbar</span></div>{available.map((item) => <div className="booking-row" key={item.id}><div><b>{item.id}</b><small>{item.name} · {item.address}</small></div><StatusTag status={item.status}/><button className="btn primary small" onClick={() => onReserve(item.id)}>Buchen</button></div>)}</section></>; }
