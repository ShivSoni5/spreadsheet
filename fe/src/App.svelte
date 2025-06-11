<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Spreadsheet from './components/Spreadsheet.svelte';
  import UserList from './components/UserList.svelte';
  import ConnectionStatus from './components/ConnectionStatus.svelte';
  import { socketService } from './services/socketService';
  import type { User } from './types/user';

  let users: User[] = [];
  let currentUser: User | null = null;
  let isConnected = false;
  let sessionId = '';
  let documentId = 'default-doc'; // Add documentId - could be from URL or fixed
  let isMobileMenuOpen = false; // Mobile menu state
  let initialSpreadsheetData: any[] = []; // Store initial spreadsheet data
  let initialCellEditors: Record<string, any> = {}; // Store initial cell editors

  onMount(() => {
    // Initialize socket connection
    socketService.connect();
    
    // Set up event listeners BEFORE connecting
    setupEventListeners();
  });

  function setupEventListeners() {
    // Listen for socket events
    socketService.on('session-joined', (data) => {
      console.log('📋 Session joined:', { sessionId: data.sessionId, documentId: data.documentId, users: data.users.length, userNames: data.users.map(u => u.name) });
      console.log('📊 App: Received spreadsheet data:', data.spreadsheetData?.length, 'rows');
      sessionId = data.sessionId;
      documentId = data.documentId;
      currentUser = data.user;
      users = data.users;
      isConnected = true;
      
      // Store spreadsheet data to pass to Spreadsheet component
      initialSpreadsheetData = data.spreadsheetData || [];
      initialCellEditors = data.cellEditors || {};
      
      // Store document ID in localStorage for other tabs
      localStorage.setItem('spreadsheet-document-id', documentId);
    });

    socketService.on('user-joined', (user: User) => {
      console.log('👤 User joined:', user.name, 'Total users before:', users.length);
      // Check if user already exists to prevent duplicates
      if (!users.find(u => u.id === user.id)) {
        users = [...users, user];
        console.log('✅ Added user, Total users now:', users.length);
      } else {
        console.log('⚠️ User already exists, skipping');
      }
    });

    socketService.on('user-left', (leftUser: User) => {
      console.log('👋 User left:', leftUser.name, 'Total users before:', users.length);
      users = users.filter(u => u.id !== leftUser.id);
      console.log('✅ Removed user, Total users now:', users.length);
    });

    socketService.on('users-updated', (updatedUsers: User[]) => {
      console.log('🔄 Users updated - Before:', users.length, 'After:', updatedUsers.length);
      console.log('🔄 New user list:', updatedUsers.map(u => u.name));
      users = updatedUsers;
    });

    socketService.on('connect', () => {
      console.log('🔌 Socket connected, joining document...');
      isConnected = true;
      
      // Join document only after connection is established
      const urlParams = new URLSearchParams(window.location.search);
      const documentFromUrl = urlParams.get('doc') || urlParams.get('document');
      
      // Check localStorage for existing document (to share across tabs)
      const storedDocumentId = localStorage.getItem('spreadsheet-document-id');
      
      // Use URL document > stored document > default
      const targetDocumentId = documentFromUrl || storedDocumentId || 'default-doc';
      
      console.log('🎯 Joining document:', { fromUrl: documentFromUrl, stored: storedDocumentId, target: targetDocumentId });
      socketService.joinSession(targetDocumentId);
    });

    socketService.on('disconnect', () => {
      isConnected = false;
    });
  }

  // Toggle mobile menu
  function toggleMobileMenu(): void {
    isMobileMenuOpen = !isMobileMenuOpen;
  }

  // Get user initials for avatar
  function getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  onDestroy(() => {
    socketService.disconnect();
  });
</script>

<main class="app-container">
  <header class="app-header">
    <div class="header-left">
      <h1>Collaborative Spreadsheet</h1>
      <ConnectionStatus {isConnected} />
      
      <!-- Desktop session info -->
      {#if sessionId}
        <div class="session-info desktop-only">
          <div class="info-row">
            <span class="info-label">Document:</span>
            <span class="info-value">{documentId}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Session:</span>
            <span class="info-value">{sessionId.slice(0, 8)}...</span>
          </div>
          <div class="info-row">
            <span class="info-label">Users:</span>
            <span class="info-value user-count">{users.length} active</span>
          </div>
        </div>
      {/if}
    </div>
    
    <div class="header-right">
      <!-- Desktop user list -->
      <div class="desktop-only">
        <UserList {users} {currentUser} />
      </div>
      
      <!-- Mobile hamburger menu -->
      <button 
        class="mobile-menu-btn mobile-only" 
        on:click={toggleMobileMenu}
        aria-label="Toggle menu"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          {#if isMobileMenuOpen}
            <path d="M18 6L6 18M6 6l12 12"/>
          {:else}
            <path d="M3 12h18M3 6h18M3 18h18"/>
          {/if}
        </svg>
      </button>
    </div>
  </header>
  
  <!-- Mobile menu overlay -->
  {#if isMobileMenuOpen}
    <div class="mobile-menu-overlay" on:click={toggleMobileMenu}>
      <div class="mobile-menu" on:click|stopPropagation>
        <div class="mobile-menu-header">
          <h3>Spreadsheet Info</h3>
          <button class="close-btn" on:click={toggleMobileMenu}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        {#if sessionId}
          <div class="mobile-session-info">
            <div class="info-item">
              <span class="label">Connection:</span>
              <span class="value connection-value" class:connected={isConnected} class:disconnected={!isConnected}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div class="info-item">
              <span class="label">Document:</span>
              <span class="value">{documentId}</span>
            </div>
            <div class="info-item">
              <span class="label">Session:</span>
              <span class="value">{sessionId.slice(0, 8)}...</span>
            </div>
            <div class="info-item">
              <span class="label">Active Users:</span>
              <span class="value">{users.length}</span>
            </div>
          </div>
        {/if}
        
        <div class="mobile-user-list">
          <h4>Connected Users</h4>
          <div class="user-grid">
            {#each users as user (user.id)}
              <div class="mobile-user-item" class:current={currentUser?.id === user.id}>
                <div 
                  class="user-avatar"
                  style="background-color: {user.color}"
                >
                  {getInitials(user.name)}
                </div>
                <span class="user-name">{user.name}</span>
                {#if currentUser?.id === user.id}
                  <span class="you-badge">You</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <div class="app-content">
    {#if sessionId}
      <Spreadsheet {sessionId} {documentId} {currentUser} {users} {initialSpreadsheetData} {initialCellEditors} />
    {:else}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Connecting to spreadsheet...</p>
      </div>
    {/if}
  </div>
</main>

<style>
  .app-container {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: #ffffff;
  }

  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    background-color: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    z-index: 10;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header-left h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: #1f2937;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }



  .app-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .loading-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: #6b7280;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e5e7eb;
    border-top: 3px solid #2563eb;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Responsive utilities */
  .desktop-only {
    display: flex;
    align-items: center;
  }

  .mobile-only {
    display: none;
  }



  /* Mobile menu button */
  .mobile-menu-btn {
    background: none;
    border: none;
    padding: 8px;
    cursor: pointer;
    color: #374151;
    border-radius: 6px;
    transition: background-color 0.2s ease;
  }

  .mobile-menu-btn:hover {
    background-color: #f3f4f6;
  }

  /* Mobile menu overlay */
  .mobile-menu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 50;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding-top: 60px;
  }

  .mobile-menu {
    background: white;
    width: 90%;
    max-width: 320px;
    border-radius: 12px 0 0 12px;
    padding: 20px;
    max-height: calc(100vh - 80px);
    overflow-y: auto;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  }

  .mobile-menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e5e7eb;
  }

  .mobile-menu-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #1f2937;
  }

  .close-btn {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: #6b7280;
    border-radius: 4px;
  }

  .close-btn:hover {
    background-color: #f3f4f6;
    color: #374151;
  }

  /* Mobile session info */
  .mobile-session-info {
    margin-bottom: 24px;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #f3f4f6;
  }

  .info-item:last-child {
    border-bottom: none;
  }

  .info-item .label {
    font-weight: 600;
    color: #6b7280;
    font-size: 14px;
  }

  .info-item .value {
    font-family: monospace;
    color: #374151;
    font-size: 14px;
    font-weight: 500;
  }

  .connection-value {
    font-family: inherit !important;
    font-weight: 600 !important;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px !important;
  }

  .connection-value.connected {
    color: #10b981;
    background-color: #d1fae5;
  }

  .connection-value.disconnected {
    color: #ef4444;
    background-color: #fee2e2;
  }

  /* Mobile user list */
  .mobile-user-list h4 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
  }

  .user-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mobile-user-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
  }

  .mobile-user-item.current {
    background-color: #eff6ff;
    border-color: #3b82f6;
  }

  .mobile-user-item .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 12px;
    flex-shrink: 0;
  }

  .mobile-user-item .user-name {
    flex: 1;
    font-weight: 500;
    color: #374151;
  }

  .you-badge {
    background-color: #059669;
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }

  @media (max-width: 768px) {
    .app-header {
      padding: 12px 16px;
    }

    .header-left h1 {
      font-size: 18px;
    }

    .header-left {
      gap: 12px;
    }

    .desktop-only {
      display: none !important;
    }

    .mobile-only {
      display: flex;
      align-items: center;
    }

    .current-user-display {
      margin-right: 8px;
    }
  }

  .session-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    align-items: flex-start;
  }

  .info-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .info-label {
    color: #6b7280;
    font-weight: 500;
    min-width: 60px;
  }

  .info-value {
    color: #374151;
    font-family: monospace;
    font-weight: 600;
  }

  .user-count {
    color: #059669 !important;
    font-family: inherit !important;
  }
</style>
