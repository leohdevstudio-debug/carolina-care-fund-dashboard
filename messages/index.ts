import es from "./es";
import en from "./en";
import zhTW from "./zh-TW";

export const messages = {
  es,
  en,
  "zh-TW": zhTW,
};

export type Locale = keyof typeof messages;