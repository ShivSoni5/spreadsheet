<script lang="ts">
  export let isConnected: boolean = false;
</script>

<div 
  class="connection-status" 
  class:connected={isConnected} 
  class:disconnected={!isConnected}
  title={isConnected ? 'Connected' : 'Disconnected'}
>
  <div class="status-dot"></div>
  <span class="status-text desktop-only">
    {isConnected ? 'Connected' : 'Disconnected'}
  </span>
  <span class="status-text mobile-only">
    {isConnected ? 'C' : 'NC'}
  </span>
</div>

<style>
  .connection-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 16px;
    transition: all 0.2s ease;
    cursor: default;
  }

  .connected {
    color: #10b981;
    background-color: #d1fae5;
  }

  .disconnected {
    color: #ef4444;
    background-color: #fee2e2;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    transition: background-color 0.2s ease;
  }

  .connected .status-dot {
    background-color: #10b981;
  }

  .disconnected .status-dot {
    background-color: #ef4444;
  }

  .status-text {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .desktop-only {
    display: inline;
  }

  .mobile-only {
    display: none;
  }

  @media (max-width: 768px) {
    .desktop-only {
      display: none;
    }
    
    .mobile-only {
      display: inline;
    }
    
    .connection-status {
      padding: 4px 6px;
      gap: 4px;
    }
    
    .status-dot {
      width: 8px;
      height: 8px;
    }
    
    .connected {
      color: #10b981;
      background-color: #d1fae5;
    }
    
    .disconnected {
      color: #ef4444;
      background-color: #fee2e2;
    }
    
    .mobile-only {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
  }
</style>
