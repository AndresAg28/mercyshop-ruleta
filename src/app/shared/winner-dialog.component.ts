import { Component, input, output } from '@angular/core';
import { Participant } from '../core/models';

@Component({
  selector: 'app-winner-dialog',
  standalone: true,
  template: `
    <div class="fixed inset-0 z-20 grid place-items-center bg-mercy-900/50 p-4" (click)="closed.emit()">
      <div class="w-full max-w-sm rounded-3xl border-4 border-double border-mercy-600 bg-mercy-100 p-8 text-center shadow-xl"
           role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <p class="text-4xl" aria-hidden="true">🍒</p>
        <p class="mt-2 text-sm text-mercy-700">Salió en la ruleta</p>
        <p class="mt-1 break-words font-display text-4xl font-bold text-mercy-600">{{ winner().name }}</p>
        <div class="mt-6 flex flex-wrap justify-center gap-2">
          <ng-content />
          <button class="btn-ghost" (click)="closed.emit()">Cerrar</button>
        </div>
      </div>
    </div>
  `
})
export class WinnerDialogComponent {
  winner = input.required<Participant>();
  closed = output<void>();
}
