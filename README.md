# ESP32-MQTT-control
Control of ESP32 microcontroller via MQTT using web app.

## Server logging

The server connects to the configured MQTT broker and forwards messages to a
PostgreSQL database. All events are written to a single table with an
`event_type` column, allowing different device domains (aircon, irrigation, etc.)
to be distinguished and extended later.

### Environment variables

- `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` – broker connection details.
- `AIRCON_TOPIC`, `IRRIGATION_TOPIC` – topics to subscribe to; map to `aircon`
  and `irrigation` event types respectively.
- `EVENT_TABLE` – name of the PostgreSQL table receiving all events. It must
  have columns `id` (optional), `event_type`, and `payload` (JSONB).
- `DATABASE_URL` – PostgreSQL connection string.

Messages with a `recordId` field upsert into the table using that id; otherwise a
new row is inserted with the JSON payload.
