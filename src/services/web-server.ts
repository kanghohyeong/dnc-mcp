import express, { type Express } from "express";
import type { Server } from "http";
import { openBrowser } from "../utils/browser-launcher.js";
import { ConnectionManager } from "./connection-manager.js";
import { ExpressAppConfigurator } from "./express-app-configurator.js";
import { PortFinder } from "./port-finder.js";
import { RouteRegistrar } from "./route-registrar.js";
import { DncJobService } from "./dnc-job-service.js";
import { DncJobDetailLoader } from "./dnc-job-detail-loader.js";

export interface UIWebServerOptions {
  autoOpenBrowser?: boolean;
  dncJobService?: DncJobService;
  dncJobDetailLoader?: DncJobDetailLoader;
}

/**
 * "UI Web Server" 웹 서버 (리팩토링 버전)
 *
 * 단일 책임 원칙을 따라 4개의 전문 클래스로 책임을 분리:
 * - ExpressAppConfigurator: 앱 설정 (view engine, static files)
 * - RouteRegistrar: 라우트 등록
 * - PortFinder: 사용 가능한 포트 검색 및 서버 시작
 * - ConnectionManager: SSE 및 HTTP 연결 관리
 */
export class UIWebServer {
  private app: Express;
  private server: Server | null = null;
  private port: number = 3331;
  private isRunning: boolean = false;
  private autoOpenBrowser: boolean;

  private connectionManager: ConnectionManager;
  private configurator: ExpressAppConfigurator;
  private routeRegistrar: RouteRegistrar;
  private portFinder: PortFinder;

  constructor(options?: UIWebServerOptions) {
    this.app = express();
    this.autoOpenBrowser = options?.autoOpenBrowser ?? process.env.NODE_ENV !== "test";

    // 컴포넌트 초기화
    this.connectionManager = new ConnectionManager();
    this.configurator = new ExpressAppConfigurator();
    this.routeRegistrar = new RouteRegistrar(options?.dncJobService, options?.dncJobDetailLoader);
    this.portFinder = new PortFinder(3331, 100);

    // Express 앱 설정
    this.configurator.configure(this.app);

    // 라우트 등록
    this.routeRegistrar.registerRoutes(this.app);
  }

  /**
   * 포트를 자동으로 찾아 웹 서버를 시작하고 브라우저를 엽니다.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.error("Web server is already running");
      return;
    }

    // 포트 검색 및 서버 시작
    const result = await this.portFinder.findAndStart(this.app, (socket) => {
      this.connectionManager.trackHttpSocket(socket);
    });

    this.server = result.server;
    this.port = result.port;
    this.isRunning = true;

    const url = `http://localhost:${this.port}`;
    console.error(`Web server started at ${url}`);

    // 브라우저 자동 열기
    if (this.autoOpenBrowser) {
      try {
        await openBrowser(url);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to open browser: ${errorMessage}`);
        console.error(`Please open ${url} manually in your browser`);
      }
    }
  }

  /**
   * 웹 서버를 안전하게 종료합니다.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.error("Web server is not running");
      return;
    }

    console.error("Closing SSE connections before stopping web server...");

    // SSE 연결 정리
    console.error(
      `Closing ${this.connectionManager.getSseConnectionCount()} active SSE connection(s)...`
    );
    await this.connectionManager.closeAllSseConnections();
    console.error("All SSE connections closed");

    // HTTP 연결 정리
    console.error(
      `Closing ${this.connectionManager.getHttpConnectionCount()} HTTP connection(s)...`
    );
    this.connectionManager.closeAllHttpSockets();

    // 서버 종료
    console.error("Stopping web server...");
    await new Promise<void>((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.error("Web server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });

    this.server = null;
    this.isRunning = false;
  }

  /**
   * 현재 서버 포트를 반환합니다.
   */
  getPort(): number {
    return this.port;
  }

  /**
   * 서버 실행 상태를 반환합니다.
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}
