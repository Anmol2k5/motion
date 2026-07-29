// StateMotion Preset Panel — small DOM helper utilities (no framework).

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('aria-') || k === 'role' || k === 'title') node.setAttribute(k, v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c as Node | string);
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function showState(container: HTMLElement, icon: string, title: string, detail: string): void {
  clear(container);
  const wrap = el('div', { class: 'state-panel' }, [
    el('div', { class: 'state-icon', 'aria-hidden': 'true', text: icon }),
    el('h2', { class: 'state-title', text: title }),
    el('p', { class: 'state-detail', text: detail }),
  ]);
  container.append(wrap);
}

export function svgFromString(markup: string): SVGElement {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  return doc.documentElement as unknown as SVGElement;
}

export function accordion(title: string, content: HTMLElement[], isOpen = false): HTMLElement {
  const acc = el('div', { class: `sm-accordion ${isOpen ? 'open' : ''}` });
  const icon = el('span', { class: 'sm-accordion-icon', text: '▶' });
  const header = el('div', { class: 'sm-accordion-header' }, [icon, el('span', { text: title })]);
  const body = el('div', { class: 'sm-accordion-content' }, content);
  
  header.addEventListener('click', () => {
    const isCurrentlyOpen = acc.classList.contains('open');
    if (isCurrentlyOpen) {
      acc.classList.remove('open');
    } else {
      acc.classList.add('open');
    }
  });

  acc.append(header, body);
  return acc;
}
