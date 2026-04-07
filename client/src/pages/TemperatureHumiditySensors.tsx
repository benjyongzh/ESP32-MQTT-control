import { useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";

import Logo from "@/components/Logo";
import ControlLayout from "@/components/ControlLayout";
import TemperatureHumidityItem from "@/components/TemperatureHumidityItem";
import { useMqttClient } from "@/components/hooks/useMqttClient";
import { ControlClient, createControlClient } from "@/lib/control-client";
import { TEMPERATURE_HUMIDITY_DEVICE_ID_TO_TOPIC } from "@/constants";
import { enumClientStatus, mqttTopicItem } from "@/types";
import { getArrayOfTopicItems } from "@/utils";

export default function TemperatureHumiditySensors() {
  const [client, setClient] = useState<ControlClient | null>(null);
  const { clientStatus } = useMqttClient({ mqttClient: client });

  useEffect(() => {
    setClient(createControlClient());
  }, []);

  const topicItems: mqttTopicItem[] = useMemo(
    () => getArrayOfTopicItems(TEMPERATURE_HUMIDITY_DEVICE_ID_TO_TOPIC),
    []
  );

  return (
    <ControlLayout>
      <div className="mt-42">
        <Logo />
      </div>

      <div className="mb-4 flex w-full max-w-xl items-center justify-center gap-2">
        {clientStatus === enumClientStatus.CONNECTED ||
        clientStatus === enumClientStatus.RECONNECTED ? (
          <Check className="text-foreground" />
        ) : (
          <LoaderCircle className="animate-spin text-foreground" />
        )}
        <p className="sm:text-lg">
          {clientStatus === enumClientStatus.CONNECTED ||
          clientStatus === enumClientStatus.RECONNECTED
            ? "Connected to MQTT broker"
            : "Connecting to MQTT..."}
        </p>
      </div>

      <div className="flex w-full max-w-screen-lg flex-col">
        <div className="flex w-full items-center gap-2 border-b-1 border-primary-foreground pb-2">
          <div className="min-w-0 flex-1 text-left">Topic</div>
          <div className="w-14 shrink-0 text-center truncate">Temp.</div>
          <div className="w-16 shrink-0 text-center truncate">Humidity</div>
          <div className="w-10 shrink-0" />
        </div>
        <div className="flex w-full flex-col items-stretch justify-start">
          {topicItems.map((topic) => (
            <TemperatureHumidityItem
              client={client}
              topicItem={topic}
              key={topic}
            />
          ))}
        </div>
      </div>
    </ControlLayout>
  );
}
