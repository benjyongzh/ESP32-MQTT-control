export type mqttTopicItem = `${string}/${number}`;

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
  message: string | mqttConfigMessage;
  timestamp: string;
};

export type mqttConfigMessage = {
  duration?: string;
};
