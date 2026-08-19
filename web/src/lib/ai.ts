import { functions, FUNCTION_ID } from './appwrite';
import { ExecutionMethod, ExecutionStatus } from 'appwrite';

export async function ask<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await functions.createExecution(
    FUNCTION_ID,
    JSON.stringify({ action, ...payload }),
    false,
    '/',
    ExecutionMethod.POST
  );
  if (res.status === ExecutionStatus.Failed) {
    throw new Error(res.errors || 'AI function failed to run');
  }
  let body: any = null;
  try {
    body = JSON.parse(res.responseBody || '{}');
  } catch {
    throw new Error('AI returned an unreadable response');
  }
  if (!body || body.ok === false) {
    throw new Error(body?.error || 'AI request failed');
  }
  return body as T;
}
