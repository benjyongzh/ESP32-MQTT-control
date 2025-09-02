import { topicList } from "./types";

export const SWITCH_MIN_OPEN_DURATION = 500; //miileseconds
export const SWITCH_MAX_OPEN_DURATION = 60000;

export const HEARTBEAT_INTERVAL_MIN = 0.1; //minutes
export const HEARTBEAT_INTERVAL_MAX = 20;

export const CONTROLLER_DEVICE_ID_TO_TOPIC: Record<string, topicList> = {
  "esp32-DEE3": { topic: "studyroom-monsii", quantity: 1 },
  "esp32-E6D7": { topic: "water-monsiis", quantity: 2 },
  "esp32-77EE": { topic: "avii-moss", quantity: 1 },
};

export const AIRCON_MQTT_TOPIC = "mitsubishi-aircon/control";
