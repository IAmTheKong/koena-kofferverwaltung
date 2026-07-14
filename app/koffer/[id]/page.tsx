"use client";

import { use, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../../../lib/supabase/client";

type PublicItem = { id: string; name: string; expected: number; actual: number; counted: number; note: string };
type PublicCase = {
  id: string;
  case_number: string;
  name: string;
  description: string | null;
  status: "available" | "reserved" | "rented" | "awaiting_takeover" | "deviation" | "out_of_service";
  location: string;
  items: Array<Omit<PublicItem, "counted" | "note">>;
};

export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [item, setItem] = useState<PublicCase | null>(null);
  const [inventory, setInventory] = useState<PublicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [generalNote, setGeneralNote] = useState("");
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<"ok" | "deviation">("ok");

  useEffect(() => {
    async function load() {
      const { data, error: loadError } = await getSupabaseClient().rpc("get_public_suitcase", { p_public_id: id });
      if (loadError || !data) {
        setError("Dieser QR-Code ist ungültig oder der Koffer wurde archiviert.");
      } else {
        const loaded = data as unknown as PublicCase;
        setItem(loaded);
        setLocation(loaded.location);
        setInventory(loaded.items.map((entry) => ({ ...entry, counted: entry.actual, note: "" })));
      }
      setLoading(false);
    }
    void load();
  }, [id]);

  const takeover = item?.status === "available" || item?.status === "reserved" || item?.status === "awaiting_takeover";
  const differences = useMemo(() => inventory.filter((entry) => entry.counted !== entry.expected), [inventory]);

  function changeCount(index: number, delta: number) {
    setInventory((entries) => entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, counted: Math.max(0, entry.counted + delta) } : entry));
  }

  function setNote(index: number, note: string) {
    setInventory((entries) => entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, note } : entry));
  }

  function captureLocation() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Dieses Gerät unterstützt keine Standortfreigabe.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError("Standort konnte nicht übernommen werden. Die Adresse wird trotzdem gespeichert.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function submit() {
    if (!item) return;
    setSaving(true); setError("");
    const counts = inventory.map((entry) => ({ case_item_id: entry.id, counted_quantity: entry.counted, note: entry.note || null }));
    if (takeover) {
      const { data, error: submitError } = await getSupabaseClient().rpc("submit_public_takeover", {
        p_public_id: id, p_name: name, p_address: address, p_phone: phone, p_location: location,
        p_counts: counts, p_note: generalNote || null,
      });
      if (submitError) setError(submitError.message);
      else {
        if (coordinates) {
          await getSupabaseClient().rpc("set_public_suitcase_coordinates", {
            p_public_id: id,
            p_latitude: coordinates.latitude,
            p_longitude: coordinates.longitude,
          });
        }
        setResult(data === "deviation" ? "deviation" : "ok"); setStep(4);
      }
    } else {
      const { error: submitError } = await getSupabaseClient().rpc("submit_public_checkout", {
        p_public_id: id, p_counts: counts, p_note: generalNote || null,
      });
      if (submitError) setError(submitError.message);
      else { setResult(differences.length ? "deviation" : "ok"); setStep(4); }
    }
    setSaving(false);
  }

  if (loading) return <main className="public-shell"><section className="handover-card public-state"><div className="public-logo">▣</div><h1>Koffer wird geladen …</h1></section></main>;
  if (error && !item) return <main className="public-shell"><section className="handover-card public-state error-state"><div>!</div><h1>QR-Code nicht gefunden</h1><p>{error}</p></section></main>;
  if (!item) return null;
  if (item.status === "out_of_service") return <main className="public-shell"><section className="handover-card public-state error-state"><div>!</div><h1>{item.case_number} ist gesperrt</h1><p>Dieser Koffer kann derzeit weder übergeben noch übernommen werden. Bitte kontaktiere die Administration.</p></section></main>;

  return <main className="public-shell"><section className="handover-card">
    <header className="handover-head"><span>▣</span><div><b>KÖNA</b><small>{item.case_number} · {item.name}</small></div><span>{step}/4</span></header>
    <div className="stepper">{[1, 2, 3, 4].map((number) => <i className={step >= number ? "on" : ""} key={number}/>)}</div>
    <section className="handover-body">
      {step === 1 && <><p className="kicker">{takeover ? "Unabhängige Übernahme" : "Abschluss durch aktuelle Person"}</p><h1>{takeover ? "Koffer übernehmen" : "Koffer weitergeben"}</h1><p className="intro">{takeover ? "Zähle den Inhalt selbst. Die Angaben der vorherigen Person werden dir bewusst nicht angezeigt." : "Prüfe jeden Gegenstand und schließe deine Übergabe ab. Danach zählt die nächste Person unabhängig."}</p>{takeover && <><label>Vor- und Nachname *<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Max Mustermann"/></label><label>Adresse *<input required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Straße, PLZ Ort"/></label><label>Telefon (optional)<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel"/></label><label>Aktueller Standort *<input required value={location} onChange={(event) => setLocation(event.target.value)}/></label><button type="button" className={`location-capture ${coordinates ? "captured" : ""}`} disabled={locating} onClick={captureLocation}>{coordinates ? "✓ Kartenposition übernommen" : locating ? "Standort wird ermittelt …" : "⌖ Position für die Karte übernehmen"}</button>{locationError && <p className="location-hint error">{locationError}</p>}<p className="location-hint">Die Freigabe ist freiwillig und erfolgt nur nach diesem Klick. Ohne Freigabe bleibt die Textadresse erhalten.</p></>}<button className="primary-action" disabled={takeover && (!name.trim() || !address.trim() || !location.trim())} onClick={() => setStep(2)}>Inhalt zählen</button></>}
      {step === 2 && <><p className="kicker">{item.case_number}</p><h1>Inhalt vollständig zählen</h1><p className="intro">Trage die tatsächlich vorhandene Menge ein. Rot markierte Positionen weichen vom Soll ab.</p><div className="inventory-list">{inventory.map((entry, index) => <div className={`inventory-public-item ${entry.counted !== entry.expected ? "differs" : ""}`} key={entry.id}><div className="inventory-public-main"><span className="item-icon">▤</span><div><b>{entry.name}</b><small>Soll: {entry.expected}</small></div><button aria-label={`${entry.name} verringern`} onClick={() => changeCount(index, -1)}>−</button><strong>{entry.counted}</strong><button aria-label={`${entry.name} erhöhen`} onClick={() => changeCount(index, 1)}>＋</button></div><input value={entry.note} onChange={(event) => setNote(index, event.target.value)} placeholder="Schaden oder Bemerkung (optional)"/></div>)}</div><label>Allgemeiner Hinweis<textarea rows={3} value={generalNote} onChange={(event) => setGeneralNote(event.target.value)} placeholder="Optional: Übergabeort, Schaden oder sonstige Information"/></label><div className="public-actions"><button className="secondary-action" onClick={() => setStep(1)}>Zurück</button><button className="primary-action" onClick={() => setStep(3)}>Zählung prüfen</button></div></>}
      {step === 3 && <><p className="kicker">Zusammenfassung</p><h1>{takeover ? "Übernahme bestätigen" : "Übergabe abschließen"}</h1><div className="summary"><small>Koffer</small><b>{item.case_number} · {item.name}</b>{takeover && <><small>Verantwortliche Person</small><b>{name}</b><small>Adresse / Standort</small><b>{address} · {location}</b></>}<small>Gezählte Positionen</small><b>{inventory.length}</b><small>Abweichungen vom Soll</small><b className={differences.length ? "danger" : ""}>{differences.length ? differences.map((entry) => `${entry.name}: ${entry.counted}/${entry.expected}`).join(" · ") : "Keine"}</b></div><label className="check-card"><span>{takeover ? "Ich habe selbst gezählt und übernehme die Verantwortung für diesen Koffer." : "Ich habe selbst gezählt und schließe die Übergabe verbindlich ab."}</span><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}/></label>{error && <div className="public-error">! {error}</div>}<div className="public-actions"><button className="secondary-action" onClick={() => setStep(2)}>Zurück</button><button className="success-action" disabled={!confirmed || saving} onClick={() => void submit()}>{saving ? "Wird gespeichert …" : takeover ? "Übernahme speichern" : "Übergabe speichern"}</button></div></>}
      {step === 4 && <div className="done"><div>{result === "deviation" ? "!" : "✓"}</div><h1>{takeover ? "Übernahme gespeichert" : "Übergabe gespeichert"}</h1><p>{takeover ? (result === "deviation" ? "Der Koffer ist dir zugeordnet. Die Administration wurde durch den Abweichungsstatus sichtbar informiert." : "Der Koffer ist dir zugeordnet und der neue Standort wurde gespeichert.") : "Der Koffer wartet jetzt auf die unabhängige Zählung und Bestätigung der nächsten Person."}</p></div>}
    </section>
  </section></main>;
}
