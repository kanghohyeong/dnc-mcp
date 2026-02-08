import type { Express } from "express";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Express 앱의 기본 설정을 담당하는 클래스
 */
export class ExpressAppConfigurator {
  /**
   * Express 앱에 view engine 및 static files 설정 적용
   */
  configure(app: Express): void {
    // EJS view engine 설정
    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "../../views"));

    // 정적 파일 제공 설정
    app.use(express.static(path.join(__dirname, "../../public")));
  }
}
