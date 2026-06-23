import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodError } from 'zod';

type AnyZodObject = ZodObject<any>;
import { errorResponse } from '../utils/response';

export const validateBody = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return errorResponse(res, 'Validation Error', error.format(), 400);
      }
      return next(error);
    }
  };
};

export const validateQuery = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = (await schema.parseAsync(req.query)) as any;
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return errorResponse(res, 'Validation Error', error.format(), 400);
      }
      return next(error);
    }
  };
};

export const validateParams = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = (await schema.parseAsync(req.params)) as any;
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return errorResponse(res, 'Validation Error', error.format(), 400);
      }
      return next(error);
    }
  };
};
