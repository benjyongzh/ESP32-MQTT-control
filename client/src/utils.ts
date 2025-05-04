import { mqttTopicItem, makeMqttTopicItem, topicList } from "./types";
import { CONTROLLER_DEVICE_ID_TO_TOPIC } from "./constants";

export const getArrayOfTopicItems = (
  deviceIdToTopic: Record<string, topicList>
): mqttTopicItem[] => {
  const deviceIds: string[] = Object.keys(deviceIdToTopic);
  const array: mqttTopicItem[] = [];
  for (let i = 0; i < deviceIds.length; i++) {
    //looking at each key now
    const list: topicList = deviceIdToTopic[deviceIds[i]];
    for (let j = 0; j < list.quantity; j++) {
      const topicItem: mqttTopicItem = makeMqttTopicItem(deviceIds[i], j + 1);
      array.push(topicItem);
    }
  }
  return array;
};

export function getEnumKeyByEnumValue(
  myEnum: { [key: string | number]: string | number },
  enumValue: string | number
): string | number {
  return Object.keys(myEnum)[Object.values(myEnum).indexOf(enumValue)];
}

export const dateFormatter = new Intl.DateTimeFormat("en-SG", {
  timeZone: "Asia/Singapore",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
// console.log(dateFormatter.format(date));
// Example: "15 Apr 2025, 22:47:18"

export const formatTopicFromTopicString = (
  topicString: mqttTopicItem
): string => {
  const [deviceId, index] = topicString.split("/");
  const list: topicList = CONTROLLER_DEVICE_ID_TO_TOPIC[deviceId];
  return `${list.topic}/${index}`;
};
