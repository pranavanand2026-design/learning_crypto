// Display options offered in settings and onboarding.
export const CURRENCIES = [
  ["USD", "US dollar"], ["EUR", "Euro"], ["GBP", "British pound"], ["AUD", "Australian dollar"],
  ["CAD", "Canadian dollar"], ["NZD", "New Zealand dollar"], ["SGD", "Singapore dollar"], ["HKD", "Hong Kong dollar"],
  ["JPY", "Japanese yen"], ["CNY", "Chinese yuan"], ["KRW", "South Korean won"], ["INR", "Indian rupee"],
  ["IDR", "Indonesian rupiah"], ["PHP", "Philippine peso"], ["THB", "Thai baht"], ["MYR", "Malaysian ringgit"],
  ["AED", "UAE dirham"], ["SAR", "Saudi riyal"], ["ZAR", "South African rand"], ["NGN", "Nigerian naira"],
  ["BRL", "Brazilian real"], ["MXN", "Mexican peso"], ["ARS", "Argentine peso"], ["CHF", "Swiss franc"],
  ["SEK", "Swedish krona"], ["NOK", "Norwegian krone"], ["DKK", "Danish krone"], ["PLN", "Polish złoty"], ["TRY", "Turkish lira"],
];

export const LOCALES = [
  ["auto", "Match this device"],
  ["en-US", "United States"], ["en-GB", "United Kingdom"], ["en-AU", "Australia"], ["en-IN", "India"],
  ["de-DE", "Germany"], ["fr-FR", "France"], ["es-ES", "Spain"], ["pt-BR", "Brazil"],
  ["ja-JP", "Japan"], ["zh-CN", "China"], ["ko-KR", "Korea"],
];

const REGION_CURRENCY = {
  US: "USD", GB: "GBP", AU: "AUD", CA: "CAD", NZ: "NZD", SG: "SGD", HK: "HKD", JP: "JPY", CN: "CNY", KR: "KRW",
  IN: "INR", ID: "IDR", PH: "PHP", TH: "THB", MY: "MYR", AE: "AED", SA: "SAR", ZA: "ZAR", NG: "NGN", BR: "BRL",
  MX: "MXN", AR: "ARS", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", TR: "TRY",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", IE: "EUR", PT: "EUR", AT: "EUR", BE: "EUR", FI: "EUR",
};

export function guessCurrency() {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return REGION_CURRENCY[region] || "USD";
  } catch {
    return "USD";
  }
}

export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const allTimeZones = () => (Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : [deviceTimeZone()]);
