# KÖNA Kofferverwaltung

Next.js- und Supabase-Anwendung für Koffer, Buchungen, Inventar sowie getrennte Übergabe- und Übernahmezählungen per QR-Code.

## Lokal starten

1. `.env.example` nach `.env.local` kopieren und Supabase-URL sowie Publishable Key eintragen.
2. `npm install`
3. `npm run dev`
4. `/admin` öffnen und mit einem Supabase-Auth-Konto anmelden, dessen `app_metadata` `{ "role": "admin" }` enthält.

## Datenbank

Die Migrationen in `supabase/migrations` enthalten:

- Row Level Security für alle Verwaltungsdaten
- überschneidungsfreie aktive Buchungen
- atomisches Anlegen von Koffer, Inhalt und Historienereignis
- sichere, auf eine zufällige QR-UUID begrenzte Funktionen für öffentliche Zählungen
- getrennte `checkout`- und `takeover`-Bestände

Migrationen werden mit der Supabase CLI oder über die Supabase-Projektverwaltung angewendet.

## Prüfung

```bash
npm run build
```

Beim Anlegen gilt das ID-Format `KFR-001`. Der Datenbank-RPC behandelt Koffer und Inhaltspositionen als eine Transaktion; bei einem Fehler wird der gesamte Vorgang zurückgerollt.
