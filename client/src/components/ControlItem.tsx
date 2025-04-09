import { useEffect, useState } from 'react';
import { MqttClient } from 'mqtt';

enum EnumStatus {
    LOW = "Status is currently Off",
    HIGH = "Status is currently On",
    SENDING = "⏳ Sending '${cmd}' command...",
}

export default function ControlItem(props: {client:MqttClient | null, topicControl:string, topicStatus:string}) {
    const {client, topicControl, topicStatus} = props
  const [status, setStatus] = useState<String>("");

  useEffect(() => {
        client?.on('message', (topic, msg) => {
          if (topic === topicStatus) {
            const result:String = msg.toString()
            setStatus(EnumStatus[result as keyof typeof EnumStatus]);
          }
        });
  }, []);

  const toggleCommand = () => {
    if (client?.connected) {
        if (status === EnumStatus.LOW){
            client.publish(topicControl, EnumStatus.HIGH)
        } else if (status === EnumStatus.HIGH){
            client.publish(topicControl, EnumStatus.LOW)
        } 
        setStatus(EnumStatus.SENDING);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-x-4">
        <button className="bg-green-500 text-white px-6 py-2 rounded" onClick={() => toggleCommand()}>
          {status === EnumStatus.LOW ? "On" : status === EnumStatus.HIGH ? "Off" : "loading"}
        </button>
      <p className="mt-4 text-lg">{status}</p>
    </div>
  );
}