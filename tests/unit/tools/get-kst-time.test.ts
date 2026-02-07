import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerGetKstTimeTool } from '../../../src/tools/get-kst-time.js';
import { createTestMcpServer, mockKstTime } from '../../helpers/test-utils.js';

describe('get-kst-time tool', () => {
  beforeEach(() => {
    // 고정된 시간으로 모킹: 2026-02-07T03:00:00Z (UTC) = 2026-02-07 12:00:00 (KST)
    mockKstTime('2026-02-07T03:00:00Z');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should register tool with correct name', () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, 'registerTool');

    registerGetKstTimeTool(mcpServer);

    expect(registerToolSpy).toHaveBeenCalledWith(
      'get_kst_time',
      expect.objectContaining({
        description: expect.stringContaining('한국 표준시'),
        inputSchema: {},
      }),
      expect.any(Function),
    );
  });

  it('should return KST time in correct format', () => {
    const mcpServer = createTestMcpServer();

    // 등록된 핸들러 가져오기
    const registerToolSpy = vi.spyOn(mcpServer, 'registerTool');
    registerGetKstTimeTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2];

    const result = handler({});

    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('한국 표준시'),
    });
  });

  it('should include all required time formats', () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, 'registerTool');
    registerGetKstTimeTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2];

    const result = handler({});
    const text = result.content[0].text;

    // KST 시간 포함
    expect(text).toMatch(/현재 한국 표준시/);

    // ISO 형식 포함
    expect(text).toMatch(/ISO 8601 형식:/);
    expect(text).toMatch(/2026-02-07/);

    // Unix timestamp 포함
    expect(text).toMatch(/Unix Timestamp:/);
    expect(text).toMatch(/1770433200000/);

    // UTC 시간 포함
    expect(text).toMatch(/UTC Time:/);
    expect(text).toMatch(/2026-02-07T03:00:00\.000Z/);
  });

  it('should handle Date object errors gracefully', () => {
    // Date 생성자를 모킹하여 Invalid Date 반환
    const OriginalDate = Date;
    // @ts-expect-error - Date 모킹
    global.Date = class extends OriginalDate {
      constructor(...args: unknown[]) {
        super(...args);
        if (args.length === 0) {
          // @ts-expect-error - Invalid Date 생성
          return new OriginalDate('invalid');
        }
      }
    };

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, 'registerTool');
    registerGetKstTimeTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2];

    const result = handler({});

    expect(result).toHaveProperty('isError', true);
    expect(result.content[0].text).toMatch(/오류가 발생했습니다/);

    // 원래 Date 복원
    global.Date = OriginalDate;
  });
});
