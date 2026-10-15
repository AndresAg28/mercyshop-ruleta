export interface Participant { id: string; name: string }
export interface Spin {
  id: string; winnerId: string; winnerName: string;
  startedAt: number; durationMs: number; turns: number; offset: number;
}
export interface HistoryItem { id: string; name: string; revealAt: number }
export interface Room {
  id: string; title: string; participants: Participant[];
  spin: Spin | null; history: HistoryItem[]; updatedAt: number; serverNow: number;
}
export interface Session { id: string; token: string }
