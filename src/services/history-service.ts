import { EventEmitter } from "events";

export interface HistoryEntry {
  id: string;
  toolName: string;
  timestamp: number;
  timestampKst: string;
  request: unknown;
  response: unknown;
}

export class HistoryService extends EventEmitter {
  private static instance: HistoryService;
  private history: HistoryEntry[] = [];

  private constructor() {
    super();
  }

  static getInstance(): HistoryService {
    if (!HistoryService.instance) {
      HistoryService.instance = new HistoryService();
    }
    return HistoryService.instance;
  }

  addHistory(toolName: string, request: unknown, response: unknown): void {
    const timestamp = Date.now();
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      toolName,
      timestamp,
      timestampKst: this.formatKst(timestamp),
      request,
      response,
    };

    this.history.push(entry);
    console.error(`History added: [${toolName}] at ${entry.timestampKst}`);
    this.emit("historyAdded", entry);
  }

  getHistory(toolName?: string): HistoryEntry[] {
    const filtered = toolName
      ? this.history.filter((entry) => entry.toolName === toolName)
      : this.history;

    // 불변성 보장: 복사본 반환
    return filtered.map((entry) => ({ ...entry }));
  }

  clearHistory(): void {
    this.history = [];
  }

  private formatKst(timestamp: number): string {
    const date = new Date(timestamp);

    // UTC 시간에 9시간(KST) 추가
    const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);

    const year = kstDate.getUTCFullYear();
    const month = String(kstDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(kstDate.getUTCDate()).padStart(2, "0");
    const hours = String(kstDate.getUTCHours()).padStart(2, "0");
    const minutes = String(kstDate.getUTCMinutes()).padStart(2, "0");
    const seconds = String(kstDate.getUTCSeconds()).padStart(2, "0");

    return `${year}. ${month}. ${day}. ${hours}:${minutes}:${seconds}`;
  }
}
