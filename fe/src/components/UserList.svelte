<script lang="ts">
  import type { User } from '../types/user';

  export let users: User[] = [];
  export let currentUser: User | null = null;

  function getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
</script>

<div class="user-list">
  {#each users as user (user.id)}
    <div 
      class="user-avatar"
      class:current-user={currentUser?.id === user.id}
      style="background-color: {user.color}"
      title={user.name}
    >
      {getInitials(user.name)}
    </div>
  {/each}
</div>

<style>
  .user-list {
    display: flex;
    gap: 8px;
    align-items: center;
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
  }

  .user-avatar:hover {
    transform: scale(1.1);
  }

  .current-user {
    border-color: #1f2937;
    box-shadow: 0 0 0 2px #ffffff;
  }
</style>