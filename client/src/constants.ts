import { topicList } from "./types";

export const SWITCH_MIN_OPEN_DURATION = 500;
export const SWITCH_MAX_OPEN_DURATION = 20000;

export const CONTROLLER_DEVICE_ID_TO_TOPIC: Record<string, topicList> = {
  "esp32-DEE3": { topic: "studyroom-monsii", quantity: 1 },
  "esp32-E6D7": { topic: "water-monsiis", quantity: 2 },
  "esp32-77EE": { topic: "avii-moss", quantity: 1 },
};
