import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import QRCode from 'qrcode';
import { RoomService } from '../../core/room.service';
import { StorageService } from '../../core/storage.service';
import { Participant, Session } from '../../core/models';
import { WheelComponent } from '../../shared/wheel/wheel.component';
import { WinnerDialogComponent } from '../../shared/winner-dialog.component';

@Component({
  selector: 'app-moderator',
  standalone: true,
  imports: [FormsModule, WheelComponent, WinnerDialogComponent],
  template: `
    @if (rooms.room(); as room) {
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input class="input max-w-sm !bg-transparent font-display text-2xl font-bold text-mercy-600" aria-label="Título"
               [ngModel]="room.title" (change)="saveTitle($any($event.target).value)">
        <button class="btn-ghost" (click)="newRoom()">Nueva ruleta</button>
      </div>

      @if (error()) { <p class="mb-4 rounded-xl bg-mercy-cherry/10 px-4 py-2 text-sm text-mercy-cherry" role="alert">{{ error() }}</p> }

      <div class="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section class="card">
          <app-wheel [participants]="room.participants" [spin]="room.spin" [clockSkew]="rooms.skewMs()"
                     (finished)="onFinished($event)" />
          <div class="mt-4 flex justify-center">
            <button class="btn-primary px-10 py-3 text-base" [disabled]="busy() || room.participants.length < 2" (click)="spin()">
              {{ busy() ? 'Girando…' : 'Girar ruleta' }}
            </button>
          </div>
        </section>

        <aside class="space-y-6">
          <section class="card">
            <h2 class="font-display text-xl font-bold">Participantes ({{ room.participants.length }})</h2>
            <textarea class="input mt-3" rows="2" [(ngModel)]="draft" placeholder="Escribe un nombre (o pega varios, uno por línea)"
                      (keydown.enter)="$event.preventDefault(); add()"></textarea>
            <button class="btn-primary mt-2 w-full" [disabled]="busy() || !draft.trim()" (click)="add()">Agregar</button>

            <ul class="mt-4 max-h-72 space-y-1.5 overflow-auto">
              @for (p of room.participants; track p.id) {
                <li class="flex items-center gap-2">
                  <input class="input !py-1.5" [value]="p.name" [disabled]="busy()" aria-label="Editar nombre"
                         (change)="rename(p.id, $any($event.target).value)">
                  <button class="btn-ghost !px-3 !py-1.5" [disabled]="busy()" (click)="remove(p.id)" [attr.aria-label]="'Retirar ' + p.name">✕</button>
                </li>
              } @empty { <li class="text-sm text-mercy-700">Agrega al menos 2 personas para girar.</li> }
            </ul>
            @if (room.participants.length) {
              <button class="mt-3 text-sm text-mercy-700 underline" [disabled]="busy()" (click)="persist([])">Vaciar lista</button>
            }
          </section>

          <section class="card text-center">
            <h2 class="font-display text-xl font-bold">Invita a ver la ruleta en vivo</h2>
            @if (qr()) { <img [src]="qr()" alt="Código QR para ver la ruleta" class="mx-auto mt-3 h-48 w-48 rounded-2xl"> }
            <p class="mt-2 break-all text-xs text-mercy-700">{{ shareUrl() }}</p>
            <button class="btn-ghost mt-2" (click)="copy()">{{ copied() ? '¡Copiado!' : 'Copiar enlace' }}</button>
          </section>

          <section class="card">
            <div class="flex items-center justify-between">
              <h2 class="font-display text-xl font-bold">Ganadores</h2>
              @if (rooms.visibleHistory().length) { <button class="text-sm text-mercy-700 underline" (click)="act({ action: 'clearHistory' })">Limpiar</button> }
            </div>
            <ol class="mt-3 space-y-1 text-sm">
              @for (h of rooms.visibleHistory(); track h.id) { <li class="rounded-lg bg-mercy-100 px-3 py-1.5 font-medium">🍒 {{ h.name }}</li> }
              @empty { <li class="text-mercy-700">Todavía no hay giros.</li> }
            </ol>
          </section>
        </aside>
      </div>
    } @else {
      <p class="py-20 text-center text-mercy-700">{{ error() || 'Preparando tu ruleta…' }}</p>
    }

    @if (winner(); as w) {
      <app-winner-dialog [winner]="w" (closed)="winner.set(null)">
        <button class="btn-primary" (click)="remove(w.id); winner.set(null)">Retirar de la ruleta</button>
      </app-winner-dialog>
    }
  `
})
export class ModeratorComponent implements OnInit {
  protected rooms = inject(RoomService);
  private store = inject(StorageService);

  protected draft = '';
  protected busy = signal(false);
  protected error = signal('');
  protected copied = signal(false);
  protected winner = signal<Participant | null>(null);
  protected qr = signal('');
  private session: Session | null = null;

  protected shareUrl = computed(() => {
    const id = this.rooms.room()?.id;
    return id ? `${location.origin}/v/${id}` : '';
  });

  constructor() {
    effect(() => {
      const url = this.shareUrl();
      if (url) QRCode.toDataURL(url, { width: 360, margin: 1, color: { dark: '#A3134C', light: '#FFF1F5' } }).then(this.qr.set);
    });
  }

  async ngOnInit() {
    this.rooms.stop();
    this.session = this.store.get();
    if (this.session && (await this.rooms.fetchRoom(this.session.id).catch(() => null))) return;
    await this.newRoom();
  }

  protected async newRoom() {
    try {
      this.error.set('');
      this.session = await this.rooms.post<Session>({ action: 'create', title: 'Ruleta MercyShop' });
      this.store.set(this.session);
      this.winner.set(null);
      await this.rooms.fetchRoom(this.session.id);
    } catch (e) { this.error.set((e as Error).message); }
  }

  protected async act(body: object) {
    if (!this.session) return;
    try {
      this.error.set('');
      await this.rooms.post({ ...body, id: this.session.id, token: this.session.token });
    } catch (e) { this.error.set((e as Error).message); }
  }

  protected persist(list: Participant[]) { return this.act({ action: 'save', participants: list }); }
  private list() { return this.rooms.room()?.participants ?? []; }

  protected add() {
    const names = this.draft.split('\n').map(n => n.trim()).filter(Boolean);
    this.draft = '';
    return this.persist([...this.list(), ...names.map(name => ({ id: crypto.randomUUID(), name }))]);
  }
  protected remove(id: string) { return this.persist(this.list().filter(p => p.id !== id)); }
  protected rename(id: string, name: string) { return this.persist(this.list().map(p => (p.id === id ? { ...p, name } : p))); }
  protected saveTitle(title: string) { return this.act({ action: 'save', title, participants: this.list() }); }

  protected async spin() {
    this.winner.set(null);
    this.busy.set(true);
    await this.act({ action: 'spin' });
    if (this.error()) this.busy.set(false); // si el servidor rechazó el giro
  }
  protected onFinished(p: Participant) { this.busy.set(false); this.winner.set(p); }

  protected async copy() {
    await navigator.clipboard.writeText(this.shareUrl());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1800);
  }
}
