import { topicList, enumMqttTopicType } from "./types";

export const USE_MOCK_IRRIGATION_DATA =
  import.meta.env.VITE_USE_MOCK_IRRIGATION_DATA === "true";

export const HEARTBEAT_INTERVAL_MIN = 0.1; //minutes
export const HEARTBEAT_INTERVAL_MAX = 20;

export const DEFAULT_TARGET_WEIGHT_CHANGE = 100;
export const MIN_TARGET_WEIGHT_CHANGE = 50;
export const DEFAULT_HIGH_DURATION_MS = 3000;
export const MIN_HIGH_DURATION_MS = 1000;
export const MAX_HIGH_DURATION_MS = 60000;
export const DEFAULT_TOLERANCE_WEIGHT = 10;
export const MIN_TOLERANCE_WEIGHT = 0;
export const DEFAULT_TOLERANCE_DURATION_MS = 5000;
export const MIN_TOLERANCE_DURATION_MS = 100;
export const MAX_TOLERANCE_DURATION_MS = 6000;
export const DEFAULT_SENSOR_READ_INTERVAL_MS = 500;
export const MIN_SENSOR_READ_INTERVAL_MS = 100;
export const MAX_SENSOR_READ_INTERVAL_MS = 1000;
export const DEFAULT_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS = 60;
export const MIN_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS = 1;
export const MAX_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS = 6000;

export const CONTROLLER_DEVICE_ID_TO_TOPIC: Record<string, topicList> = {
  "esp32-DEE3": { topic: "studyroom-monsii", quantity: 1 },
  "esp32-E6D7": { topic: "leca-monsii", quantity: 1 },
  // "esp32-77EE": { topic: "avii-moss", quantity: 1 },
};

export const TEMPERATURE_HUMIDITY_DEVICE_ID_TO_TOPIC: Record<string, topicList> = {
  "esp32-TH01": { topic: "studyroom-climate", quantity: 1 },
  "esp32-TH02": { topic: "livingroom-climate", quantity: 1 },
};

export const AIRCON_DEVICE_ID = "mitsubishi-aircon";
export const AIRCON_COMPONENT_INDEX = 1;
export const AIRCON_MQTT_TOPIC = `${AIRCON_DEVICE_ID}/${AIRCON_COMPONENT_INDEX}/${enumMqttTopicType.CONTROL}`;
