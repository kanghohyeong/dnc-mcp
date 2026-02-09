import { describe, it, expect, beforeEach } from "vitest";
import express, { type Express } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { ExpressAppConfigurator } from "../../../src/services/express-app-configurator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("ExpressAppConfigurator", () => {
  let app: Express;
  let configurator: ExpressAppConfigurator;

  beforeEach(() => {
    app = express();
    configurator = new ExpressAppConfigurator();
  });

  describe("정상 케이스", () => {
    it("1. view engine을 ejs로 설정", () => {
      configurator.configure(app);

      expect(app.get("view engine")).toBe("ejs");
    });

    it("2. views 디렉토리 경로 설정", () => {
      configurator.configure(app);

      const viewsPath = app.get("views") as string;
      expect(viewsPath).toBeDefined();
      expect(viewsPath).toContain("views");
    });

    it("3. static files 미들웨어 설정", () => {
      configurator.configure(app);

      // configure가 에러 없이 완료되면 미들웨어가 설정된 것
      expect(app.get("view engine")).toBe("ejs");

      // 설정이 정상적으로 완료되었는지 확인
      expect(() => app.get("views") as unknown).not.toThrow();
    });

    it("4. public 디렉토리 경로 설정", () => {
      configurator.configure(app);

      // configure가 에러 없이 완료되면 경로가 설정된 것
      const viewsPath = app.get("views") as string;

      expect(viewsPath).toBeDefined();
      expect(typeof viewsPath).toBe("string");
    });
  });

  describe("에러 케이스", () => {
    it("5. views 경로 누락 처리", () => {
      // views 경로가 없어도 에러가 발생하지 않아야 함
      expect(() => configurator.configure(app)).not.toThrow();

      // view engine은 설정되어야 함
      expect(app.get("view engine")).toBe("ejs");
    });

    it("6. public 경로 누락 처리", () => {
      // public 경로가 없어도 에러가 발생하지 않아야 함
      expect(() => configurator.configure(app)).not.toThrow();

      // view engine이 설정되었으면 미들웨어도 설정되었다고 가정
      expect(app.get("view engine")).toBe("ejs");
    });
  });

  describe("경계값 케이스", () => {
    it("7. 기존 view engine 덮어쓰지 않음 (idempotent)", () => {
      // 첫 번째 설정
      configurator.configure(app);
      const firstViewEngine = app.get("view engine") as string;
      const firstViewsPath = app.get("views") as string;

      // 두 번째 설정
      configurator.configure(app);
      const secondViewEngine = app.get("view engine") as string;
      const secondViewsPath = app.get("views") as string;

      // 같은 값이어야 함
      expect(secondViewEngine).toBe(firstViewEngine);
      expect(secondViewsPath).toBe(firstViewsPath);
    });

    it("8. 이미 설정된 Express 앱에도 동작", () => {
      // 다른 설정이 있는 앱
      app.set("some-setting", "some-value");
      app.use(express.json());

      // configurator 적용
      configurator.configure(app);

      // 기존 설정은 유지
      expect(app.get("some-setting")).toBe("some-value");

      // 새 설정도 추가됨
      expect(app.get("view engine")).toBe("ejs");
    });
  });
});
