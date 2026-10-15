import {
  Component,
  computed,
  effect,
  input,
  OnDestroy,
  output,
  signal,
} from "@angular/core";
import { Participant, Spin } from "../../core/models";

const FILLS = [
  "#C2185B",
  "#FDD7E0",
  "#E0457B",
  "#FFF1F5",
  "#A3134C",
  "#F9B8C9",
];
const TEXT = ["#fff", "#A3134C", "#fff", "#A3134C", "#fff", "#A3134C"];

const pt = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(r * Math.sin(a)).toFixed(3)},${(-r * Math.cos(a)).toFixed(3)}`;
};

@Component({
  selector: "app-wheel",
  standalone: true,
  template: `
    <svg
      viewBox="-112 -118 224 230"
      class="mx-auto block w-full max-w-[520px]"
      role="img"
      [attr.aria-label]="
        'Ruleta con ' + participants().length + ' participantes'
      "
    >
      <defs>
        <clipPath id="hub"><circle r="19" /></clipPath>
      </defs>

      <!-- doble aro, guiño al logo -->
      <circle r="109" fill="#FDD7E0" stroke="#C2185B" stroke-width="1.2" />
      <circle r="104" fill="none" stroke="#C2185B" stroke-width="0.6" />

      <g [attr.transform]="'rotate(' + rotation() + ')'">
        @if (participants().length === 0) {
          <circle r="100" fill="#FFF1F5" />
          <text text-anchor="middle" y="2" font-size="8" fill="#A3134C">
            Agrega participantes
          </text>
        }
        @for (s of segments(); track s.id) {
          <path
            [attr.d]="s.path"
            [attr.fill]="s.fill"
            stroke="#fff"
            stroke-width="0.8"
          />
          <text
            [attr.transform]="'rotate(' + (s.mid - 90) + ') translate(94,0)'"
            text-anchor="end"
            [attr.font-size]="fontSize()"
            font-weight="700"
            dominant-baseline="central"
            [attr.fill]="s.text"
          >
            {{ s.label }}
          </text>
        }
      </g>

      <!-- centro con el logo -->
      <circle r="22" fill="#fff" stroke="#C2185B" stroke-width="1.2" />
      <image
        href="/logo.jpg"
        x="-19"
        y="-19"
        width="38"
        height="38"
        clip-path="url(#hub)"
      />

      <!-- puntero: una cereza -->
      <g transform="translate(0,-108)">
        <path
          d="M0,16 L-7,-4 L7,-4 Z"
          fill="#C8102E"
          stroke="#fff"
          stroke-width="1.2"
          stroke-linejoin="round"
        />
        <circle
          cy="-6"
          r="6.5"
          fill="#C8102E"
          stroke="#fff"
          stroke-width="1.2"
        />
        <circle cx="-2" cy="-8" r="1.6" fill="#fff" opacity=".6" />
      </g>
    </svg>
  `,
})
export class WheelComponent implements OnDestroy {
  participants = input.required<Participant[]>();
  spin = input<Spin | null>(null);
  clockSkew = input(0);
  finished = output<Participant>();

  protected rotation = signal(0);
  private lastSpinId = "";
  private raf = 0;

  protected fontSize = computed(() => {
    const n = this.participants().length;
    // ancho disponible por segmento a ~62 unidades del centro
    const size = (2 * Math.PI * 62 * 0.55) / n;
    return Math.min(10, Math.max(4.5, size));
  });

  protected segments = computed(() => {
    const ps = this.participants();
    const n = ps.length;
    const a = 360 / n;
    return ps.map((p, i) => {
      const [a0, a1] = [i * a, (i + 1) * a];
      const path =
        n === 1
          ? "M0,-100 A100,100 0 1 1 0,100 A100,100 0 1 1 0,-100Z"
          : `M0,0 L${pt(a0, 100)} A100,100 0 ${a > 180 ? 1 : 0} 1 ${pt(a1, 100)}Z`;
      const maxChars = Math.floor(62 / (this.fontSize() * 0.6));
      const label =
        p.name.length > maxChars ? p.name.slice(0, maxChars - 1) + "…" : p.name;
      return {
        id: p.id,
        path,
        mid: (i + 0.5) * a,
        fill: FILLS[i % 6],
        text: TEXT[i % 6],
        label,
      };
    });
  });

  constructor() {
    effect(() => {
      const s = this.spin();
      if (s && s.id !== this.lastSpinId) {
        this.lastSpinId = s.id;
        this.run(s);
      }
    });
  }

  /** Todos los dispositivos animan el mismo giro, sincronizados con el reloj del servidor. */
  private run(s: Spin) {
    const ps = this.participants();
    const idx = ps.findIndex((p) => p.id === s.winnerId);
    if (idx < 0) return;
    const seg = 360 / ps.length;
    const final =
      s.turns * 360 - (idx + 0.5) * seg + (s.offset - 0.5) * seg * 0.7;
    const from = this.rotation();
    const target = Math.ceil(from / 360) * 360 + final;
    const now = () => Date.now() + this.clockSkew();

    cancelAnimationFrame(this.raf);
    if (now() >= s.startedAt + s.durationMs) {
      this.rotation.set(target);
      return;
    } // giro ya terminado

    const step = () => {
      const t = Math.min(1, Math.max(0, (now() - s.startedAt) / s.durationMs));
      this.rotation.set(from + (target - from) * (1 - Math.pow(1 - t, 4)));
      if (t < 1) this.raf = requestAnimationFrame(step);
      else this.finished.emit(ps[idx]);
    };
    step();
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
  }
}
