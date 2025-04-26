import { topicList } from "./types";

export const SWITCH_MIN_OPEN_DURATION = 500;
export const SWITCH_MAX_OPEN_DURATION = 20000;

export const CONTROLLER_DEVICE_ID_TO_TOPIC: Record<string, topicList> = {
  "esp32-015C": { topic: "irrigation", quantity: 1 },
};
