// frontend/src/services/obs.service.ts
const OBS_WS_URL = 'ws://localhost:4455';

export const obsService = {
  connect: () => {
    const socket = new WebSocket(OBS_WS_URL);
    return socket;
  },
  
  startStreaming: (socket: WebSocket) => {
    socket.send(JSON.stringify({
      requestType: 'StartStreaming',
      requestId: '1'
    }));
  },
  
  stopStreaming: (socket: WebSocket) => {
    socket.send(JSON.stringify({
      requestType: 'StopStreaming',
      requestId: '2'
    }));
  },
  
  setScene: (socket: WebSocket, sceneName: string) => {
    socket.send(JSON.stringify({
      requestType: 'SetCurrentScene',
      requestId: '3',
      sceneName: sceneName
    }));
  },
};