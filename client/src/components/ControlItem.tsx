import { useEffect, useState } from "react";
import { MqttClient } from "mqtt";
import { mqttTopicId } from "../types";
import { enumClientStatus } from "../pages/Control";

enum enumSwitchStatus {
  LOW = "Off",
  HIGH = "On",
  SENDING = "Sending",
  UNKNOWN = "Unknown",
}

export default function ControlItem(props: {
  client: MqttClient | null;
  clientStatus: enumClientStatus;
  topicControl: mqttTopicId;
  topicStatus: mqttTopicId;
}) {
  const { client, clientStatus, topicControl, topicStatus } = props;
  const [status, setStatus] = useState<enumSwitchStatus>(
    enumSwitchStatus.UNKNOWN
  );

  useEffect(() => {
    if (
      clientStatus === enumClientStatus.CONNECTED ||
      enumClientStatus.RECONNECTED
    ) {
      client?.subscribe(topicStatus, { qos: 1 }, (err) => {
        if (!err) {
          console.log("subscribing to", topicStatus);
        } else console.log(`subcription error for ${topicStatus}`, err);
      });

      client?.on("message", (topic, msg) => {
        console.log(
          `Received message on topic ${topic}: ${msg}: ${msg.toString()}`
        );
        if (topic === topicStatus) {
          const result: String = msg.toString();
          setStatus(enumSwitchStatus[result as keyof typeof enumSwitchStatus]);
        }
      });
    }
  }, [clientStatus]);

  const toggleCommand = () => {
    if (
      clientStatus === enumClientStatus.CONNECTED ||
      clientStatus === enumClientStatus.RECONNECTED
    ) {
      if (status === enumSwitchStatus.LOW) {
        client?.publish(
          topicControl,
          enumSwitchStatus.HIGH,
          { retain: true },
          () => setStatus(enumSwitchStatus.SENDING)
        );
      } else if (status === enumSwitchStatus.HIGH) {
        client?.publish(
          topicControl,
          enumSwitchStatus.LOW,
          { retain: true },
          () => setStatus(enumSwitchStatus.SENDING)
        );
      }
    } else {
      setStatus(enumSwitchStatus.UNKNOWN);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-x-4">
      <button
        className="bg-green-500 text-white px-6 py-2 rounded"
        onClick={() => toggleCommand()}
      >
        {status}
      </button>
      <p className="mt-4 text-lg">Currently {status}</p>
    </div>
  );
}
