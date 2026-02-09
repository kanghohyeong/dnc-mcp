import * as fs from "fs/promises";

export type JobStatus = "pending" | "in-progress" | "done";

export interface JobRelation {
  id: string;
  goal: string;
  spec: string;
  status: JobStatus;
  divided_jobs: JobRelation[];
}

/**
 * goal을 기반으로 job ID를 생성합니다.
 * @param goal - 작업 목표
 * @returns job-{slug} 형식의 ID
 */
export function generateJobId(goal: string): string {
  if (!goal || goal.trim() === "") {
    return "job-untitled";
  }

  // 영문이 아닌 경우 transliteration 대신 단순히 제거
  const slug = goal
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // 특수문자 제거
    .trim()
    .replace(/\s+/g, "-") // 공백을 하이픈으로
    .replace(/-+/g, "-") // 연속된 하이픈 정리
    .substring(0, 80); // 최대 길이 제한

  const finalSlug = slug || "untitled";
  return `job-${finalSlug}`;
}

/**
 * job 상태값이 유효한지 검증합니다.
 * @param status - 검증할 상태값
 * @returns 유효하면 true
 */
export function validateJobStatus(status: string): status is JobStatus {
  return status === "pending" || status === "in-progress" || status === "done";
}

/**
 * job relation 파일 경로를 반환합니다.
 * @param jobId - job ID
 * @returns .dnc/{jobId}/job_relation.json 경로
 */
export function getJobPath(jobId: string): string {
  return `.dnc/${jobId}/job_relation.json`;
}

/**
 * spec 파일 경로를 반환합니다.
 * @param rootJobId - root job ID
 * @param jobId - job ID
 * @returns .dnc/{rootJobId}/specs/{jobId}.md 경로
 */
export function getSpecPath(rootJobId: string, jobId: string): string {
  return `.dnc/${rootJobId}/specs/${jobId}.md`;
}

/**
 * .dnc 디렉토리 구조를 생성합니다.
 * @param jobId - job ID
 */
export async function ensureDncDirectory(jobId: string): Promise<void> {
  await fs.mkdir(".dnc", { recursive: true });
  await fs.mkdir(`.dnc/${jobId}`, { recursive: true });
  await fs.mkdir(`.dnc/${jobId}/specs`, { recursive: true });
}

/**
 * job relation을 파일에 씁니다.
 * @param jobId - job ID
 * @param jobRelation - job relation 데이터
 */
export async function writeJobRelation(jobId: string, jobRelation: JobRelation): Promise<void> {
  const jobPath = getJobPath(jobId);
  await fs.writeFile(jobPath, JSON.stringify(jobRelation, null, 2), "utf-8");
}

/**
 * job relation을 파일에서 읽습니다.
 * @param jobId - job ID
 * @returns job relation 데이터
 */
export async function readJobRelation(jobId: string): Promise<JobRelation> {
  const jobPath = getJobPath(jobId);
  const content = await fs.readFile(jobPath, "utf-8");
  return JSON.parse(content) as JobRelation;
}

/**
 * spec 마크다운 파일을 생성합니다.
 * @param rootJobId - root job ID
 * @param jobId - job ID
 * @param goal - 목표
 * @param requirements - 요구사항 (선택)
 * @param constraints - 제약조건 (선택)
 * @param acceptanceCriteria - 완료 기준 (선택)
 */
export async function writeSpecFile(
  rootJobId: string,
  jobId: string,
  goal: string,
  requirements?: string,
  constraints?: string,
  acceptanceCriteria?: string
): Promise<void> {
  const specPath = getSpecPath(rootJobId, jobId);

  const content = `# ${goal}

## 목표

${goal}

## 요구사항

${requirements || "없음"}

## 제약조건

${constraints || "없음"}

## 완료 기준

${acceptanceCriteria || "없음"}
`;

  await fs.writeFile(specPath, content, "utf-8");
}

/**
 * job이 존재하는지 확인합니다.
 * @param jobId - job ID
 * @returns 존재하면 true
 */
export async function jobExists(jobId: string): Promise<boolean> {
  try {
    await fs.access(getJobPath(jobId));
    return true;
  } catch {
    return false;
  }
}

/**
 * job을 재귀적으로 찾습니다.
 * @param jobRelation - 탐색할 job relation
 * @param targetJobId - 찾을 job ID
 * @returns 찾은 job relation 또는 null
 */
export function findJobInTree(jobRelation: JobRelation, targetJobId: string): JobRelation | null {
  if (jobRelation.id === targetJobId) {
    return jobRelation;
  }

  for (const child of jobRelation.divided_jobs) {
    const found = findJobInTree(child, targetJobId);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * job을 재귀적으로 업데이트합니다.
 * @param jobRelation - 탐색할 job relation
 * @param targetJobId - 업데이트할 job ID
 * @param updates - 업데이트할 필드
 * @returns 업데이트 성공 여부
 */
export function updateJobInTree(
  jobRelation: JobRelation,
  targetJobId: string,
  updates: { goal?: string; status?: JobStatus }
): boolean {
  if (jobRelation.id === targetJobId) {
    if (updates.goal !== undefined) {
      jobRelation.goal = updates.goal;
    }
    if (updates.status !== undefined) {
      jobRelation.status = updates.status;
    }
    return true;
  }

  for (const child of jobRelation.divided_jobs) {
    if (updateJobInTree(child, targetJobId, updates)) {
      return true;
    }
  }

  return false;
}

/**
 * job을 재귀적으로 삭제합니다.
 * @param jobRelation - 탐색할 job relation
 * @param targetJobId - 삭제할 job ID
 * @returns 업데이트된 job relation
 */
export function deleteJobInTree(jobRelation: JobRelation, targetJobId: string): JobRelation {
  jobRelation.divided_jobs = jobRelation.divided_jobs.filter((child) => child.id !== targetJobId);

  for (const child of jobRelation.divided_jobs) {
    deleteJobInTree(child, targetJobId);
  }

  return jobRelation;
}

/**
 * spec 파일을 삭제합니다.
 * @param rootJobId - root job ID
 * @param jobId - job ID
 */
export async function deleteSpecFile(rootJobId: string, jobId: string): Promise<void> {
  const specPath = getSpecPath(rootJobId, jobId);
  try {
    await fs.unlink(specPath);
  } catch {
    // 파일이 없어도 무시
  }
}

/**
 * job의 모든 spec 파일을 재귀적으로 삭제합니다.
 * @param rootJobId - root job ID
 * @param jobRelation - 삭제할 job relation
 */
export async function deleteAllSpecFiles(
  rootJobId: string,
  jobRelation: JobRelation
): Promise<void> {
  await deleteSpecFile(rootJobId, jobRelation.id);

  for (const child of jobRelation.divided_jobs) {
    await deleteAllSpecFiles(rootJobId, child);
  }
}
