import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import mqtt, { MqttClient } from 'mqtt';
import ControlItem from '../components/ControlItem';

export default function Control() {
  const [client, setClient] = useState<MqttClient | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_BACKEND_URL}/auth/check`, { withCredentials: true })
      .then(() => {
        const mqttClient = mqtt.connect(import.meta.env.VITE_MQTT_CLUSTER_URL, {
          username: import.meta.env.VITE_MQTT_USERNAME,
          password: import.meta.env.VITE_MQTT_PASSWORD,
        });

        mqttClient.on('connect', () => {
            mqttClient.subscribe(import.meta.env.VITE_MQTT_TOPIC_STATUS);
        });

        setClient(mqttClient);
      })
      .catch(() => navigate('/login'));
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-3xl mb-6">🌱 ESP32 Irrigation Control</h1>
      <div className="space-x-4">
        <ControlItem client={client} topicControl={import.meta.env.VITE_MQTT_TOPIC_CONTROL} topicStatus={import.meta.env.VITE_MQTT_TOPIC_STATUS} />
      </div>
      <p className="mt-4 text-lg">{client ? 'Connecting to MQTT...' : '✅ Connected to MQTT broker'}</p>
    </div>
  );
}