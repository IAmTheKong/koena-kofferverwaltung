export type Status = "frei" | "unterwegs" | "reserviert" | "offen" | "abweichung";
export type InventoryItem = { name: string; expected: number; actual: number };
export type CaseItem = {
  id: string;
  name: string;
  status: Status;
  holder: string;
  address: string;
  updated: string;
  next?: string;
  inventory: InventoryItem[];
  history: { date: string; title: string; detail: string }[];
};

export const defaultInventory: InventoryItem[] = [
  { name: "Server", expected: 1, actual: 1 },
  { name: "Drucker", expected: 2, actual: 2 },
  { name: "Handys", expected: 5, actual: 5 },
  { name: "USV", expected: 1, actual: 1 },
  { name: "Tablets", expected: 3, actual: 3 },
  { name: "Router", expected: 2, actual: 2 },
  { name: "Kabelsets", expected: 4, actual: 4 },
];

const inv = () => defaultInventory.map((item) => ({ ...item }));

export const casesSeed: CaseItem[] = [
  { id: "K-001", name: "Einsatzkoffer Nord", status: "frei", holder: "Lager Freistadt", address: "Industriestraße 2, 4240 Freistadt", updated: "Heute, 09:10", next: "20.–24. Juli", inventory: inv(), history: [{ date: "14.07.2026", title: "Rückgabe abgeschlossen", detail: "Lager Freistadt" }] },
  { id: "K-002", name: "Einsatzkoffer Süd", status: "unterwegs", holder: "Max Huber", address: "Hauptstraße 14, 4020 Linz", updated: "Heute, 14:32", next: "Rückgabe 17. Juli", inventory: inv(), history: [{ date: "12.07.2026", title: "Übernommen", detail: "Max Huber · Linz" }, { date: "01.07.2026", title: "Rückgabe", detail: "Lager Freistadt" }] },
  { id: "K-003", name: "Einsatzkoffer West", status: "offen", holder: "Peter Gruber", address: "Ringstraße 8, 4600 Wels", updated: "Gestern, 18:10", next: "Übernahme offen", inventory: inv(), history: [{ date: "13.07.2026", title: "Abschluss durch Vormieter", detail: "Peter Gruber · Wels" }] },
  { id: "K-004", name: "Einsatzkoffer Ost", status: "reserviert", holder: "Lager Freistadt", address: "Industriestraße 2, 4240 Freistadt", updated: "12.07.2026", next: "15.–19. Juli", inventory: inv(), history: [{ date: "10.07.2026", title: "Reserviert", detail: "Einsatz Wien" }] },
  { id: "K-005", name: "Einsatzkoffer Mitte", status: "abweichung", holder: "Anna Maier", address: "Neubaugasse 20, 1070 Wien", updated: "11.07.2026", next: "Rückgabe 16. Juli", inventory: inv().map((item) => item.name === "Drucker" || item.name === "Kabelsets" ? { ...item, actual: item.actual - 1 } : item), history: [{ date: "11.07.2026", title: "Übernahme mit Abweichung", detail: "1 Drucker und 1 Kabelset fehlen" }] },
];

export const statusLabels: Record<Status, string> = {
  frei: "Verfügbar",
  unterwegs: "Unterwegs",
  reserviert: "Reserviert",
  offen: "Übernahme offen",
  abweichung: "Abweichung",
};
