import { io, Socket } from 'socket.io-client';
import type { SocketEvents } from '../types/user';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  connect() {
    // Automatically determine server URL based on environment
    let serverUrl = 'http://localhost:3001'; // Default for development
    
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      // If we're on Vercel (production)
      if (hostname.includes('vercel.app')) {
        // Automatically determine backend URL based on frontend URL
        // Replace 'fe' with 'be' in the hostname if present, otherwise use generic pattern
        const backendHostname = hostname.includes('fe') 
          ? hostname.replace('fe', 'be')
          : hostname.replace('spreadsheet', 'spreadsheet-be');
        serverUrl = `https://${backendHostname}`;
        
        // Fallback: You can also set specific URL here
        // serverUrl = 'https://YOUR_ACTUAL_BACKEND_URL.vercel.app';
      }
      // If we're on localhost but frontend is on different port
      else if (hostname === 'localhost' || hostname === '127.0.0.1') {
        serverUrl = 'http://localhost:3001';
      }
    }

    // Allow environment variable to override
    const envUrl = (import.meta as any).env?.VITE_SERVER_URL;
    if (envUrl) {
      serverUrl = envUrl;
    }

    console.log('🌐 Connecting to server:', serverUrl);
    
    try {
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 20000,
        forceNew: true,
        withCredentials: true
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