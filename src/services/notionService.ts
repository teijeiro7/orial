import * as SecureStore from 'expo-secure-store';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export interface NotionCredentials {
  accessToken: string;
  workspaceName?: string;
  workspaceIcon?: string;
}

export class NotionService {
  private accessToken: string | null = null;

  async loadCredentials(): Promise<NotionCredentials | null> {
    try {
      const token = await SecureStore.getItemAsync('notion_access_token');
      if (!token) return null;
      
      this.accessToken = token;
      
      const workspaceName = await SecureStore.getItemAsync('notion_workspace_name');
      const workspaceIcon = await SecureStore.getItemAsync('notion_workspace_icon');
      
      return {
        accessToken: token,
        workspaceName: workspaceName || undefined,
        workspaceIcon: workspaceIcon || undefined,
      };
    } catch (error) {
      console.error('Error loading Notion credentials:', error);
      return null;
    }
  }

  async saveCredentials(credentials: NotionCredentials): Promise<void> {
    try {
      await SecureStore.setItemAsync('notion_access_token', credentials.accessToken);
      if (credentials.workspaceName) {
        await SecureStore.setItemAsync('notion_workspace_name', credentials.workspaceName);
      }
      if (credentials.workspaceIcon) {
        await SecureStore.setItemAsync('notion_workspace_icon', credentials.workspaceIcon);
      }
      this.accessToken = credentials.accessToken;
    } catch (error) {
      console.error('Error saving Notion credentials:', error);
    }
  }

  async clearCredentials(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync('notion_access_token');
      await SecureStore.deleteItemAsync('notion_workspace_name');
      await SecureStore.deleteItemAsync('notion_workspace_icon');
      this.accessToken = null;
    } catch (error) {
      console.error('Error clearing Notion credentials:', error);
    }
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Notion access token not available');
    }

    const url = `${NOTION_API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Notion API error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  // OAuth: Get user info to validate token
  async getUserInfo(): Promise<any> {
    return this.request('/users/me');
  }
}

export const notionService = new NotionService();
