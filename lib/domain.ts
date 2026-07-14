export type CaseStatus =
  | "available"
  | "reserved"
  | "rented"
  | "awaiting_takeover"
  | "deviation"
  | "out_of_service";

export type InventoryItem = {
  id?: string;
  name: string;
  expected: number;
  actual: number;
  note?: string;
};

export type CaseEvent = {
  date: string;
  title: string;
  detail: string;
};

export type CaseItem = {
  databaseId: string;
  id: string;
  publicId: string;
  name: string;
  description?: string;
  status: CaseStatus;
  holder: string;
  address: string;
  location: string;
  latitude?: number;
  longitude?: number;
  returnDue?: string;
  updated: string;
  inventory: InventoryItem[];
  history: CaseEvent[];
};

export type Booking = {
  id: string;
  suitcaseId: string;
  caseNumber: string;
  customerName: string;
  location: string;
  startsOn: string;
  endsOn: string;
  status: "requested" | "confirmed" | "cancelled" | "completed";
};

export const statusLabels: Record<CaseStatus, string> = {
  available: "Verfügbar",
  reserved: "Reserviert",
  rented: "In Nutzung",
  awaiting_takeover: "Wartet auf Übernahme",
  deviation: "Abweichung",
  out_of_service: "Gesperrt / Wartung",
};

export const statusHelp: Record<CaseStatus, string> = {
  available: "Aktuell frei und nicht gesperrt",
  reserved: "Für einen kommenden Zeitraum eingeplant",
  rented: "Aktuell bei einer verantwortlichen Person",
  awaiting_takeover: "Abschluss erfolgt, unabhängige Übernahme offen",
  deviation: "Fehlbestand oder Schaden wurde gemeldet",
  out_of_service: "Nicht buchbar",
};
