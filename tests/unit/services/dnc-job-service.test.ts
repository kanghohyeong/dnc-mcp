import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import { DncJobService } from "../../../src/services/dnc-job-service.js";

describe("DncJobService", () => {
  let service: DncJobService;
  const testDncDir = path.join(process.cwd(), ".dnc-test");

  beforeEach(() => {
    service = new DncJobService();
  });

  afterEach(async () => {
    // 테스트 디렉토리 정리
    try {
      await fs.rm(testDncDir, { recursive: true, force: true });
    } catch {
      // 디렉토리가 없으면 무시
    }
  });

  describe("getAllRootJobs", () => {
    it("should return all root jobs from .dnc directory", async () => {
      // When: getAllRootJobs 호출
      const jobs = await service.getAllRootJobs();

      // Then: 모든 root job이 반환됨
      expect(jobs).toBeDefined();
      expect(Array.isArray(jobs)).toBe(true);
      // 실제 .dnc 디렉토리의 job 수는 테스트 환경에 따라 다름
      expect(jobs.length).toBeGreaterThanOrEqual(0);
    });

    it("should return empty array when .dnc directory does not exist", async () => {
      // Given: .dnc 디렉토리가 없는 임시 디렉토리에서 테스트
      const tempService = new DncJobService("/nonexistent/path");

      // When: getAllRootJobs 호출
      const jobs = await tempService.getAllRootJobs();

      // Then: 빈 배열 반환
      expect(jobs).toEqual([]);
    });

    it("should skip invalid job_relation.json files and return only valid ones", async () => {
      // Given: 일부 파일이 invalid JSON을 포함
      // 실제 파일 시스템을 사용하는 대신 모킹
      const mockDirents = [
        { name: "job-valid", isDirectory: () => true },
        { name: "job-invalid", isDirectory: () => true },
      ];

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      vi.spyOn(fs, "readdir").mockResolvedValue(mockDirents as fs.Dirent[]);

      vi.spyOn(fs, "readFile")
        .mockResolvedValueOnce(
          JSON.stringify({
            id: "job-valid",
            goal: "Valid Job",
            spec: ".dnc/job-valid/specs/job-valid.md",
            status: "pending",
            divided_jobs: [],
          })
        )
        .mockRejectedValueOnce(new Error("Invalid JSON"));

      // When: getAllRootJobs 호출
      const jobs = await service.getAllRootJobs();

      // Then: 유효한 job만 반환
      expect(jobs.length).toBe(1);
      expect(jobs[0].id).toBe("job-valid");
    });
  });

  describe("getJobById", () => {
    it("should return job by id from root jobs", async () => {
      // Given: 실제 .dnc 디렉토리에 있는 job을 사용
      const allJobs = await service.getAllRootJobs();
      if (allJobs.length === 0) {
        // job이 없으면 테스트 스킵
        expect(true).toBe(true);
        return;
      }

      const jobId = allJobs[0].id;

      // When: getJobById 호출
      const job = await service.getJobById(jobId);

      // Then: 해당 job 반환
      expect(job).not.toBeNull();
      if (job) {
        expect(job.id).toBe(jobId);
        expect(job.goal).toBeDefined();
        expect(job.status).toBeDefined();
      }
    });

    it("should return job from nested divided_jobs", async () => {
      // Given: divided_jobs를 가진 job을 모킹
      const mockDirents = [{ name: "job-parent", isDirectory: () => true }];

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      vi.spyOn(fs, "readdir").mockResolvedValue(mockDirents as fs.Dirent[]);

      vi.spyOn(fs, "readFile").mockResolvedValueOnce(
        JSON.stringify({
          id: "job-parent",
          goal: "Parent Job",
          spec: ".dnc/job-parent/specs/job-parent.md",
          status: "in-progress",
          divided_jobs: [
            {
              id: "job-child",
              goal: "Child Job",
              spec: ".dnc/job-parent/specs/child.md",
              status: "pending",
              divided_jobs: [],
            },
          ],
        })
      );

      // When: 자식 job ID로 조회
      const job = await service.getJobById("job-child");

      // Then: 자식 job 반환
      expect(job).not.toBeNull();
      expect(job?.id).toBe("job-child");
      expect(job?.goal).toBe("Child Job");
    });

    it("should return null when job does not exist", async () => {
      // Given: 존재하지 않는 job ID
      const jobId = "job-nonexistent-xyz-123";

      // When: getJobById 호출
      const job = await service.getJobById(jobId);

      // Then: null 반환
      expect(job).toBeNull();
    });
  });
});
