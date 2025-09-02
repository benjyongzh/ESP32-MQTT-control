import { useEffect, useState } from "react";
import mqtt, { MqttClient } from "mqtt";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { LoaderCircle } from "lucide-react";
import ControlLayout from "@/components/ControlLayout";
import { useMqttClient } from "@/components/hooks/useMqttClient";
import { enumClientStatus, mqttMessage } from "../types";
import { AIRCON_MQTT_TOPIC } from "../constants";

export default function AirconControl() {
  const [client, setClient] = useState<MqttClient | null>(null);
  const { clientStatus } = useMqttClient({ mqttClient: client });

  useEffect(() => {
    const mqttClient = mqtt.connect(import.meta.env.VITE_MQTT_CLUSTER_URL, {
      username: import.meta.env.VITE_MQTT_USERNAME,
      password: import.meta.env.VITE_MQTT_PASSWORD,
    });
    setClient(mqttClient);
  }, []);

  const sendCommand = (cmd: string) => {
    if (!client) return;
    const message: mqttMessage = {
      message: cmd,
      timestamp: new Date().toISOString(),
    };
    client.publish(AIRCON_MQTT_TOPIC, JSON.stringify(message), { retain: true });
  };

  return (
    <ControlLayout>
      <div className="flex flex-col items-center justify-center max-w-xl -mt-5">
        <Logo />
        <div className="mb-4 w-full max-w-xl flex justify-center items-center gap-2">
          {clientStatus === enumClientStatus.CONNECTED ||
          clientStatus === enumClientStatus.RECONNECTED ? (
            "✅"
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
        <div className="flex gap-4">
          <Button onClick={() => sendCommand("ON")}>Turn On</Button>
          <Button onClick={() => sendCommand("OFF")} variant="destructive">
            Turn Off
          </Button>
        </div>
      </div>
    </ControlLayout>
  );
}
