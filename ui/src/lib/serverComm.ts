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

export async function getGroups() {
  const response = await fetchWithAuth('/api/v1/protected/groups');
  return response.json();
}

export async function createGroup(name: string) {
  const response = await fetchWithAuth('/api/v1/protected/groups', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
  return response.json();
}

export async function getDiaryNotesByGroupId(groupId: string) {
  const response = await fetchWithAuth(`/api/v1/protected/groups/${groupId}/diary-notes`);
  return response.json();
}

export async function getGroupById(groupId: string) {
  const response = await fetchWithAuth(`/api/v1/protected/groups/${groupId}`);
  return response.json();
}

export async function getGroupMembers(groupId: string) {
  const response = await fetchWithAuth(`/api/v1/protected/groups/${groupId}/members`);
  return response.json();
}

export async function createDiaryNote(groupId: string, title: string, content: string, date: string) {
  const response = await fetchWithAuth(`/api/v1/protected/groups/${groupId}/diary-notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, content, date }),
  });
  return response.json();
}

export const api = {
  getCurrentUser,
  getGroups,
  createGroup,
  getDiaryNotesByGroupId,
  getGroupById,
  getGroupMembers,
  createDiaryNote,
}; 