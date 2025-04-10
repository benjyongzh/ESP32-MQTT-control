export type mqttTopicItem = `${string}/${number}`;

export const makeMqttTopicItem = (
  topicCategory: string,
  index: number
): mqttTopicItem => {
  return `${topicCategory}/${index}`;
};

export type mqttTopicType = "control" | "status";

export const getMqttTopicId = (
  topic: mqttTopicItem,
  type: mqttTopicType
): mqttTopicId => {
  return `${topic}/${type}`;
};

export type mqttTopicId = `${mqttTopicItem}/${mqttTopicType}`;
// const id: mqttTopicId = 'irrigation/1/control';
