import { getAuth } from 'firebase/auth';
import { app } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function getAuthToken(): Promise<string | null> {
  const auth = getAuth(app);
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  return user.getIdToken();
}

async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();
  const headers = new Headers(options.headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new APIError(
      response.status,
      `API request failed: ${response.statusText}`
    );
  }

  return response;
}

// API endpoints
export async function getCurrentUser() {
  const response = await fetchWithAuth('/api/v1/protected/me');
  return response.json();
}

// Example of how to add more API endpoints:
// export async function createChat(data: CreateChatData) {
//   const response = await fetchWithAuth('/api/v1/protected/chats', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify(data),
//   });
//   return response.json();
// }

export const api = {
  getCurrentUser,
  // Group API endpoints
  createGroup: async (name: string) => {
    const response = await fetchWithAuth('/api/v1/protected/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return response.json();
  },

  getGroups: async () => {
    const response = await fetchWithAuth('/api/v1/protected/groups');
    return response.json();
  },

  getGroupById: async (groupId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/groups/${groupId}`);
    return response.json();
  },

  updateGroup: async (groupId: string, name: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/groups/${groupId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return response.json();
  },

  deleteGroup: async (groupId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/groups/${groupId}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  addGroupMember: async (groupId: string, email: string, role?: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }), // Changed to send email
    });
    return response.json();
  },

  removeGroupMember: async (groupId: string, userId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  getGroupMembers: async (groupId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/groups/${groupId}/members`);
    return response.json();
  },

  // Diary Note API endpoints
  createDiaryNote: async (groupId: string, title: string, content: string, createdAt?: string) => {
    const body: any = { title, content };
    if (createdAt) {
      body.createdAt = createdAt;
    }
    const response = await fetchWithAuth(`/api/v1/protected/groups/${groupId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  },

  getDiaryNotesByGroupId: async (groupId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/groups/${groupId}/notes`);
    return response.json();
  },

  getDiaryNoteById: async (groupId: string, noteId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/groups/${groupId}/notes/${noteId}`);
    return response.json();
  },

  updateDiaryNote: async (groupId: string, noteId: string, title?: string, content?: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/groups/${groupId}/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    return response.json();
  },

  deleteDiaryNote: async (groupId: string, noteId: string) => {
    const response = await fetchWithAuth(`/api/v1/protected/groups/${groupId}/notes/${noteId}`, {
      method: 'DELETE',
    });
    return response.json();
  },
}; 