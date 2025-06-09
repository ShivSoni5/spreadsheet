import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = createServer(app);

// Configure CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? [
          /^https:\/\/.*\.vercel\.app$/,  // Allow any vercel.app domain
          "http://localhost:5173", 
          "http://localhost:5174"
        ]
      : ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"],
    credentials: true,
    allowEIO3: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        /^https:\/\/.*\.vercel\.app$/,  // Allow any vercel.app domain
        "http://localhost:5173", 
        "http://localhost:5174"
      ]
    : ["http://localhost:5173", "http://localhost:5174"],
  credentials: true
}));

app.use(express.json());

// Basic root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Spreadsheet Backend API', 
    version: '1.0.0',
    status: 'running',
    endpoints: ['/health', '/debug/sessions']
  });
});

// In-memory storage (use database in production)
const sessions = new Map();
const users = new Map();
const spreadsheetData = new Map();
const cellEditors = new Map(); // Track who is editing which cell

// Generate random names
const randomNames = [
  'Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Avery', 'Quinn',
  'Sage', 'Rowan', 'Ember', 'River', 'Sky', 'Phoenix', 'Kai', 'Sage'
];

const colors = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', 
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#84cc16'
];

function generateRandomName() {
  return randomNames[Math.floor(Math.random() * randomNames.length)] + 
         Math.floor(Math.random() * 1000);
}

function generateUserColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Debug endpoint to check sessions
app.get('/debug/sessions', (req, res) => {
  const sessionData = {};
  for (const [sessionId, session] of sessions.entries()) {
    sessionData[sessionId] = {
      users: session.users.length,
      userNames: session.users.map(u => u.name),
      created: session.created
    };
  }
  
  res.json({
    totalSessions: sessions.size,
    totalUsers: users.size,
    sessions: sessionData
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join session
  socket.on('join-session', (sessionId) => {
    console.log('🔌 User joining session:', { socketId: socket.id, requestedSessionId: sessionId });
    
    if (!sessionId) {
      sessionId = uuidv4();
      console.log('🆕 Generated new session:', sessionId);
    }

    // Create user
    const user = {
      id: socket.id,
      name: generateRandomName(),
      color: generateUserColor(),
      sessionId
    };

    console.log('👤 Created user:', user.name, 'for session:', sessionId);

    users.set(socket.id, user);
    socket.join(sessionId);
    
    console.log('User joined room:', sessionId);

    // Initialize session if it doesn't exist
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        id: sessionId,
        users: [],
        created: new Date()
      });
      
      // Initialize spreadsheet data - 10x10 grid to match client
      const initialData = [];
      for (let i = 0; i < 10; i++) {
        const row = {};
        for (let j = 0; j < 10; j++) {
          const colName = String.fromCharCode(65 + j); // A-J
          row[colName] = '';
        }
        initialData.push(row);
      }
      spreadsheetData.set(sessionId, initialData);
      cellEditors.set(sessionId, new Map());
    }

    // Add user to session
    const session = sessions.get(sessionId);
    session.users = session.users.filter(u => u.id !== socket.id);
    session.users.push(user);

    console.log('📊 Session users:', session.users.length, 'users:', session.users.map(u => u.name));

    // Get current cell editors for this session
    const sessionCellEditors = cellEditors.get(sessionId) || new Map();
    const cellEditorsObject = Object.fromEntries(sessionCellEditors);

    // Send current state to user
    socket.emit('session-joined', {
      sessionId,
      user,
      users: session.users,
      spreadsheetData: spreadsheetData.get(sessionId),
      cellEditors: cellEditorsObject
    });

    console.log('📤 Broadcasting user-joined and users-updated to session:', sessionId);
    // Notify ALL users in the session (including the sender) about the new user
    io.to(sessionId).emit('user-joined', user);
    io.to(sessionId).emit('users-updated', session.users);
  });

  // Handle cell edit start
  socket.on('cell-edit-start', ({ sessionId, cellId }) => {
    const user = users.get(socket.id);
    console.log('✏️ Server received cell-edit-start:', { sessionId, cellId, user: user?.name, socketId: socket.id });
    
    if (user) {
      let sessionCellEditors = cellEditors.get(sessionId);
      if (!sessionCellEditors) {
        sessionCellEditors = new Map();
        cellEditors.set(sessionId, sessionCellEditors);
      }
      sessionCellEditors.set(cellId, user);
      
      console.log('📤 Broadcasting cell-edit-started to session:', sessionId, 'for cell:', cellId);
      // Broadcast to all users in the session including sender
      io.to(sessionId).emit('cell-edit-started', { cellId, user });
    } else {
      console.error('❌ User not found for socket:', socket.id);
    }
  });

  // Handle cell edit end
  socket.on('cell-edit-end', ({ sessionId, cellId }) => {
    console.log('✅ Server received cell-edit-end:', { sessionId, cellId, socketId: socket.id });
    
    const sessionCellEditors = cellEditors.get(sessionId);
    if (sessionCellEditors) {
      sessionCellEditors.delete(cellId);
      console.log('📤 Broadcasting cell-edit-ended to session:', sessionId, 'for cell:', cellId);
      // Broadcast to all users in the session including sender
      io.to(sessionId).emit('cell-edit-ended', { cellId });
    } else {
      console.log('⚠️ No session editors found for session:', sessionId);
    }
  });

  // Handle cell value change
  socket.on('cell-value-change', ({ sessionId, rowIndex, field, value }) => {
    console.log('📝 Server received cell-value-change:', { sessionId, rowIndex, field, value, from: socket.id });
    
    const data = spreadsheetData.get(sessionId);
    if (data && data[rowIndex]) {
      data[rowIndex][field] = value;
      spreadsheetData.set(sessionId, data);
      
      console.log('📤 Broadcasting cell-value-updated to session:', sessionId);
      // Broadcast change to ALL users in the session (including sender for confirmation)
      io.to(sessionId).emit('cell-value-updated', { rowIndex, field, value });
    } else {
      console.log('❌ Invalid data or rowIndex for session:', sessionId);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const user = users.get(socket.id);
    if (user) {
      const session = sessions.get(user.sessionId);
      if (session) {
        session.users = session.users.filter(u => u.id !== socket.id);
        
        // Remove user from cell editors for this session
        const sessionCellEditors = cellEditors.get(user.sessionId);
        if (sessionCellEditors) {
          for (const [cellId, editor] of sessionCellEditors.entries()) {
            if (editor.id === socket.id) {
              sessionCellEditors.delete(cellId);
              io.to(user.sessionId).emit('cell-edit-ended', { cellId });
            }
          }
        }
        
        // Notify ALL remaining users in the session
        io.to(user.sessionId).emit('user-left', user);
        io.to(user.sessionId).emit('users-updated', session.users);
      }
      
      users.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export for Vercel
export default app;