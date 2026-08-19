import { Client, TablesDB, ID, Functions } from 'appwrite';

export const PROJECT_ID = '6a85396c001fea734c69';
export const DB_ID = 'learner_db';
export const FUNCTION_ID = 'ai-teacher';

export const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject(PROJECT_ID);

export const db = new TablesDB(client);
export const functions = new Functions(client);

export const TABLES = {
  rules: 'teaching_rules',
  profile: 'learner_profile',
  vocab: 'vocabulary',
  mistakes: 'mistakes',
  lessons: 'lessons',
  quizzes: 'quiz_attempts',
  convos: 'conversation_sessions',
  sessions: 'daily_sessions',
};

export { ID };
