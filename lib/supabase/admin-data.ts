import type { Booking, CaseItem, CaseStatus, InventoryItem } from "../domain";
import { getSupabaseClient } from "./client";

type SuitcaseRow = {
  id: string;
  case_number: string;
  qr_public_id: string;
  name: string;
  description: string | null;
  status: CaseStatus;
  current_holder_name: string | null;
  current_holder_address: string | null;
  current_location_name: string;
  return_due_on: string | null;
  updated_at: string;
  case_items: Array<{
    id: string;
    name: string;
    expected_quantity: number;
    current_quantity: number;
    note: string | null;
    sort_order: number;
  }>;
  case_events: Array<{
    event_type: string;
    location_name: string | null;
    holder_name: string | null;
    note: string | null;
    occurred_at: string;
  }>;
};

type BookingRow = {
  id: string;
  suitcase_id: string;
  customer_name: string;
  location_name: string | null;
  starts_on: string;
  ends_on: string;
  status: Booking["status"];
  suitcases: { case_number: string } | null;
};

const dateTime = new Intl.DateTimeFormat("de-AT", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDate(value: string) {
  return dateTime.format(new Date(value));
}

function mapSuitcase(row: SuitcaseRow): CaseItem {
  return {
    databaseId: row.id,
    id: row.case_number,
    publicId: row.qr_public_id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status,
    holder: row.current_holder_name ?? "–",
    address: row.current_holder_address ?? row.current_location_name,
    location: row.current_location_name,
    returnDue: row.return_due_on ?? undefined,
    updated: formatDate(row.updated_at),
    inventory: [...(row.case_items ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        id: item.id,
        name: item.name,
        expected: item.expected_quantity,
        actual: item.current_quantity,
        note: item.note ?? undefined,
      })),
    history: (row.case_events ?? []).map((event) => ({
      date: formatDate(event.occurred_at),
      title: event.event_type,
      detail: [event.holder_name, event.location_name, event.note].filter(Boolean).join(" · "),
    })),
  };
}

export async function loadAdminData() {
  const supabase = getSupabaseClient();
  const [caseResult, bookingResult] = await Promise.all([
    supabase
      .from("suitcases")
      .select(`
        id, case_number, qr_public_id, name, description, status,
        current_holder_name, current_holder_address, current_location_name,
        return_due_on, updated_at,
        case_items (id, name, expected_quantity, current_quantity, note, sort_order),
        case_events (event_type, location_name, holder_name, note, occurred_at)
      `)
      .is("archived_at", null)
      .order("case_number"),
    supabase
      .from("bookings")
      .select("id, suitcase_id, customer_name, location_name, starts_on, ends_on, status, suitcases(case_number)")
      .order("starts_on"),
  ]);

  if (caseResult.error) throw caseResult.error;
  if (bookingResult.error) throw bookingResult.error;

  const cases = (caseResult.data as unknown as SuitcaseRow[]).map(mapSuitcase);
  const bookings: Booking[] = (bookingResult.data as unknown as BookingRow[] ?? []).map((row) => ({
    id: row.id,
    suitcaseId: row.suitcase_id,
    caseNumber: row.suitcases?.case_number ?? "–",
    customerName: row.customer_name,
    location: row.location_name ?? "–",
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    status: row.status,
  }));

  return { cases, bookings };
}

export async function createCase(input: {
  id: string;
  name: string;
  description: string;
  location: string;
  inventory: InventoryItem[];
}) {
  const { data, error } = await getSupabaseClient().rpc("create_suitcase_with_items", {
    p_case_number: input.id,
    p_name: input.name,
    p_description: input.description || null,
    p_location: input.location,
    p_items: input.inventory.map((item) => ({
      name: item.name,
      expected_quantity: item.expected,
      note: item.note || null,
    })),
  });

  if (error) throw error;
  return data as string;
}

export async function createBooking(input: {
  suitcaseId: string;
  customerName: string;
  location: string;
  startsOn: string;
  endsOn: string;
}) {
  const { error } = await getSupabaseClient().from("bookings").insert({
    suitcase_id: input.suitcaseId,
    customer_name: input.customerName,
    location_name: input.location || null,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    status: "confirmed",
  });
  if (error) throw error;
}

export async function archiveCase(databaseId: string) {
  const { error } = await getSupabaseClient()
    .from("suitcases")
    .update({ archived_at: new Date().toISOString(), status: "out_of_service" })
    .eq("id", databaseId);
  if (error) throw error;
}
