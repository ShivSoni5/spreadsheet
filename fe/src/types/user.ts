export interface User {
  id: string;
  name: string;
  color: string;
  sessionId: string;
}

export interface CellEditor {
  cellId: string;
  user: User;
}

export interface SpreadsheetCell {
  [key: string]: string;
}

export interface SocketEvents {
  'session-joined': (data: {
    sessionId: string;
    user: User;
    users: User[];
    spreadsheetData: SpreadsheetCell[];
    cellEditors: Record<string, User>;
  }) => void;
  'user-joined': (user: User) => void;
  'user-left': (user: User) => void;
  'users-updated': (users: User[]) => void;
  'cell-edit-started': (data: { cellId: string; user: User }) => void;
  'cell-edit-ended': (data: { cellId: string }) => void;
  'cell-value-updated': (data: { rowIndex: number; field: string; value: string }) => void;
  'connect': () => void;
  'disconnect': () => void;
}