import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <header class="flex items-center gap-3 px-5 py-4">
      <img src="/logo.jpg" alt="MercyShop" class="h-12 w-12 rounded-full ring-2 ring-mercy-600/40">
      <div>
        <p class="font-display text-xl font-bold leading-none text-mercy-600">MercyShop</p>
        <p class="text-xs tracking-wide text-mercy-700">Outfits que enamoran</p>
      </div>
    </header>
    <main class="mx-auto max-w-6xl px-4 pb-12"><router-outlet /></main>
  `
})
export class AppComponent {}
