import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ApiError } from './api-error.js';

export function errorHandler(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof ApiError) {
    return reply.status(error.statusCode).send({
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      code: 'VALIDATION_ERROR',
      message: 'Les donnees envoyees sont invalides.',
      details: error.flatten(),
    });
  }

  return reply.status(500).send({
    code: 'INTERNAL_ERROR',
    message: 'Une erreur technique est survenue.',
  });
}
