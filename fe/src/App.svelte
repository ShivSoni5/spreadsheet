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

  onMount(() => {
    // Initialize socket connection
    socketService.connect();
    
    // Set up event listeners BEFORE connecting
    setupEventListeners();
  });

  function setupEventListeners() {
    // Listen for socket events
    socketService.on('session-joined', (data) => {
      console.log('📋 Session joined:', { sessionId: data.sessionId, users: data.users.length, userNames: data.users.map(u => u.name) });
      sessionId = data.sessionId;
      currentUser = data.user;
      users = data.users;
      isConnected = true;
      
      // Store session ID in localStorage for other tabs
      localStorage.setItem('spreadsheet-session-id', sessionId);
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
      console.log('🔌 Socket connected, joining session...');
      isConnected = true;
      
      // Join session only after connection is established
      const urlParams = new URLSearchParams(window.location.search);
      const sessionFromUrl = urlParams.get('session');
      
      // Check localStorage for existing session (to share across tabs)
      const storedSessionId = localStorage.getItem('spreadsheet-session-id');
      
      // Use URL session > stored session > create new
      const targetSessionId = sessionFromUrl || storedSessionId || '';
      
      console.log('🎯 Joining session:', { fromUrl: sessionFromUrl, stored: storedSessionId, target: targetSessionId });
      socketService.joinSession(targetSessionId);
    });

    socketService.on('disconnect', () => {
      isConnected = false;
    });
  }

  onDestroy(() => {
    socketService.disconnect();
  });

  function copySessionLink() {
    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionId);
    navigator.clipboard.writeText(url.toString());
  }
</script>

<main class="app-container">
  <header class="app-header">
    <div class="header-left">
      <h1>Collaborative Spreadsheet</h1>
      <ConnectionStatus {isConnected} />
      {#if sessionId}
        <div class="session-info">
          <span class="session-id">Session: {sessionId.slice(0, 8)}...</span>
          <span class="user-count">{users.length} user{users.length !== 1 ? 's' : ''}</span>
        </div>
        <button class="share-button" on:click={copySessionLink} title="Copy session link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16,6 12,2 8,6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          Share
        </button>
      {/if}
    </div>
    <div class="header-right">
      <UserList {users} {currentUser} />
    </div>
  </header>

  <div class="app-content">
    {#if sessionId}
      <Spreadsheet {sessionId} {currentUser} {users} />
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

  .share-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background-color: #2563eb;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .share-button:hover {
    background-color: #1d4ed8;
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
  }

  .session-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
    color: #6b7280;
  }

  .session-id {
    font-family: monospace;
    font-weight: 500;
  }

  .user-count {
    color: #059669;
    font-weight: 600;
  }
</style>
