const mqtt = require("mqtt");
const { Client } = require("pg");

const EVENT_TYPES = {
  AIRCON: "aircon",
  IRRIGATION: "irrigation",
};

let dbClient;

function startMqttLogger() {
  const topicEventMap = {};
  if (process.env.AIRCON_TOPIC) {
    topicEventMap[process.env.AIRCON_TOPIC] = EVENT_TYPES.AIRCON;
  }
  if (process.env.IRRIGATION_TOPIC) {
    topicEventMap[process.env.IRRIGATION_TOPIC] = EVENT_TYPES.IRRIGATION;
  }

  const topics = Object.keys(topicEventMap);
  if (
    !process.env.MQTT_URL ||
    !process.env.DATABASE_URL ||
    !process.env.EVENT_TABLE ||
    topics.length === 0
  ) {
    console.warn("MQTT logger not started. Missing configuration.");
    return;
  }

  dbClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  dbClient.connect().catch((err) => {
    console.error("Failed to connect to Postgres", err);
  });

  const client = mqtt.connect(process.env.MQTT_URL, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
  });

  client.on("connect", () => {
    topics.forEach((t) => client.subscribe(t, { qos: 1 }));
  });

  client.on("message", async (topic, message) => {
    let payload;
    try {
      payload = JSON.parse(message.toString());
    } catch (err) {
      console.error("Invalid JSON payload", err);
      return;
    }
    const eventType = topicEventMap[topic];
    await logToDb(eventType, payload);
  });
}

async function logToDb(eventType, payload) {
  if (!dbClient) return;
  const table = process.env.EVENT_TABLE;
  const id = payload.recordId;
  try {
    if (id) {
      await dbClient.query(
        `INSERT INTO ${table} (id, event_type, payload) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET event_type = EXCLUDED.event_type, payload = EXCLUDED.payload`,
        [id, eventType, payload]
      );
    } else {
      await dbClient.query(
        `INSERT INTO ${table} (event_type, payload) VALUES ($1, $2)`,
        [eventType, payload]
      );
    }
  } catch (err) {
    console.error("Failed to log to database", err);
  }
}

module.exports = { startMqttLogger };

