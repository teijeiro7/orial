import * as SecureStore from 'expo-secure-store';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export interface NotionCredentials {
  accessToken: string;
  workspaceName?: string;
  workspaceIcon?: string;
}

export interface NotionDatabase {
  id: string;
  title: string;
  url: string;
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

  // Create "Orial — Habits" database
  async createHabitsDatabase(parentPageId: string): Promise<NotionDatabase> {
    const response = await this.request('/databases', {
      method: 'POST',
      body: JSON.stringify({
        parent: {
          type: 'page_id',
          page_id: parentPageId,
        },
        title: [
          {
            type: 'text',
            text: {
              content: 'Orial — Habits',
            },
          },
        ],
        properties: {
          Name: {
            title: {},
          },
          Emoji: {
            rich_text: {},
          },
          Category: {
            select: {
              options: [
                { name: 'Health', color: 'green' },
                { name: 'Mind', color: 'purple' },
                { name: 'Work', color: 'blue' },
                { name: 'Social', color: 'yellow' },
                { name: 'Fitness', color: 'red' },
                { name: 'Learning', color: 'cyan' },
                { name: 'Other', color: 'gray' },
              ],
            },
          },
          Frequency: {
            select: {
              options: [
                { name: 'Daily', color: 'blue' },
                { name: 'Weekly', color: 'green' },
                { name: 'Custom', color: 'yellow' },
              ],
            },
          },
          'Target Days': {
            multi_select: {
              options: [
                { name: 'Mon', color: 'blue' },
                { name: 'Tue', color: 'green' },
                { name: 'Wed', color: 'yellow' },
                { name: 'Thu', color: 'orange' },
                { name: 'Fri', color: 'red' },
                { name: 'Sat', color: 'purple' },
                { name: 'Sun', color: 'pink' },
              ],
            },
          },
          'Target Count': {
            number: {
              format: 'number',
            },
          },
          Active: {
            checkbox: {},
          },
          Created: {
            date: {},
          },
          'Orial ID': {
            rich_text: {},
          },
        },
      }),
    });

    return {
      id: response.id,
      title: 'Orial — Habits',
      url: response.url,
    };
  }

  // Create "Orial — Daily Logs" database
  async createLogsDatabase(parentPageId: string): Promise<NotionDatabase> {
    // First create the Habits DB to get its ID for relation
    const habitsDb = await this.createHabitsDatabase(parentPageId);

    const response = await this.request('/databases', {
      method: 'POST',
      body: JSON.stringify({
        parent: {
          type: 'page_id',
          page_id: parentPageId,
        },
        title: [
          {
            type: 'text',
            text: {
              content: 'Orial — Daily Logs',
            },
          },
        ],
        properties: {
          Date: {
            date: {},
          },
          Habit: {
            relation: {
              database_id: habitsDb.id,
              single_property: {},
            },
          },
          Completed: {
            checkbox: {},
          },
          Note: {
            rich_text: {},
          },
          'Orial Entry ID': {
            rich_text: {},
          },
        },
      }),
    });

    return {
      id: response.id,
      title: 'Orial — Daily Logs',
      url: response.url,
    };
  }

  // Query habits database
  async queryHabitsDatabase(databaseId: string): Promise<any[]> {
    const response = await this.request(`/databases/${databaseId}/query`, {
      method: 'POST',
    });
    return response.results || [];
  }

  // Create a habit page
  async createHabitPage(databaseId: string, habit: {
    name: string;
    emoji: string;
    category: string;
    frequency: string;
    targetDays: string;
    targetCount: number;
    active: boolean;
    created: string;
    orialId: string;
  }): Promise<any> {
    return this.request('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: {
          database_id: databaseId,
        },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: habit.name,
                },
              },
            ],
          },
          Emoji: {
            rich_text: [
              {
                text: {
                  content: habit.emoji,
                },
              },
            ],
          },
          Category: {
            select: {
              name: habit.category.charAt(0).toUpperCase() + habit.category.slice(1),
            },
          },
          Frequency: {
            select: {
              name: habit.frequency.charAt(0).toUpperCase() + habit.frequency.slice(1),
            },
          },
          'Target Days': {
            multi_select: habit.targetDays.split(',').map((day: string) => ({
              name: day.trim(),
            })),
          },
          'Target Count': {
            number: habit.targetCount,
          },
          Active: {
            checkbox: habit.active,
          },
          Created: {
            date: {
              start: habit.created,
            },
          },
          'Orial ID': {
            rich_text: [
              {
                text: {
                  content: habit.orialId,
                },
              },
            ],
          },
        },
      }),
    });
  }

  // Update a habit page
  async updateHabitPage(pageId: string, habit: Partial<{
    name: string;
    emoji: string;
    category: string;
    frequency: string;
    targetDays: string;
    targetCount: number;
    active: boolean;
  }>): Promise<any> {
    const properties: any = {};

    if (habit.name) {
      properties.Name = {
        title: [
          {
            text: {
              content: habit.name,
            },
          },
        ],
      };
    }

    if (habit.emoji) {
      properties.Emoji = {
        rich_text: [
          {
            text: {
              content: habit.emoji,
            },
          },
        ],
      };
    }

    if (habit.category) {
      properties.Category = {
        select: {
          name: habit.category.charAt(0).toUpperCase() + habit.category.slice(1),
        },
      };
    }

    if (habit.frequency) {
      properties.Frequency = {
        select: {
          name: habit.frequency.charAt(0).toUpperCase() + habit.frequency.slice(1),
        },
      };
    }

    if (habit.active !== undefined) {
      properties.Active = {
        checkbox: habit.active,
      };
    }

    return this.request(`/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
  }

  // Create a log entry
  async createLogEntry(databaseId: string, entry: {
    date: string;
    habitId: string;
    completed: boolean;
    note?: string;
    orialEntryId: string;
  }): Promise<any> {
    return this.request('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: {
          database_id: databaseId,
        },
        properties: {
          Date: {
            date: {
              start: entry.date,
            },
          },
          Habit: {
            relation: [
              {
                id: entry.habitId,
              },
            ],
          },
          Completed: {
            checkbox: entry.completed,
          },
          ...(entry.note && {
            Note: {
              rich_text: [
                {
                  text: {
                    content: entry.note,
                  },
                },
              ],
            },
          }),
          'Orial Entry ID': {
            rich_text: [
              {
                text: {
                  content: entry.orialEntryId,
                },
              },
            ],
          },
        },
      }),
    });
  }
}

export const notionService = new NotionService();
