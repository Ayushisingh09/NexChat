import { useEffect, useRef } from 'react';
import { mqttService } from '../services/mqtt.service';

export function useMqttSubscription(
  topic: string | null,
  handler: (topic: string, payload: any) => void
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!topic) return;

    const wrappedHandler = (t: string, payload: any) => handlerRef.current(t, payload);
    mqttService.subscribe(topic, wrappedHandler);

    return () => {
      mqttService.unsubscribe(topic, wrappedHandler);
    };
  }, [topic]);
}

export function useMqttPublish() {
  return {
    publish: (topic: string, payload: any) => mqttService.publish(topic, payload),
  };
}
