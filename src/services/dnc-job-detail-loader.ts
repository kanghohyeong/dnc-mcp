import fs from "fs/promises";
import path from "path";
import type { DncJob, DncJobWithDetails } from "./dnc-job-service.js";

export type { DncJobWithDetails } from "./dnc-job-service.js";

export class DncJobDetailLoader {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * DncJob을 DncJobWithDetails로 변환합니다.
   * spec 파일을 읽어 specContent를 추가하고, divided_jobs도 재귀적으로 변환합니다.
   */
  async loadJobWithDetails(job: DncJob): Promise<DncJobWithDetails> {
    // spec 경로가 절대 경로인지 확인
    if (path.isAbsolute(job.spec)) {
      throw new Error(`Spec path must be relative: ${job.spec}`);
    }

    // spec 파일 읽기
    const specPath = path.join(this.projectRoot, job.spec);
    const specContent = await fs.readFile(specPath, "utf-8");

    // divided_jobs를 재귀적으로 변환
    const dividedJobsWithDetails = await Promise.all(
      job.divided_jobs.map((childJob) => this.loadJobWithDetails(childJob))
    );

    return {
      job_title: job.job_title,
      goal: job.goal,
      spec: job.spec,
      status: job.status,
      specContent,
      divided_jobs: dividedJobsWithDetails,
    };
  }

  /**
   * jobId로 job을 찾아 DncJobWithDetails로 반환합니다.
   * .dnc 디렉토리의 모든 root job을 탐색합니다.
   */
  async loadJobByTitleWithDetails(jobTitle: string): Promise<DncJobWithDetails | null> {
    const dncDir = path.join(this.projectRoot, ".dnc");

    try {
      const entries = await fs.readdir(dncDir, { withFileTypes: true });

      // 먼저 job을 찾기만 함
      let foundJob: DncJob | null = null;

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const jobRelationPath = path.join(dncDir, entry.name, "job_relation.json");

          try {
            const content = await fs.readFile(jobRelationPath, "utf-8");
            const rootJob = JSON.parse(content) as DncJob;

            // root job에서 찾기
            if (rootJob.job_title === jobTitle) {
              foundJob = rootJob;
              break;
            }

            // 하위 작업에서 재귀적으로 찾기
            const found = this.findJobInTree(rootJob, jobTitle);
            if (found) {
              foundJob = found;
              break;
            }
          } catch {
            // 파일이 없거나 invalid JSON이면 스킵
            continue;
          }
        }
      }

      // job을 찾았으면 details 로드 (에러는 그대로 전파)
      if (foundJob) {
        return await this.loadJobWithDetails(foundJob);
      }

      return null;
    } catch (error) {
      // .dnc 디렉토리가 없는 경우만 null 반환
      const errnoException = error as NodeJS.ErrnoException;
      if (errnoException.code === "ENOENT") {
        return null;
      }
      // 그 외의 에러는 전파
      throw error;
    }
  }

  /**
   * job 트리에서 특정 ID의 job을 재귀적으로 찾습니다.
   */
  private findJobInTree(job: DncJob, targetTitle: string): DncJob | null {
    if (job.job_title === targetTitle) {
      return job;
    }

    for (const childJob of job.divided_jobs) {
      const found = this.findJobInTree(childJob, targetTitle);
      if (found) {
        return found;
      }
    }

    return null;
  }
}
