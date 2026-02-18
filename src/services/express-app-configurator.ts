import type { Express } from "express";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

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

    // JSON body 파싱 미들웨어
    app.use(express.json());

    // views와 public 경로 결정 (빌드 환경과 개발 환경 모두 지원)
    // 테스트 환경에서는 항상 src 디렉토리 사용
    const isTest = process.env.NODE_ENV === "test";

    const builtViewsPath = path.join(__dirname, "../views");
    const srcViewsPath = path.join(__dirname, "../../src/views");
    const viewsPath = isTest
      ? srcViewsPath
      : fs.existsSync(builtViewsPath)
        ? builtViewsPath
        : srcViewsPath;

    const builtPublicPath = path.join(__dirname, "../views/public");
    const srcPublicPath = path.join(__dirname, "../../src/views/public");
    const publicPath = isTest
      ? srcPublicPath
      : fs.existsSync(builtPublicPath)
        ? builtPublicPath
        : srcPublicPath;

    app.set("views", viewsPath);

    // 정적 파일 제공 설정
    app.use(express.static(publicPath));
  }
}
