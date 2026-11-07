import type { CareerResume } from "@/types-and-constants/career";
import { defaultSettings } from "@/types-and-constants/output";

const { pageSize, fontFamily: _fontFamily, ...appearance } = defaultSettings;
void _fontFamily;

export const appLayoutDefaults = {
  ...appearance,
  contactRows: "auto",
  contactRowSizes: [],
  contactRowGap: 0,
  contactSeparator: "space",
  paper: pageSize,
  font: "inter",
  fontSize: 10,
} satisfies Omit<CareerResume["layout"], "defaults">;
