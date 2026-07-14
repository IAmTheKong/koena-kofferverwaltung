"use client";
import { use,useMemo,useState } from "react";
import { getCase,type InventoryItem } from "../../demo-data";

type Step=1|2|3|4;
export default function CasePage({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);
 const item=getCase(id); const takeover=item.status==="available"||item.status==="awaiting_acceptance";
 const [step,setStep]=useState<Step>(takeover?1:2); const [name,setName]=useState(""); const [address,setAddress]=useState("");
 const [inventory,setInventory]=useState<InventoryItem[]>(item.inventory.map(x=>({...x}))); const [confirmed,setConfirmed]=useState(false); const [reportOpen,setReportOpen]=useState(false); const [note,setNote]=useState("");
 const diffs=useMemo(()=>inventory.filter(x=>x.actual!==x.expected),[inventory]);
 const change=(i:number,d:number)=>setInventory(all=>all.map((x,n)=>n===i?{...x,actual:Math.max(0,x.actual+d)}:x));
 return <main className="public-shell"><section className="handover-card">
  <header className="handover-head"><button onClick={()=>step>1&&setStep((step-1) as Step)}>←</button><div><b>KÖNA</b><small>{item.id}</small></div><span>?</span></header>
  <div className="stepper"><i className={step>=1?"on":""}/><i className={step>=2?"on":""}/><i className={step>=3?"on":""}/></div>
  <section className="handover-body">
   {step===1&&<><p className="kicker">Koffer übernehmen</p><h1>Deine Angaben</h1><p className="intro">Wer übernimmt den Koffer?</p>
    <label>Dein Name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Vor- und Nachname"/></label>
    <label>Adresse<textarea value={address} onChange={e=>setAddress(e.target.value)} placeholder={'Straße, Hausnummer\nPLZ, Ort'} rows={4}/></label>
    <button className="primary-action" disabled={name.trim().length<2||!address.trim()} onClick={()=>setStep(2)}>Weiter</button></>}
   {step===2&&<><p className="kicker">{takeover?"Koffer übernehmen":"Koffer weitergeben"}</p><h1>{takeover?"Kofferinhalt überprüfen":"Kofferinhalt angeben"}</h1><p className="intro">{takeover?"Überprüfe den Inhalt des Koffers und passe die Mengen an, falls nötig.":"Überprüfe den Inhalt des Koffers. Melde fehlende oder beschädigte Gegenstände."}</p>
    <div className="inventory-list">{inventory.map((x,i)=><div className={x.actual!==x.expected?"inventory-row differs":"inventory-row"} key={x.name}><span className="item-icon">{x.icon}</span><div><b>{x.name}</b><small>Soll: {x.expected}{x.actual<x.expected?` · ${x.expected-x.actual} fehlt`:""}</small></div><button onClick={()=>change(i,-1)}>−</button><strong>{x.actual}</strong><button onClick={()=>change(i,1)}>＋</button></div>)}</div>
    <button className="report-button" onClick={()=>setReportOpen(true)}>＋ Fehlenden oder beschädigten Gegenstand melden</button>
    <div className="check-card"><span>{takeover?"Ich habe den Inhalt überprüft und übernehme den Koffer.":"Ich habe den Inhalt überprüft und bestätige die Angaben."}</span><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/></div>
    <button className="primary-action" disabled={!confirmed} onClick={()=>setStep(3)}>{takeover?"Übernahme bestätigen":"Weiter"}</button></>}
   {step===3&&<><div className="success-panel"><b>✓</b><h2>Übergabe bereit zum Abschluss</h2><p>Bitte bestätige die Übergabe.</p></div>
    <div className="summary"><small>Übergabe an</small><b>{takeover?name:"Nächsten Empfänger"}</b><small>Adresse</small><b>{takeover?address:"Wird bei der Übernahme erfasst"}</b>{diffs.length>0&&<><small>Abweichungen</small><b className="danger">{diffs.map(x=>`${x.name}: ${x.actual}/${x.expected}`).join(" · ")}</b></>}</div>
    <button className="success-action" onClick={()=>setStep(4)}>✓ Übergabe abschließen</button></>}
   {step===4&&<div className="done"><div>✓</div><h1>{takeover?"Übernahme abgeschlossen":"Übergabe abgeschlossen"}</h1><p>{takeover?"Der Koffer wurde dir erfolgreich zugeordnet.":"Der Koffer wartet nun auf die Übernahme durch den nächsten Empfänger."}</p><a href="/admin">Zum Dashboard</a></div>}
  </section>
  {reportOpen&&<div className="sheet-backdrop" onClick={()=>setReportOpen(false)}><section className="bottom-sheet" onClick={e=>e.stopPropagation()}><div className="sheet-handle"/><h2>Gegenstand melden</h2><label>Art der Meldung<select><option>fehlt</option><option>beschädigt</option><option>funktioniert nicht</option><option>zusätzlicher Gegenstand</option><option>sonstiges</option></select></label><label>Beschreibung<textarea value={note} onChange={e=>setNote(e.target.value)} rows={4} placeholder="Was ist aufgefallen?"/></label><button className="primary-action" onClick={()=>setReportOpen(false)}>Meldung übernehmen</button></section></div>}
 </section></main>
}
