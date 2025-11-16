import { topicList, enumMqttTopicType } from "./types";

export const HEARTBEAT_INTERVAL_MIN = 0.1; //minutes
export const HEARTBEAT_INTERVAL_MAX = 20;

export const DEFAULT_TARGET_WEIGHT_INCREASE = 100;
export const MIN_TARGET_WEIGHT_INCREASE = 0;
export const DEFAULT_TOLERANCE_WEIGHT = 10;
export const MIN_TOLERANCE_WEIGHT = 0;
export const DEFAULT_TOLERANCE_DURATION_MS = 5000;
export const MIN_TOLERANCE_DURATION_MS = 1000;
export const MAX_TOLERANCE_DURATION_MS = 600000;
export const DEFAULT_WEIGHT_READ_INTERVAL_MS = 500;
export const MIN_WEIGHT_READ_INTERVAL_MS = 100;
export const MAX_WEIGHT_READ_INTERVAL_MS = 10000;

export const CONTROLLER_DEVICE_ID_TO_TOPIC: Record<string, topicList> = {
  "esp32-DEE3": { topic: "studyroom-monsii", quantity: 1 },
  "esp32-E6D7": { topic: "water-monsiis", quantity: 2 },
  "esp32-77EE": { topic: "avii-moss", quantity: 1 },
};

export const AIRCON_DEVICE_ID = "mitsubishi-aircon";
export const AIRCON_COMPONENT_INDEX = 1;
export const AIRCON_MQTT_TOPIC = `${AIRCON_DEVICE_ID}/${AIRCON_COMPONENT_INDEX}/${enumMqttTopicType.CONTROL}`;
