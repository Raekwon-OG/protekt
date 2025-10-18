// filepath: apps/api/src/controllers/auth.controller.ts
/**
 * Auth controller: delegates to auth.service for signup/login and returns tokens.
 */
import { authService } from '../services/auth.service';

export const signup = async (body: { orgName: string; email: string; password: string }) => {
  const result = await authService.signup(body.orgName, body.email, body.password);
  return result;
};

export const login = async (body: { email: string; password: string }) => {
  const result = await authService.login(body.email, body.password);
  return result;
};
