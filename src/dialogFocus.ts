import type { ObjectDirective } from "vue";

const cleanups = new WeakMap<HTMLElement, () => void>();

// Keep keyboard navigation inside an open dialog, then return focus to its trigger.
export const dialogFocus: ObjectDirective<HTMLElement> = {
  mounted(element) {
    const previous = document.activeElement as HTMLElement | null;
    const buttons = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]',
        ),
      );
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        element.closest<HTMLElement>(".modal-backdrop")?.click();
      }
      if (event.key !== "Tab") return;
      const targets = buttons();
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (!first || !last) return;
      if (
        !element.contains(document.activeElement) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };
    document.addEventListener("keydown", onKeydown, true);
    requestAnimationFrame(() => {
      if (element.isConnected)
        (
          element.querySelector<HTMLElement>("[autofocus]") ?? buttons()[0]
        )?.focus();
    });
    cleanups.set(element, () => {
      document.removeEventListener("keydown", onKeydown, true);
      if (previous?.isConnected) previous.focus();
    });
  },
  unmounted(element) {
    cleanups.get(element)?.();
    cleanups.delete(element);
  },
};
