<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { socketService } from '../services/socketService';
  import type { User, SpreadsheetCell } from '../types/user';

  export let sessionId: string = '';
  export let documentId: string = 'default-doc';
  export let currentUser: User | null = null;
  export const users: User[] = []; // Receive users from parent App component
  export let initialSpreadsheetData: SpreadsheetCell[] = []; // Initial data from parent
  export let initialCellEditors: Record<string, User> = {}; // Initial cell editors from parent

  let spreadsheetData: SpreadsheetCell[] = [];
  let cellEditors: Record<string, User> = {};
  let editingCell: string | null = null;
  let isUpdatingFromServer = false; // Flag to prevent update loops

  
  // Debounce utilities
  const debouncedCellUpdates = new Map<string, number>(); // Store timeout IDs
  const debouncedEditEvents = new Map<string, number>(); // Store timeout IDs for edit events
  
  // Debounce utility function
  function debounce<T extends (...args: any[]) => void>(
    func: T, 
    delay: number, 
    timeoutMap: Map<string, number>,
    key: string
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      // Clear existing timeout
      const existingTimeout = timeoutMap.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      
      // Set new timeout
      const timeoutId = setTimeout(() => {
        func(...args);
        timeoutMap.delete(key);
      }, delay);
      
      timeoutMap.set(key, timeoutId);
    };
  }



  // Initialize 10 rows of empty data
  function initializeRowData(): SpreadsheetCell[] {
    const data: SpreadsheetCell[] = [];
    for (let i = 0; i < 10; i++) {
      const row: SpreadsheetCell = {};
      for (let j = 0; j < 10; j++) {
        const field = String.fromCharCode(65 + j); // A-J
        row[field] = '';
      }
      data.push(row);
    }
    return data;
  }

  // Generate column headers A-J
  const columnHeaders = Array.from({ length: 10 }, (_, i) => String.fromCharCode(65 + i));

  // Optimized: Only compute styles for cells that are actually being edited
  $: editedCellStyles = (() => {
    const styles: Record<string, string> = {};
    
    // Only compute for cells that have editors (much smaller set)
    Object.keys(cellEditors).forEach(cellId => {
      const editor = cellEditors[cellId];
      if (editor && editor.id !== currentUser?.id) {
        styles[cellId] = `
          background-color: ${editor.color}20; 
          border: 2px solid ${editor.color}; 
          box-shadow: 0 0 8px ${editor.color}40;
          position: relative;
        `;
      }
    });
    
    // Add current user's editing cell
    if (editingCell) {
      styles[editingCell] = `
        background-color: #dbeafe; 
        border: 2px solid #2563eb;
        box-shadow: 0 0 8px #2563eb40;
        position: relative;
      `;
    }
    
    return styles;
  })();

  // Optimized: Only track editors for cells being edited
  $: editedCellTitles = (() => {
    const titles: Record<string, string> = {};
    Object.keys(cellEditors).forEach(cellId => {
      const editor = cellEditors[cellId];
      if (editor && editor.id !== currentUser?.id) {
        titles[cellId] = `${editor.name} is editing this cell`;
      }
    });
    return titles;
  })();



  // Handle cell focus (start editing) - debounced
  function handleCellFocus(rowIndex: number, columnKey: string): void {
    const cellId = `${rowIndex}-${columnKey}`;
    editingCell = cellId;
    
    if (sessionId && documentId) {
      // Debounce the server call to prevent rapid focus/blur events
      const debouncedStartEdit = debounce(
        (sId: string, dId: string, cId: string) => {
          socketService.startCellEdit(sId, dId, cId);
        },
        150, // 150ms delay
        debouncedEditEvents,
        `start-${cellId}`
      );
      
      debouncedStartEdit(sessionId, documentId, cellId);
    }
  }

  // Handle cell blur (stop editing) - debounced
  function handleCellBlur(rowIndex: number, columnKey: string): void {
    const cellId = `${rowIndex}-${columnKey}`;
    editingCell = null;
    
    if (sessionId && documentId) {
      // Cancel any pending start edit for this cell
      const startTimeout = debouncedEditEvents.get(`start-${cellId}`);
      if (startTimeout) {
        clearTimeout(startTimeout);
        debouncedEditEvents.delete(`start-${cellId}`);
      }
      
      // Debounce the end edit call
      const debouncedEndEdit = debounce(
        (sId: string, dId: string, cId: string) => {
          socketService.endCellEdit(sId, dId, cId);
        },
        100, // 100ms delay
        debouncedEditEvents,
        `end-${cellId}`
      );
      
      debouncedEndEdit(sessionId, documentId, cellId);
    }
  }

  // Handle cell value change - heavily debounced for performance
  function handleCellChange(rowIndex: number, columnKey: string, event: Event): void {
    // Skip if this is an update from server to prevent loops
    if (isUpdatingFromServer) return;
    
    const target = event.target as HTMLInputElement;
    const value = target.value;
    const cellId = `${rowIndex}-${columnKey}`;
    
    // Update local data immediately for responsiveness (no debouncing for UI)
    if (spreadsheetData[rowIndex]) {
      spreadsheetData[rowIndex][columnKey] = value;
      spreadsheetData = [...spreadsheetData];
    }
    
    // Debounce server updates for performance
    if (sessionId && documentId) {
      const debouncedUpdate = debounce(
        (sId: string, dId: string, rIdx: number, cKey: string, val: string) => {
          socketService.updateCellValue(sId, dId, rIdx, cKey, val);
        },
        300, // 300ms delay for value changes
        debouncedCellUpdates,
        cellId
      );
      
      debouncedUpdate(sessionId, documentId, rowIndex, columnKey, value);
    }
  }


  // Get user initials for avatar
  function getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  onMount(() => {
    // Set up socket event listeners FIRST, before any data initialization
    socketService.on('session-joined', (data) => {
      console.log('📋 Spreadsheet: session-joined received with data:', data.spreadsheetData?.length, 'rows');
      // Only update if we don't already have initial data from parent
      if (spreadsheetData.length === 0 || spreadsheetData.every(row => Object.values(row).every(cell => !cell))) {
        spreadsheetData = data.spreadsheetData || initializeRowData();
        cellEditors = data.cellEditors || {};
      }
    });

    socketService.on('cell-edit-started', (data) => {
      cellEditors[data.cellId] = data.user;
      cellEditors = { ...cellEditors };
    });

    socketService.on('cell-edit-ended', (data) => {
      delete cellEditors[data.cellId];
      cellEditors = { ...cellEditors };
    });

    socketService.on('document-cleared' as any, (data: { documentId: string }) => {
      if (data.documentId === documentId) {
        console.log('📄 Document has been cleared due to inactivity. Resetting view.');
        spreadsheetData = initializeRowData();
        cellEditors = {};
      }
    });

    socketService.on('cell-value-updated', (data) => {
      const rowIndex = data.rowIndex;
      const field = data.field;
      const value = data.value;
      const senderSessionId = data.senderSessionId;
      
      // Skip updates from the same session to prevent overwriting local changes
      if (senderSessionId === sessionId) {
        console.log('🚫 Skipping self-update for cell:', `${rowIndex}-${field}`);
        return;
      }
      
      if (spreadsheetData[rowIndex] && field) {
        // Set flag to prevent triggering another update
        isUpdatingFromServer = true;
        
        // Update the data
        spreadsheetData[rowIndex][field] = value;
        spreadsheetData = [...spreadsheetData];
        
        // Reset flag after a brief delay
        setTimeout(() => {
          isUpdatingFromServer = false;
        }, 10);
      }
    });
    
    // Initialize with data from parent (if available) or empty grid as fallback
    if (initialSpreadsheetData && initialSpreadsheetData.length > 0) {
      console.log('📊 Spreadsheet: Using initial data from parent:', initialSpreadsheetData.length, 'rows');
      spreadsheetData = initialSpreadsheetData;
      cellEditors = initialCellEditors;
    } else {
      console.log('📊 Spreadsheet: No initial data, creating empty grid');
      spreadsheetData = initializeRowData();
    }
  });

  onDestroy(() => {
    // Clean up all pending timeouts
    debouncedCellUpdates.forEach(timeoutId => clearTimeout(timeoutId));
    debouncedEditEvents.forEach(timeoutId => clearTimeout(timeoutId));
    debouncedCellUpdates.clear();
    debouncedEditEvents.clear();
  });
</script>

<div class="spreadsheet-container">
  <table class="spreadsheet-table">
    <thead>
      <tr>
        <th class="row-header"></th>
        {#each columnHeaders as header}
          <th class="column-header">{header}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each spreadsheetData as row, rowIndex}
        <tr>
          <td class="row-number">{rowIndex + 1}</td>
          {#each columnHeaders as columnKey}
            <td class="cell-container">
              {#each [`${rowIndex}-${columnKey}`] as cellId}
                <input
                  type="text"
                  class="cell-input"
                  value={row[columnKey] || ''}
                  style={editedCellStyles[cellId] || ''}
                  title={editedCellTitles[cellId] || ''}
                  on:focus={() => handleCellFocus(rowIndex, columnKey)}
                  on:blur={() => handleCellBlur(rowIndex, columnKey)}
                  on:input={(event) => handleCellChange(rowIndex, columnKey, event)}
                />
                
                <!-- Show editor indicator when someone else is editing -->
                {#if cellEditors[cellId] && cellEditors[cellId].id !== currentUser?.id}
                  {#each [cellEditors[cellId]] as editor}
                    <div 
                      class="cell-editor-indicator" 
                      style="background-color: {editor.color}"
                      title="{editor.name} is editing this cell"
                      role="tooltip"
                      aria-label="{editor.name} is editing this cell"
                    >
                      {getInitials(editor.name)}
                    </div>
                  {/each}
                {/if}
              {/each}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .spreadsheet-container {
    flex: 1;
    min-height: 0;
    overflow: auto;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    position: relative;
  }



  .spreadsheet-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .row-header,
  .column-header {
    background-color: #f8fafc;
    border: 1px solid #e5e7eb;
    padding: 8px;
    text-align: center;
    font-weight: bold;
    color: #374151;
    position: sticky;
  }

  .row-header {
    top: 0;
    left: 0;
    z-index: 3;
    width: 50px;
  }

  .column-header {
    top: 0;
    z-index: 2;
    width: 120px;
  }

  .row-number {
    background-color: #f8fafc;
    border: 1px solid #e5e7eb;
    padding: 8px;
    text-align: center;
    font-weight: bold;
    color: #374151;
    width: 50px;
    position: sticky;
    left: 0;
    z-index: 1;
  }

  .cell-container {
    padding: 0;
    border: 1px solid #f3f4f6;
    width: 120px;
    height: 32px;
    position: relative;
  }

  .cell-input {
    width: 100%;
    height: 100%;
    border: none;
    outline: none;
    padding: 4px 8px;
    font-family: inherit;
    font-size: 14px;
    background: transparent;
    transition: all 0.2s ease;
    border-radius: 2px;
  }

  .cell-input:focus {
    background-color: #dbeafe;
    border: 2px solid #2563eb;
    z-index: 1;
    position: relative;
    box-shadow: 0 0 8px rgba(37, 99, 235, 0.3);
  }

  .cell-input:hover:not(:focus) {
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
  }

  tbody tr:hover {
    background-color: #f9fafb;
  }

  .cell-editor-indicator {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 8px;
    z-index: 10;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    animation: pulse 2s infinite;
    cursor: help;
    pointer-events: auto;
  }

  .cell-editor-indicator:hover {
    z-index: 999;
    animation-play-state: paused;
    transform: scale(1.1);
  }

  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }
</style>