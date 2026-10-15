import { Injectable } from '@angular/core';
import { Session } from './models';

const KEY = 'mercyshop.ruleta.session';

/** Persiste en localStorage la sesión de la persona moderadora (id de sala + token). */
@Injectable({ providedIn: 'root' })
export class StorageService {
  get(): Session | null {
    try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
  }
  set(s: Session) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* modo privado */ } }
  clear() { try { localStorage.removeItem(KEY); } catch { /* noop */ } }
}
