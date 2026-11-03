import { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { CareerOverview } from "@/components/career/career-overview";
import { createCareerDocument } from "@/lib/career/model";

it("plays overview entrances on initial mount and route return under Strict Mode, then cleans up", async () => {
  const animate = Element.prototype.animate;
  const animations: Animation[] = [];
  const spy = vi
    .spyOn(Element.prototype, "animate")
    .mockImplementation(function (
      this: Element,
      ...args: Parameters<Element["animate"]>
    ) {
      const animation = animate.apply(this, args);
      // Hold real browser animations so assertions do not race their duration.
      animation.pause();
      animations.push(animation);
      return animation;
    });
  const screen = await render(
    <StrictMode>
      <CareerOverview document={createCareerDocument()} navigate={() => {}} />
    </StrictMode>,
  );
  try {
    for (let visit = 0; visit < 2; visit++) {
      const cards = [
        ...document.querySelectorAll<HTMLElement>("[data-list-id]"),
      ].filter((card) => {
        const bounds = card.getBoundingClientRect();
        return bounds.top < innerHeight && bounds.bottom > 0;
      });
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        expect(card.getAnimations()).toHaveLength(1);
        const animation = card.getAnimations()[0];
        expect(animation.effect?.getTiming().duration).toBe(350);
        expect(
          (animation.effect as KeyframeEffect).getKeyframes()[0].scale,
        ).toBe("0.85");
      }
      await screen.rerender(
        <StrictMode>
          <p>Another destination</p>
        </StrictMode>,
      );
      expect(
        animations.every((animation) => animation.playState === "idle"),
      ).toBe(true);
      await screen.rerender(
        <StrictMode>
          <CareerOverview
            document={createCareerDocument()}
            navigate={() => {}}
          />
        </StrictMode>,
      );
    }
  } finally {
    await screen.unmount();
    spy.mockRestore();
  }
  expect(animations.every((animation) => animation.playState === "idle")).toBe(
    true,
  );
});
