import { el, svgFromString } from './components.ts';

export class CurveEditor {
  private container: HTMLElement;
  private svg: SVGElement;
  private path: SVGPathElement;
  private handle1: SVGCircleElement;
  private handle2: SVGCircleElement;
  private line1: SVGLineElement;
  private line2: SVGLineElement;

  private isDragging = false;
  private activeHandle: 1 | 2 | null = null;
  
  // Curve bounds mapped to the 0..1 logical space.
  private curve = [0.33, 0.0, 0.67, 1.0];
  
  // Visual dimensions
  private readonly size = 160;
  private readonly padding = 20;

  constructor(
    private onChange: (curve: number[]) => void
  ) {
    this.container = el('div', { class: 'sm-curve-editor', style: 'display: flex; justify-content: center; padding: 12px 0;' });
    
    // Create the SVG using the helper
    this.svg = svgFromString(`
      <svg width="${this.size + this.padding*2}" height="${this.size + this.padding*2}" viewBox="0 0 ${this.size + this.padding*2} ${this.size + this.padding*2}" style="overflow: visible;">
        <rect x="${this.padding}" y="${this.padding}" width="${this.size}" height="${this.size}" fill="var(--sm-bg)" stroke="var(--sm-border)" rx="4"/>
        <path d="M ${this.padding} ${this.size + this.padding} L ${this.size + this.padding} ${this.padding}" stroke="var(--sm-border-light)" stroke-dasharray="4,4" fill="none"/>
        <line class="sm-curve-line1" stroke="var(--sm-text-dim)" stroke-width="1.5"/>
        <line class="sm-curve-line2" stroke="var(--sm-text-dim)" stroke-width="1.5"/>
        <path class="sm-curve-path" stroke="var(--sm-accent)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <circle class="sm-curve-h1" r="6" fill="var(--sm-bg-2)" stroke="var(--sm-text)" stroke-width="2" style="cursor: pointer;"/>
        <circle class="sm-curve-h2" r="6" fill="var(--sm-bg-2)" stroke="var(--sm-text)" stroke-width="2" style="cursor: pointer;"/>
      </svg>
    `);
    
    this.path = this.svg.querySelector('.sm-curve-path') as SVGPathElement;
    this.line1 = this.svg.querySelector('.sm-curve-line1') as SVGLineElement;
    this.line2 = this.svg.querySelector('.sm-curve-line2') as SVGLineElement;
    this.handle1 = this.svg.querySelector('.sm-curve-h1') as SVGCircleElement;
    this.handle2 = this.svg.querySelector('.sm-curve-h2') as SVGCircleElement;

    this.container.append(this.svg);
    this.setupInteractions();
    this.updateVisuals();
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public setCurve(curve: number[]): void {
    if (this.isDragging) return; // Don't override while user is dragging
    this.curve = [...curve];
    this.updateVisuals();
  }

  private logicalToPixels(x: number, y: number): { px: number, py: number } {
    return {
      px: this.padding + (x * this.size),
      py: this.padding + this.size - (y * this.size) // Y is inverted in SVG
    };
  }

  private pixelsToLogical(px: number, py: number): { x: number, y: number } {
    const x = Math.max(0, Math.min(1, (px - this.padding) / this.size));
    // Y is allowed to overshoot slightly for bounce/spring effects if we wanted, 
    // but for standard cubic-bezier CSS bounds it's usually clamped [0,1] or [-0.5, 1.5]
    // We will clamp to [0,1] for now.
    const y = Math.max(0, Math.min(1, 1 - ((py - this.padding) / this.size)));
    return { x, y };
  }

  private updateVisuals(): void {
    const p1 = this.logicalToPixels(0, 0);
    const h1 = this.logicalToPixels(this.curve[0], this.curve[1]);
    const h2 = this.logicalToPixels(this.curve[2], this.curve[3]);
    const p2 = this.logicalToPixels(1, 1);

    this.path.setAttribute('d', `M ${p1.px} ${p1.py} C ${h1.px} ${h1.py}, ${h2.px} ${h2.py}, ${p2.px} ${p2.py}`);
    
    this.line1.setAttribute('x1', String(p1.px));
    this.line1.setAttribute('y1', String(p1.py));
    this.line1.setAttribute('x2', String(h1.px));
    this.line1.setAttribute('y2', String(h1.py));

    this.line2.setAttribute('x1', String(p2.px));
    this.line2.setAttribute('y1', String(p2.py));
    this.line2.setAttribute('x2', String(h2.px));
    this.line2.setAttribute('y2', String(h2.py));

    this.handle1.setAttribute('cx', String(h1.px));
    this.handle1.setAttribute('cy', String(h1.py));

    this.handle2.setAttribute('cx', String(h2.px));
    this.handle2.setAttribute('cy', String(h2.py));
  }

  private setupInteractions(): void {
    const startDrag = (handleId: 1 | 2) => (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      this.isDragging = true;
      this.activeHandle = handleId;
      document.addEventListener('mousemove', this.onDrag);
      document.addEventListener('mouseup', this.stopDrag);
      document.addEventListener('touchmove', this.onDrag, { passive: false });
      document.addEventListener('touchend', this.stopDrag);
    };

    this.handle1.addEventListener('mousedown', startDrag(1));
    this.handle1.addEventListener('touchstart', startDrag(1), { passive: false });
    
    this.handle2.addEventListener('mousedown', startDrag(2));
    this.handle2.addEventListener('touchstart', startDrag(2), { passive: false });
  }

  private onDrag = (e: MouseEvent | TouchEvent) => {
    if (!this.isDragging || !this.activeHandle) return;
    e.preventDefault();

    let clientX, clientY;
    if (e instanceof MouseEvent) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    const rect = this.svg.getBoundingClientRect();
    const { x, y } = this.pixelsToLogical(clientX - rect.left, clientY - rect.top);

    if (this.activeHandle === 1) {
      this.curve[0] = x;
      this.curve[1] = y;
    } else {
      this.curve[2] = x;
      this.curve[3] = y;
    }

    this.updateVisuals();
    this.onChange(this.curve);
  };

  private stopDrag = () => {
    this.isDragging = false;
    this.activeHandle = null;
    document.removeEventListener('mousemove', this.onDrag);
    document.removeEventListener('mouseup', this.stopDrag);
    document.removeEventListener('touchmove', this.onDrag);
    document.removeEventListener('touchend', this.stopDrag);
  };
}
