/* Who runs Shussapp — shown on /privacy and /terms. Fill these in before
 * the store submission (Apple and Google both link to the privacy page). */
export const LEGAL = {
  controller: "[COMPANY NAME + LEGAL FORM]",
  companyNumber: "[ENTERPRISE NUMBER]",
  address: "[STREET + NUMBER, POSTCODE CITY, BELGIUM]",
  email: "[PRIVACY EMAIL]",
  updated: "2026-10-18",
};

export const legalIsComplete = () => !Object.values(LEGAL).some((v) => v.startsWith("["));
