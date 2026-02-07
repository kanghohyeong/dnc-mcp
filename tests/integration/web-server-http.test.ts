import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { HelloWorldWebServer } from '../../src/services/web-server.js';
import express from 'express';

describe('웹 서버 HTTP 엔드포인트', () => {
  let server: HelloWorldWebServer;
  let app: express.Express;

  beforeAll(async () => {
    server = new HelloWorldWebServer();
    await server.start();

    // Express 앱 인스턴스 가져오기
    app = (server as never)['app'] as express.Express;
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('GET /', () => {
    it('should return HTML with "hello world"', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/html');
      expect(response.text).toContain('hello world');
      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('Interlock MCP Server');
    });

    it('should have correct HTML structure', async () => {
      const response = await request(app).get('/');

      expect(response.text).toMatch(/<html lang="ko">/);
      expect(response.text).toMatch(/<meta charset="UTF-8">/);
      expect(response.text).toMatch(/<h1>hello world<\/h1>/);
    });

    it('should include CSS animations', async () => {
      const response = await request(app).get('/');

      expect(response.text).toContain('animation: fadeIn');
      expect(response.text).toContain('@keyframes fadeIn');
    });
  });

  describe('GET /health', () => {
    it('should return health status as JSON', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        status: 'ok',
        message: 'MCP server is running',
      });
    });
  });

  describe('404 처리', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/non-existent');

      expect(response.status).toBe(404);
    });
  });
});
