<script lang="ts">
  import type { User } from '../types/user';

  export let users: User[] = [];
  export let currentUser: User | null = null;

  function getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  // Reorder users to show current user last (rightmost)
  $: reorderedUsers = users.slice().sort((a, b) => {
    if (currentUser?.id === a.id) return 1;
    if (currentUser?.id === b.id) return -1;
    return 0;
  });
</script>

<div class="user-list">
  {#each reorderedUsers as user (user.id)}
    <div class="user-container">
      <div 
        class="user-avatar"
        class:current-user={currentUser?.id === user.id}
        style="background-color: {user.color}"
        title="{user.name}{currentUser?.id === user.id ? ' (You)' : ''}"
        role="tooltip"
        aria-label="{user.name}{currentUser?.id === user.id ? ' (You)' : ''}"
      >
        {getInitials(user.name)}
      </div>
      {#if currentUser?.id === user.id}
        <span class="you-label">(You)</span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .user-list {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  .user-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 14px;
    cursor: default;
    transition: transform 0.2s ease;
    border: 2px solid transparent;
    position: relative;
    z-index: 1;
  }

  .user-avatar:hover {
    transform: scale(1.1);
    z-index: 999;
  }

  .current-user {
    border-color: #1f2937;
    box-shadow: 0 0 0 2px #ffffff;
  }

  .you-label {
    font-size: 10px;
    color: #6b7280;
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
  }
</style>