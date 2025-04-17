import { mqttTopicItem, makeMqttTopicItem } from "./types";

export const getArrayOfTopicItems = (
  topicList: Record<string, number>
): mqttTopicItem[] => {
  const keys: string[] = Object.keys(topicList);
  const array: mqttTopicItem[] = [];
  for (let i = 0; i < keys.length; i++) {
    //looking at each key now
    const count: number = topicList[keys[i]];
    for (let j = 0; j < count; j++) {
      const topicItem: mqttTopicItem = makeMqttTopicItem(keys[i], j + 1);
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
