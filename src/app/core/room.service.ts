import { computed, Injectable, OnDestroy, signal } from '@angular/core';
import { Room } from './models';

@Injectable({ providedIn: 'root' })
export class RoomService implements OnDestroy {
  readonly room = signal<Room | null>(null);
  readonly online = signal(true);
  private readonly skew = signal(0); // diferencia reloj servidor - reloj local
  private readonly now = signal(Date.now());
  private poll?: ReturnType<typeof setInterval>;
  private clock = setInterval(() => this.now.set(Date.now()), 500);

  readonly skewMs = this.skew.asReadonly();
  /** Historial: solo muestra ganadores cuando la animación ya terminó (nadie ve el resultado antes). */
  readonly visibleHistory = computed(() => {
    const t = this.now() + this.skew();
    return (this.room()?.history ?? []).filter(h => h.revealAt <= t);
  });

  async fetchRoom(id: string): Promise<Room | null> {
    const r = await fetch(`/api/room?id=${encodeURIComponent(id)}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('No se pudo cargar la sala');
    const room: Room = await r.json();
    this.accept(room);
    return room;
  }

  async post<T = Room>(body: object): Promise<T> {
    const r = await fetch('/api/room', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? 'Error inesperado');
    if ((data as Room).serverNow) this.accept(data as Room);
    return data;
  }

  watch(id: string, everyMs = 1200) {
    this.stop();
    const tick = async () => {
      try { await this.fetchRoom(id); this.online.set(true); } catch { this.online.set(false); }
    };
    tick();
    this.poll = setInterval(tick, everyMs);
  }

  stop() { clearInterval(this.poll); }

  private accept(room: Room) {
    this.skew.set(room.serverNow - Date.now());
    this.room.set(room);
  }

  ngOnDestroy() { this.stop(); clearInterval(this.clock); }
}
