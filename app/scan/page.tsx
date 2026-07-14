"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { defaultInventory, type InventoryItem } from "../demo-data";

type Step = 1 | 2 | 3 | 4;
type Mode = "übernahme" | "rückgabe";

export default function ScanPage() {
  const [step, setStep] = useState<Step>(1);
  const [caseId, setCaseId] = useState("K-002");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mode, setMode] = useState<Mode>("übernahme");
  const [inventory, setInventory] = useState<InventoryItem[]>(defaultInventory.map((item) => ({ ...item })));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const differences = useMemo(() => inventory.filter((item) => item.actual !== item.expected), [inventory]);

  function continueFromScan() {
    if (!caseId.trim()) return setError("Bitte QR-Code scannen oder Koffer-ID eingeben.");
    setError(""); setStep(2);
  }

  function continueFromPerson() {
    if (!name.trim() || !address.trim()) return setError("Bitte Name und Adresse vollständig eingeben.");
    setError(""); setStep(3);
  }

  function updateCount(index: number, delta: number) {
    setInventory((items) => items.map((item, i) => i === index ? { ...item, actual: Math.max(0, item.actual + delta) } : item));
  }

  function reset() {
    setStep(1); setCaseId("K-002"); setName(""); setAddress(""); setMode("übernahme");
    setInventory(defaultInventory.map((item) => ({ ...item }))); setNote(""); setError("");
  }

  return <main className="mobile-bg">
    <section className="phone-shell">
      <header className="mobile-head">
        <div className="mobile-brand"><span>◇</span><b>KÖNA</b></div>
        <a href="/admin">Dashboard</a>
      </header>

      <div className="mobile-content">
        <div className="progress" aria-label={`Schritt ${step} von 3`}>
          {[1,2,3].map((n) => <i key={n} className={step >= n ? "active" : ""}/>) }
        </div>

        {step === 1 && <>
          <p className="eyebrow">Kofferübergabe</p>
          <h1>Koffer scannen</h1>
          <p className="lead">Scanne den QR-Code am Koffer oder gib die Koffer-ID manuell ein.</p>
          <div className="scan-card">
            <div className="scan-frame"><QRCodeSVG value={`https://koena-kofferverwaltung.netlify.app/scan?id=${caseId}`} size={150} fgColor="#163d37"/></div>
            <button className="scan-button" onClick={() => { setCaseId("K-002"); continueFromScan(); }}>▣ QR-Code scannen</button>
          </div>
          <div className="divider"><span>oder</span></div>
          <label className="field">Koffer-ID<input value={caseId} onChange={(e) => setCaseId(e.target.value.toUpperCase())} placeholder="z. B. K-002"/></label>
          {error && <p className="error">{error}</p>}
        </>}

        {step === 2 && <>
          <p className="eyebrow">{caseId}</p>
          <h1>Deine Angaben</h1>
          <p className="lead">Diese Daten dokumentieren, wer den Koffer übernimmt oder zurückgibt und wo er sich befindet.</p>
          <label className="field">Vor- und Nachname<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Max Mustermann"/></label>
          <label className="field">Adresse / neuer Standort<textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Straße, PLZ, Ort"/></label>
          <div className="mode-card">
            <b>Was möchtest du tun?</b>
            <div>
              <button className={mode === "übernahme" ? "selected" : ""} onClick={() => setMode("übernahme")}>Koffer übernehmen</button>
              <button className={mode === "rückgabe" ? "selected" : ""} onClick={() => setMode("rückgabe")}>Koffer zurückgeben</button>
            </div>
          </div>
          {error && <p className="error">{error}</p>}
        </>}

        {step === 3 && <>
          <p className="eyebrow">Schritt 3 · überprüfen</p>
          <h1>Kofferinhalt prüfen</h1>
          <p className="lead">Zähle den tatsächlichen Inhalt. Jede Menge kann direkt verändert werden.</p>
          <div className="person-summary">
            <div><span>Name</span><b>{name}</b></div>
            <div><span>Standort</span><b>{address}</b></div>
            <button onClick={() => setStep(2)}>Bearbeiten</button>
          </div>
          <div className="section-title"><h2>Kofferinhalt</h2><span>{inventory.reduce((sum, item) => sum + item.actual, 0)} Teile</span></div>
          <div className="count-list">
            {inventory.map((item, index) => <div key={item.name} className={item.actual !== item.expected ? "changed" : ""}>
              <span><b>{item.name}</b><small>Soll: {item.expected}</small></span>
              <button aria-label={`${item.name} reduzieren`} onClick={() => updateCount(index, -1)}>−</button>
              <strong>{item.actual}</strong>
              <button aria-label={`${item.name} erhöhen`} onClick={() => updateCount(index, 1)}>＋</button>
            </div>)}
          </div>
          {differences.length > 0 && <div className="warning"><b>Abweichung erkannt</b><span>{differences.map((item) => `${item.name}: ${item.actual}/${item.expected}`).join(" · ")}</span></div>}
          <label className="field">Hinweis (optional)<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Fehlendes oder beschädigtes Material beschreiben"/></label>
        </>}

        {step === 4 && <div className="success">
          <div>✓</div>
          <p className="eyebrow">{caseId}</p>
          <h1>{mode === "übernahme" ? "Übernahme abgeschlossen" : "Rückgabe abgeschlossen"}</h1>
          <p>{differences.length ? "Die Abweichung wurde gemeinsam mit deinem Hinweis dokumentiert." : "Der Kofferinhalt wurde vollständig bestätigt."}</p>
          <div className="success-card"><span>Erfasst für</span><b>{name}</b><small>{address}</small></div>
          <button className="btn primary wide" onClick={reset}>Nächsten Koffer scannen</button>
        </div>}
      </div>

      {step < 4 && <footer className="mobile-actions">
        {step > 1 && <button className="btn secondary" onClick={() => setStep((step - 1) as Step)}>Zurück</button>}
        {step === 1 && <button className="btn primary" onClick={continueFromScan}>Weiter</button>}
        {step === 2 && <button className="btn primary" onClick={continueFromPerson}>Weiter</button>}
        {step === 3 && <button className="btn primary" onClick={() => setStep(4)}>{mode === "übernahme" ? "Übernahme abschließen" : "Rückgabe abschließen"}</button>}
      </footer>}
    </section>
  </main>;
}
