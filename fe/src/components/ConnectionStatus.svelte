<script lang="ts">
  export let isConnected: boolean = false;
</script>

<div class="connection-status" class:connected={isConnected} class:disconnected={!isConnected}>
  <div class="status-dot"></div>
  <span class="status-text">
    {isConnected ? 'Connected' : 'Disconnected'}
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
</style>
