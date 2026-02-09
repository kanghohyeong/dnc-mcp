import * as fs from "fs/promises";

export type JobStatus = "pending" | "in-progress" | "done";

export interface JobRelation {
  job_title: string;
  goal: string;
  spec: string;
  status: JobStatus;
  divided_jobs: JobRelation[];
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
 * job_title 형식을 검증합니다.
 * - 영문만 허용 (a-z, 0-9, 하이픈)
 * - 하이픈 기준 10단어 이하
 * - kebab-case 형식
 * - 1-100자
 * @param jobTitle - 검증할 job title
 * @returns 검증 결과 및 에러 메시지
 */
export function validateJobTitle(jobTitle: string): {
  isValid: boolean;
  error?: string;
} {
  // 1. Empty check
  if (!jobTitle || jobTitle.trim() === "") {
    return { isValid: false, error: "job_title cannot be empty" };
  }

  // 2. Character validation (only a-z, 0-9, hyphens)
  if (!/^[a-z0-9-]+$/.test(jobTitle)) {
    return {
      isValid: false,
      error: "job_title must contain only lowercase letters, numbers, and hyphens",
    };
  }

  // 3. Length validation
  if (jobTitle.length < 1 || jobTitle.length > 100) {
    return {
      isValid: false,
      error: "job_title must be between 1 and 100 characters",
    };
  }

  // 4. Word count validation (split by hyphens)
  const words = jobTitle.split("-").filter((w) => w.length > 0);
  if (words.length > 10) {
    return {
      isValid: false,
      error: "job_title must not exceed 10 words (English only)",
    };
  }

  // 5. Check for double hyphens or leading/trailing hyphens
  if (jobTitle.startsWith("-") || jobTitle.endsWith("-") || jobTitle.includes("--")) {
    return {
      isValid: false,
      error: "job_title cannot start/end with hyphen or contain consecutive hyphens",
    };
  }

  return { isValid: true };
}

/**
 * job relation 파일 경로를 반환합니다.
 * @param jobTitle - job title
 * @returns .dnc/{jobTitle}/job_relation.json 경로
 */
export function getJobPath(jobTitle: string): string {
  return `.dnc/${jobTitle}/job_relation.json`;
}

/**
 * spec 파일 경로를 반환합니다.
 * @param rootJobTitle - root job title
 * @param jobTitle - job title
 * @returns .dnc/{rootJobTitle}/specs/{jobTitle}.md 경로
 */
export function getSpecPath(rootJobTitle: string, jobTitle: string): string {
  return `.dnc/${rootJobTitle}/specs/${jobTitle}.md`;
}

/**
 * .dnc 디렉토리 구조를 생성합니다.
 * @param jobTitle - job title
 */
export async function ensureDncDirectory(jobTitle: string): Promise<void> {
  await fs.mkdir(".dnc", { recursive: true });
  await fs.mkdir(`.dnc/${jobTitle}`, { recursive: true });
  await fs.mkdir(`.dnc/${jobTitle}/specs`, { recursive: true });
}

/**
 * job relation을 파일에 씁니다.
 * @param jobTitle - job title
 * @param jobRelation - job relation 데이터
 */
export async function writeJobRelation(jobTitle: string, jobRelation: JobRelation): Promise<void> {
  const jobPath = getJobPath(jobTitle);
  await fs.writeFile(jobPath, JSON.stringify(jobRelation, null, 2), "utf-8");
}

/**
 * job relation을 파일에서 읽습니다.
 * @param jobTitle - job title
 * @returns job relation 데이터
 */
export async function readJobRelation(jobTitle: string): Promise<JobRelation> {
  const jobPath = getJobPath(jobTitle);
  const content = await fs.readFile(jobPath, "utf-8");
  return JSON.parse(content) as JobRelation;
}

/**
 * spec 마크다운 파일을 생성합니다.
 * @param rootJobTitle - root job title
 * @param jobTitle - job title
 * @param goal - 목표
 * @param requirements - 요구사항 (선택)
 * @param constraints - 제약조건 (선택)
 * @param acceptanceCriteria - 완료 기준 (선택)
 */
export async function writeSpecFile(
  rootJobTitle: string,
  jobTitle: string,
  goal: string,
  requirements?: string,
  constraints?: string,
  acceptanceCriteria?: string
): Promise<void> {
  const specPath = getSpecPath(rootJobTitle, jobTitle);

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
 * @param jobTitle - job title
 * @returns 존재하면 true
 */
export async function jobExists(jobTitle: string): Promise<boolean> {
  try {
    await fs.access(getJobPath(jobTitle));
    return true;
  } catch {
    return false;
  }
}

/**
 * job을 재귀적으로 찾습니다.
 * @param jobRelation - 탐색할 job relation
 * @param targetJobTitle - 찾을 job title
 * @returns 찾은 job relation 또는 null
 */
export function findJobInTree(
  jobRelation: JobRelation,
  targetJobTitle: string
): JobRelation | null {
  if (jobRelation.job_title === targetJobTitle) {
    return jobRelation;
  }

  for (const child of jobRelation.divided_jobs) {
    const found = findJobInTree(child, targetJobTitle);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * job을 재귀적으로 업데이트합니다.
 * @param jobRelation - 탐색할 job relation
 * @param targetJobTitle - 업데이트할 job title
 * @param updates - 업데이트할 필드
 * @returns 업데이트 성공 여부
 */
export function updateJobInTree(
  jobRelation: JobRelation,
  targetJobTitle: string,
  updates: { goal?: string; status?: JobStatus }
): boolean {
  if (jobRelation.job_title === targetJobTitle) {
    if (updates.goal !== undefined) {
      jobRelation.goal = updates.goal;
    }
    if (updates.status !== undefined) {
      jobRelation.status = updates.status;
    }
    return true;
  }

  for (const child of jobRelation.divided_jobs) {
    if (updateJobInTree(child, targetJobTitle, updates)) {
      return true;
    }
  }

  return false;
}

/**
 * job을 재귀적으로 삭제합니다.
 * @param jobRelation - 탐색할 job relation
 * @param targetJobTitle - 삭제할 job title
 * @returns 업데이트된 job relation
 */
export function deleteJobInTree(jobRelation: JobRelation, targetJobTitle: string): JobRelation {
  jobRelation.divided_jobs = jobRelation.divided_jobs.filter(
    (child) => child.job_title !== targetJobTitle
  );

  for (const child of jobRelation.divided_jobs) {
    deleteJobInTree(child, targetJobTitle);
  }

  return jobRelation;
}

/**
 * spec 파일을 삭제합니다.
 * @param rootJobTitle - root job title
 * @param jobTitle - job title
 */
export async function deleteSpecFile(rootJobTitle: string, jobTitle: string): Promise<void> {
  const specPath = getSpecPath(rootJobTitle, jobTitle);
  try {
    await fs.unlink(specPath);
  } catch {
    // 파일이 없어도 무시
  }
}

/**
 * job의 모든 spec 파일을 재귀적으로 삭제합니다.
 * @param rootJobTitle - root job title
 * @param jobRelation - 삭제할 job relation
 */
export async function deleteAllSpecFiles(
  rootJobTitle: string,
  jobRelation: JobRelation
): Promise<void> {
  await deleteSpecFile(rootJobTitle, jobRelation.job_title);

  for (const child of jobRelation.divided_jobs) {
    await deleteAllSpecFiles(rootJobTitle, child);
  }
}
