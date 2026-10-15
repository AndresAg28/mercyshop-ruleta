import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RoomService } from '../../core/room.service';
import { Participant } from '../../core/models';
import { WheelComponent } from '../../shared/wheel/wheel.component';
import { WinnerDialogComponent } from '../../shared/winner-dialog.component';

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [WheelComponent, WinnerDialogComponent],
  template: `
    @if (rooms.room(); as room) {
      <div class="mb-4 flex items-center justify-between gap-3">
        <h1 class="font-display text-3xl font-bold text-mercy-600">{{ room.title }}</h1>
        <span class="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-mercy-700 ring-1 ring-mercy-200">
          <span class="h-2 w-2 rounded-full" [class]="rooms.online() ? 'bg-mercy-leaf' : 'bg-mercy-cherry'"></span>
          {{ rooms.online() ? 'En vivo' : 'Reconectando…' }}
        </span>
      </div>

      <div class="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section class="card">
          <app-wheel [participants]="room.participants" [spin]="room.spin" [clockSkew]="rooms.skewMs()"
                     (finished)="winner.set($event)" />
          <p class="mt-3 text-center text-sm text-mercy-700">
            Estás viendo la ruleta en vivo. El resultado lo define el sistema al azar, no la moderadora.
          </p>
        </section>

        <aside class="space-y-6">
          <section class="card">
            <h2 class="font-display text-xl font-bold">Participantes ({{ room.participants.length }})</h2>
            <ul class="mt-3 max-h-64 space-y-1 overflow-auto text-sm">
              @for (p of room.participants; track p.id) { <li class="rounded-lg bg-mercy-50 px-3 py-1.5">{{ p.name }}</li> }
              @empty { <li class="text-mercy-700">Aún no hay participantes.</li> }
            </ul>
          </section>
          <section class="card">
            <h2 class="font-display text-xl font-bold">Ganadores</h2>
            <ol class="mt-3 space-y-1 text-sm">
              @for (h of rooms.visibleHistory(); track h.id) { <li class="rounded-lg bg-mercy-100 px-3 py-1.5 font-medium">🍒 {{ h.name }}</li> }
              @empty { <li class="text-mercy-700">Todavía no hay giros.</li> }
            </ol>
          </section>
        </aside>
      </div>
    } @else if (notFound()) {
      <p class="card mx-auto max-w-md text-center">Esta ruleta ya no existe o el enlace es incorrecto.</p>
    } @else {
      <p class="py-20 text-center text-mercy-700">Cargando ruleta…</p>
    }

    @if (winner(); as w) { <app-winner-dialog [winner]="w" (closed)="winner.set(null)" /> }
  `
})
export class ViewerComponent implements OnInit, OnDestroy {
  protected rooms = inject(RoomService);
  private route = inject(ActivatedRoute);
  protected winner = signal<Participant | null>(null);
  protected notFound = signal(false);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.rooms.room.set(null);
    if (!(await this.rooms.fetchRoom(id).catch(() => null))) { this.notFound.set(true); return; }
    this.rooms.watch(id);
  }
  ngOnDestroy() { this.rooms.stop(); }
}
