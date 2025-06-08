import { io, Socket } from 'socket.io-client';
import type { SocketEvents } from '../types/user';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  connect() {
    // Use environment variable or fallback to localhost for development
    const serverUrl = (import.meta as any).env?.VITE_SERVER_URL || 'http://localhost:3001';
    
    try {
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 20000,
        forceNew: true
      });

      // Setup event forwarding
      this.socket.on('session-joined', (data) => {
        console.log('🎯 SocketService: session-joined received');
        this.emit('session-joined', data);
      });
      this.socket.on('user-joined', (data) => {
        console.log('🎯 SocketService: user-joined received:', data.name);
        this.emit('user-joined', data);
      });
      this.socket.on('user-left', (data) => {
        console.log('🎯 SocketService: user-left received:', data.name);
        this.emit('user-left', data);
      });
      this.socket.on('users-updated', (data) => {
        console.log('🎯 SocketService: users-updated received:', data.length, 'users');
        this.emit('users-updated', data);
      });
      this.socket.on('cell-edit-started', (data) => {
        this.emit('cell-edit-started', data);
      });
      this.socket.on('cell-edit-ended', (data) => {
        this.emit('cell-edit-ended', data);
      });
      this.socket.on('cell-value-updated', (data) => {
        this.emit('cell-value-updated', data);
      });
      this.socket.on('connect', () => {
        this.emit('connect');
      });
      this.socket.on('disconnect', (reason) => {
        this.emit('disconnect');
      });
      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });
      this.socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    } catch (error) {
      console.error('Failed to create socket connection:', error);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinSession(sessionId: string) {
    if (this.socket) {
      this.socket.emit('join-session', sessionId);
    }
  }

  startCellEdit(sessionId: string, cellId: string) {
    if (this.socket) {
      this.socket.emit('cell-edit-start', { sessionId, cellId });
    }
  }

  endCellEdit(sessionId: string, cellId: string) {
    if (this.socket) {
      this.socket.emit('cell-edit-end', { sessionId, cellId });
    }
  }

  updateCellValue(sessionId: string, rowIndex: number, field: string, value: string) {
    if (this.socket) {
      this.socket.emit('cell-value-change', { sessionId, rowIndex, field, value });
    }
  }

  on<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  private emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }
}

export const socketService = new SocketService();