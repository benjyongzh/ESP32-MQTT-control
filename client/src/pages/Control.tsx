import { useEffect, useState } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import ControlItem from '../components/ControlItem';

export default function Control() {
  const [client, setClient] = useState<MqttClient | null>(null);

  useEffect(() => {
    const mqttClient = mqtt.connect(import.meta.env.VITE_MQTT_CLUSTER_URL, {
      username: import.meta.env.VITE_MQTT_USERNAME,
      password: import.meta.env.VITE_MQTT_PASSWORD,
    });

    mqttClient.on('connect', () => {
        mqttClient.subscribe(import.meta.env.VITE_MQTT_TOPIC_STATUS);
    });

    setClient(mqttClient);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-3xl mb-6">🌱 ESP32 Irrigation Control</h1>
      <div className="space-x-4">
        <ControlItem client={client} topicControl={import.meta.env.VITE_MQTT_TOPIC_CONTROL} topicStatus={import.meta.env.VITE_MQTT_TOPIC_STATUS} />
      </div>
      <p className="mt-4 text-lg">{client ? '✅ Connected to MQTT broker' : 'Connecting to MQTT...'}</p>
    </div>
  );
}