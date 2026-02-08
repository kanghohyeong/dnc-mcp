import fs from "fs/promises";
import path from "path";

export interface DncJob {
  id: string;
  goal: string;
  spec: string;
  status: "pending" | "in-progress" | "done";
  divided_jobs: DncJob[];
}

export interface DncJobWithDetails extends Omit<DncJob, "divided_jobs"> {
  specContent: string;
  divided_jobs: DncJobWithDetails[];
}

export class DncJobService {
  private dncDir: string;

  constructor(dncDir?: string) {
    this.dncDir = dncDir || path.join(process.cwd(), ".dnc");
  }

  /**
   * .dnc 디렉토리에서 모든 root job을 읽어옵니다.
   */
  async getAllRootJobs(): Promise<DncJob[]> {
    try {
      // .dnc 디렉토리 확인
      const entries = await fs.readdir(this.dncDir, { withFileTypes: true });

      const jobs: DncJob[] = [];

      // 각 디렉토리에서 job_relation.json 읽기
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const jobRelationPath = path.join(this.dncDir, entry.name, "job_relation.json");

          try {
            const content = await fs.readFile(jobRelationPath, "utf-8");
            const job = JSON.parse(content) as DncJob;
            jobs.push(job);
          } catch {
            // 파일이 없거나 invalid JSON이면 스킵
            continue;
          }
        }
      }

      return jobs;
    } catch {
      // .dnc 디렉토리가 없으면 빈 배열 반환
      return [];
    }
  }

  /**
   * 특정 ID의 job을 찾아 반환합니다.
   */
  async getJobById(jobId: string): Promise<DncJob | null> {
    const allJobs = await this.getAllRootJobs();

    // root job에서 찾기
    for (const job of allJobs) {
      if (job.id === jobId) {
        return job;
      }

      // 하위 작업에서 재귀적으로 찾기
      const found = this.findJobInTree(job, jobId);
      if (found) {
        return found;
      }
    }

    return null;
  }

  /**
   * job 트리에서 특정 ID의 job을 재귀적으로 찾습니다.
   */
  private findJobInTree(job: DncJob, targetId: string): DncJob | null {
    if (job.id === targetId) {
      return job;
    }

    for (const childJob of job.divided_jobs) {
      const found = this.findJobInTree(childJob, targetId);
      if (found) {
        return found;
      }
    }

    return null;
  }
}
