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
          /^https:\/\/.*\.railway\.app$/,  // Allow any railway.app domain
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
        /^https:\/\/.*\.railway\.app$/,  // Allow any railway.app domain
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
const spreadsheetDocuments = new Map(); // Changed from spreadsheetData - keyed by documentId
const documentCellEditors = new Map(); // Changed from cellEditors - keyed by documentId
const documentSessions = new Map(); // Track which sessions are working on which documents
const documentLastActivity = new Map(); // Track last activity time for each document

// Generate random names
const randomNames = [
  'Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Avery', 'Quinn',
  'Sage', 'Rowan', 'Ember', 'River', 'Sky', 'Phoenix', 'Kai', 'Sage'
];

const colors = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', 
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#84cc16'
];

function touchDocument(documentId) {
  documentLastActivity.set(documentId, new Date());
}

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
      user: session.user.name,
      documentId: session.documentId,
      created: session.created
    };
  }
  
  const documentData = {};
  for (const [documentId, docSessions] of documentSessions.entries()) {
    const docUsers = [];
    for (const [userId, userData] of users.entries()) {
      if (userData.documentId === documentId) {
        docUsers.push(userData.name);
      }
    }
    documentData[documentId] = {
      sessions: docSessions.size,
      users: docUsers
    };
  }
  
  res.json({
    totalSessions: sessions.size,
    totalUsers: users.size,
    totalDocuments: spreadsheetDocuments.size,
    sessions: sessionData,
    documents: documentData
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join session
  socket.on('join-session', ({ documentId }) => {
    console.log('🔌 User joining document:', { socketId: socket.id, documentId });
    
    touchDocument(documentId);
    
    // Always generate a new unique session ID for each user
    const sessionId = uuidv4();
    console.log('🆕 Generated new session for user:', sessionId);

    // Create user with unique session
    const user = {
      id: socket.id,
      name: generateRandomName(),
      color: generateUserColor(),
      sessionId,
      documentId
    };

    console.log('👤 Created user:', user.name, 'for document:', documentId);

    users.set(socket.id, user);
    socket.join(sessionId); // User joins their own session
    socket.join(`doc:${documentId}`); // User also joins document room
    
    console.log('User joined session:', sessionId, 'and document room:', `doc:${documentId}`);

    // Initialize user session
    sessions.set(sessionId, {
      id: sessionId,
      userId: socket.id,
      user,
      documentId,
      created: new Date()
    });

    // Initialize document if it doesn't exist
    if (!spreadsheetDocuments.has(documentId)) {
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
      spreadsheetDocuments.set(documentId, initialData);
      documentCellEditors.set(documentId, new Map());
      documentSessions.set(documentId, new Set());
      touchDocument(documentId);
    }

    // Add session to document tracking
    const docSessions = documentSessions.get(documentId);
    docSessions.add(sessionId);

    // Get all users working on this document
    const allDocumentUsers = [];
    for (const [userId, userData] of users.entries()) {
      if (userData.documentId === documentId) {
        allDocumentUsers.push(userData);
      }
    }

    console.log('📊 Document users:', allDocumentUsers.length, 'users:', allDocumentUsers.map(u => u.name));

    // Get current cell editors for this document
    const docCellEditors = documentCellEditors.get(documentId) || new Map();
    const cellEditorsObject = Object.fromEntries(docCellEditors);

    // Get the current spreadsheet data for this document
    const currentSpreadsheetData = spreadsheetDocuments.get(documentId);

    // Send current state to user
    socket.emit('session-joined', {
      sessionId,
      documentId,
      user,
      users: allDocumentUsers,
      spreadsheetData: currentSpreadsheetData,
      cellEditors: cellEditorsObject
    });

    console.log('📤 Broadcasting user-joined and users-updated to document:', documentId);
    // Notify ALL users working on this document about the new user
    io.to(`doc:${documentId}`).emit('user-joined', user);
    io.to(`doc:${documentId}`).emit('users-updated', allDocumentUsers);
  });

  // Handle cell edit start
  socket.on('cell-edit-start', ({ sessionId, documentId, cellId }) => {
    const user = users.get(socket.id);
    console.log('✏️ Server received cell-edit-start:', { sessionId, documentId, cellId, user: user?.name, socketId: socket.id });
    
    if (user) {
      touchDocument(documentId);
      let docCellEditors = documentCellEditors.get(documentId);
      if (!docCellEditors) {
        docCellEditors = new Map();
        documentCellEditors.set(documentId, docCellEditors);
      }
      docCellEditors.set(cellId, user);
      
      console.log('📤 Broadcasting cell-edit-started to document:', documentId, 'for cell:', cellId);
      // Broadcast to all users working on this document
      io.to(`doc:${documentId}`).emit('cell-edit-started', { cellId, user });
    } else {
      console.error('❌ User not found for socket:', socket.id);
    }
  });

  // Handle cell edit end
  socket.on('cell-edit-end', ({ sessionId, documentId, cellId }) => {
    console.log('✅ Server received cell-edit-end:', { sessionId, documentId, cellId, socketId: socket.id });
    
    touchDocument(documentId);
    const docCellEditors = documentCellEditors.get(documentId);
    if (docCellEditors) {
      docCellEditors.delete(cellId);
      console.log('📤 Broadcasting cell-edit-ended to document:', documentId, 'for cell:', cellId);
      // Broadcast to all users working on this document
      io.to(`doc:${documentId}`).emit('cell-edit-ended', { cellId });
    } else {
      console.log('⚠️ No document editors found for document:', documentId);
    }
  });

  // Handle cell value change
  socket.on('cell-value-change', ({ sessionId, documentId, rowIndex, field, value }) => {
    console.log('📝 Server received cell-value-change:', { sessionId, documentId, rowIndex, field, value, from: socket.id });
    
    touchDocument(documentId);
    const data = spreadsheetDocuments.get(documentId);
    if (data && data[rowIndex]) {
      data[rowIndex][field] = value;
      spreadsheetDocuments.set(documentId, data);
      
      console.log('📤 Broadcasting cell-value-updated to document:', documentId);
      // Broadcast change to ALL users working on this document, include sender sessionId
      io.to(`doc:${documentId}`).emit('cell-value-updated', { 
        rowIndex, 
        field, 
        value, 
        senderSessionId: sessionId 
      });
    } else {
      console.log('❌ Invalid data or rowIndex for document:', documentId);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const user = users.get(socket.id);
    if (user) {
      const { sessionId, documentId } = user;
      
      // Remove session from document tracking
      const docSessions = documentSessions.get(documentId);
      if (docSessions) {
        docSessions.delete(sessionId);
      }
      
      // Remove user from cell editors for this document
      const docCellEditors = documentCellEditors.get(documentId);
      if (docCellEditors) {
        for (const [cellId, editor] of docCellEditors.entries()) {
          if (editor.id === socket.id) {
            docCellEditors.delete(cellId);
            io.to(`doc:${documentId}`).emit('cell-edit-ended', { cellId });
          }
        }
      }
      
      // Get remaining users working on this document
      const remainingDocumentUsers = [];
      for (const [userId, userData] of users.entries()) {
        if (userData.documentId === documentId && userId !== socket.id) {
          remainingDocumentUsers.push(userData);
        }
      }
      
      // Notify remaining users in the document
      io.to(`doc:${documentId}`).emit('user-left', user);
      io.to(`doc:${documentId}`).emit('users-updated', remainingDocumentUsers);
      
      // Clean up user and session
      users.delete(socket.id);
      sessions.delete(sessionId);
    }
  });
});

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const CHECK_INTERVAL = 60 * 1000; // 1 minute

setInterval(() => {
  const now = new Date();
  for (const [documentId, lastActivity] of documentLastActivity.entries()) {
    if (now.getTime() - lastActivity.getTime() > INACTIVITY_TIMEOUT) {
      console.log(`🗑️  Document ${documentId} inactive. Clearing data.`);
      
      io.to(`doc:${documentId}`).emit('document-cleared', { documentId });
      
      const initialData = [];
      for (let i = 0; i < 10; i++) {
        const row = {};
        for (let j = 0; j < 10; j++) {
          const colName = String.fromCharCode(65 + j);
          row[colName] = '';
        }
        initialData.push(row);
      }
      spreadsheetDocuments.set(documentId, initialData);
      documentCellEditors.set(documentId, new Map());
      
      documentLastActivity.delete(documentId);
    }
  }
}, CHECK_INTERVAL);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export for Vercel
export default app;