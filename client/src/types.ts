export type mqttTopicItem = `${string}/${number}`;

export enum enumClientStatus {
  CONNECTED = "Connected",
  ERROR = "Error",
  RECONNECTED = "Reconnected",
  CLOSED = "Closed",
}

export const makeMqttTopicItem = (
  topicCategory: string,
  index: number
): mqttTopicItem => {
  return `${topicCategory}/${index}`;
};

export enum enumMqttTopicType {
  CONTROL = "control",
  STATUS = "status",
  CONFIG = "config",
  HEALTH = "controllerhealth",
}

export const getMqttTopicId = (
  topic: mqttTopicItem,
  type: enumMqttTopicType
): mqttTopicId => {
  return `${topic}/${type}`;
};

export type mqttTopicId = `${mqttTopicItem}/${enumMqttTopicType}`;
// const id: mqttTopicId = 'irrigation/1/control';

export type mqttMessage = {
  message: string | mqttConfigMessage | mqttHealthMessage;
  timestamp: string;
};

export type mqttConfigMessage = {
  highDuration?: number;
  heartbeatInterval?: number;
  // add other config properties here in the future
  // e.g. pressure: number, enabled: boolean, etc.
};

export type mqttHealthMessage = {
  ipAddress: string;
};

export type topicList = {
  topic: string;
  quantity: number;
};
