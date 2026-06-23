import { useSocketStore } from '../store/socket.store';

type MessageHandler = (topic: string, payload: any) => void;

class MqttService {
  private subscriptions = new Map<string, Set<MessageHandler>>();
  private connected = false;

  connect() {
    if (this.connected) return;
    const socket = useSocketStore.getState().socket;
    if (!socket) return;

    this.connected = true;

    socket.on('mqtt:message', (data: { topic: string; payload: any }) => {
      this.subscriptions.forEach((handlers, pattern) => {
        if (this.matchTopic(pattern, data.topic)) {
          handlers.forEach((handler) => handler(data.topic, data.payload));
        }
      });
    });
  }

  private matchTopic(pattern: string, topic: string): boolean {
    if (pattern === topic) return true;
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return topic.startsWith(prefix + '/') || topic === prefix;
    }
    if (pattern === '#') return true;
    return false;
  }

  subscribe(topic: string, handler: MessageHandler) {
    const socket = useSocketStore.getState().socket;
    if (!socket) return;

    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      socket.emit('mqtt:subscribe', topic);
    }
    this.subscriptions.get(topic)!.add(handler);
  }

  unsubscribe(topic: string, handler: MessageHandler) {
    const socket = useSocketStore.getState().socket;
    const handlers = this.subscriptions.get(topic);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(topic);
        if (socket) socket.emit('mqtt:unsubscribe', topic);
      }
    }
  }

  publish(topic: string, payload: any) {
    const socket = useSocketStore.getState().socket;
    if (!socket) return;
    socket.emit('mqtt:publish', { topic, payload });
  }

  disconnect() {
    this.subscriptions.clear();
    this.connected = false;
  }
}

export const mqttService = new MqttService();
